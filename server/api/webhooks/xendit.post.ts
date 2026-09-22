import { getHeader, readBody } from "h3";
import { apiError } from "../../utils/api-error";
import {
  insertWebhookEvent,
  findPaymentByRequestId,
  updatePayment,
} from "../../repositories/payment.repository";
import { transitionOrderToProcessing } from "../../repositories/order.repository";

export default defineEventHandler(async (event) => {
  const expected = process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expected || getHeader(event, "x-callback-token") !== expected)
    throw apiError(401, "INVALID_WEBHOOK_TOKEN", "Invalid webhook token");

  const body = await readBody(event);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw apiError(400, "INVALID_INPUT", "Webhook body must be a JSON object");
  const eventId = body.event_id ?? body.id;
  const eventType = body.event_type ?? body.event ?? "payment";
  const payload = body.data ?? body;
  const requestId = payload.payment_request_id ?? body.payment_request_id;
  const status = payload.status ?? body.status;
  if (
    typeof eventId !== "string" ||
    !eventId ||
    typeof requestId !== "string" ||
    !requestId
  )
    throw apiError(
      400,
      "INVALID_INPUT",
      "Webhook event_id and payment_request_id are required",
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

  const { data: payment, error: paymentError } = await findPaymentByRequestId(
    event,
    requestId,
  );
  if (paymentError?.code === "PGRST116" || !payment) return { received: true };
  if (paymentError)
    throw apiError(500, "INTERNAL_ERROR", "Failed to load payment");

  if (status === "SUCCEEDED") {
    if (payment.status !== "paid") {
      const { error } = await updatePayment(event, payment.id, {
        status: "paid",
        paid_at: payload.paid_at ?? new Date().toISOString(),
      });
      if (error)
        throw apiError(500, "INTERNAL_ERROR", "Failed to update payment");
    }
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
