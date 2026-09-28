// Admin cancel refunds the still-active items plus the full platform fee; channel fee is never refunded.
// Items cancelled earlier already have their own partial_item refunds, so the order total never exceeds subtotal + platform fee.
export function adminCancelRefund(order) {
  const item = order.order_items.filter(i => i.item_status === 'active').reduce((sum, i) => sum + i.line_total, 0)
  return { item_amount_refunded: item, platform_fee_refunded: order.platform_fee_amount, total_refund_amount: item + order.platform_fee_amount }
}
