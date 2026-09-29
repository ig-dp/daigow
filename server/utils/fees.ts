export const PLATFORM_FEE_RATE = 0.015
export const COMMISSION_RATE = 0.025

export function getChannelFee(method: 'va' | 'qris', channelCode: string, amount: number) {
  if (method === 'va' && (channelCode === 'BCA' || channelCode === 'BCA_VIRTUAL_ACCOUNT')) return 4000
  if (method === 'qris' && channelCode === 'QRIS') return Math.round(amount * 0.007)
  return null
}
