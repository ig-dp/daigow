import { getHeader, readBody } from "h3";
import { apiError } from "../../utils/api-error";
import {
  insertWebhookEvent,
  findPaymentByRequestId,
  findPaymentByOrderId,
  updatePayment,
} from "../../repositories/payment.repository";
import {
  findPayoutByExternalId,
  findPayoutByProviderId,
  updatePayoutStatus,
} from "../../repositories/payout.repository";
import {
  transitionOrderToProcessing,
  updateOrderPaidAt,
} from "../../repositories/order.repository";
import { normalizePayoutStatus } from '#shared/utils/payout.mjs'

export default defineEventHandler(async (event) => {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || getHeader(event, "x-callback-token") !== expected)
    throw apiError(401, "INVALID_WEBHOOK_TOKEN", "Invalid webhook token");

  const body = await readBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw apiError(400, "INVALID_INPUT", "Webhook body must be a JSON object");
  const eventType = body.event_type ?? body.event ?? "payment";
  const payload = body.data ?? body;
  const requestId = payload.payment_request_id ?? body.payment_request_id;
  const sessionId = payload.payment_session_id ?? body.payment_session_id;
  const referenceId = payload.reference_id ?? body.reference_id;
  const payoutId = payload.payout_id ?? body.payout_id;
  const externalId = payload.external_id ?? body.external_id;
  const status = payload.status ?? body.status ?? (eventType === "payment.capture" || eventType === "payment_session.completed" ? "SUCCEEDED" : eventType === "payment.failure" ? "FAILED" : eventType === "payment_request.expiry" || eventType === "payment_session.expired" ? "EXPIRED" : undefined);
  const payoutStatus = payload.status ?? (String(eventType).includes('succeeded') ? 'SUCCEEDED' : String(eventType).includes('failed') || String(eventType).includes('rejected') ? 'FAILED' : undefined);
  const identifier = requestId ?? sessionId ?? payoutId ?? externalId ?? referenceId;
  const eventId = body.event_id ?? body.id ?? [eventType, identifier, payload.payment_id ?? payload.updated ?? payload.created ?? body.created].filter(Boolean).join(":");
  if (
    typeof eventId !== "string" ||
    !eventId ||
    typeof identifier !== "string" ||
    !identifier
  )
    throw apiError(
      400,
      "INVALID_INPUT",
      "Webhook payment identifier is required",
    );

  const eventResult = await insertWebhookEvent(event, {
    provider: "xendit",
    event_id: eventId,
    event_type: String(eventType),
    payload: body,
  });
  if (eventResult.error)
    throw apiError(500, "INTERNAL_ERROR", "Failed to record webhook event");
  if (eventResult.duplicate) return { received: true, duplicate: true };

  if (payoutId || externalId || String(eventType).startsWith('v3_payout')) {
    const payoutResult = payoutId
      ? await findPayoutByProviderId(event, payoutId)
      : await findPayoutByExternalId(event, externalId as string);
    if (payoutResult.error?.code === 'PGRST116' || !payoutResult.data) return { received: true };
    if (payoutResult.error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to load payout');
    const normalized = normalizePayoutStatus(payoutStatus);
    if (payoutResult.data.status === 'succeeded' && normalized !== 'succeeded') return { received: true };
    const { error } = await updatePayoutStatus(event, payoutResult.data.id, normalized, {
      ...(payoutId ? { xendit_payout_id: payoutId } : {}),
      ...(normalized === 'failed' ? { failure_reason: payload.failure_code ?? payload.failure_reason ?? 'Xendit payout failed' } : { failure_reason: null }),
      ...(normalized === 'succeeded' ? { completed_at: payload.updated ?? payload.completed_at ?? new Date().toISOString() } : {}),
    });
    if (error) throw apiError(500, 'INTERNAL_ERROR', 'Failed to update payout');
    return { received: true };
  }

  let paymentResult = requestId ? await findPaymentByRequestId(event, requestId) : { data: null, error: null };
  if ((!paymentResult.data || paymentResult.error?.code === 'PGRST116') && referenceId) paymentResult = await findPaymentByOrderId(event, referenceId);
  const { data: payment, error: paymentError } = paymentResult;
  if (paymentError?.code === "PGRST116" || !payment) return { received: true };
  if (paymentError)
    throw apiError(500, "INTERNAL_ERROR", "Failed to load payment");

  if (status === "SUCCEEDED") {
    const paidAt = payload.paid_at ?? new Date().toISOString();
    if (payment.status !== "paid") {
      const { error } = await updatePayment(event, payment.id, {
        status: "paid",
        paid_at: paidAt,
        ...(requestId ? { xendit_payment_request_id: requestId } : {}),
      });
      if (error)
        throw apiError(500, "INTERNAL_ERROR", "Failed to update payment");
    }
    const { error: orderPaymentError } = await updateOrderPaidAt(
      event,
      payment.order_id,
      paidAt,
    );
    if (orderPaymentError)
      throw apiError(500, "INTERNAL_ERROR", "Failed to update order payment timestamp");
    if (payment.orders?.status === "awaiting_payment") {
      const { error } = await transitionOrderToProcessing(
        event,
        payment.order_id,
      );
      if (error)
        throw apiError(500, "INTERNAL_ERROR", "Failed to update order");
    }
  } else if (status === "FAILED" || status === "EXPIRED") {
    if (payment.status === "pending") {
      const { error } = await updatePayment(event, payment.id, {
        status: status === "EXPIRED" ? "expired" : "failed",
      });
      if (error)
        throw apiError(500, "INTERNAL_ERROR", "Failed to update payment");
    }
  }

  return { received: true };
});
