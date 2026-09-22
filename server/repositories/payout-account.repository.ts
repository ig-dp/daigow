import type { H3Event } from 'h3'
import { getSupabaseAdmin } from '../utils/supabase-admin'

const payoutAccountFields = 'id,jastiper_id,bank_code,account_number,account_holder_name,updated_at'

type PayoutAccountValues = {
  bank_code: string
  account_number: string
  account_holder_name: string
}

export function getPayoutAccount(event: H3Event, userId: string) {
  return getSupabaseAdmin(event)
    .from('payout_accounts')
    .select(payoutAccountFields)
    .eq('jastiper_id', userId)
    .single()
}

export function upsertPayoutAccount(event: H3Event, userId: string, values: PayoutAccountValues) {
  return getSupabaseAdmin(event)
    .from('payout_accounts')
    .upsert({ jastiper_id: userId, ...values }, { onConflict: 'jastiper_id' })
    .select(payoutAccountFields)
    .single()
}
