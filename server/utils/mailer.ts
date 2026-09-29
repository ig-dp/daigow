const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`[mailer] RESEND_API_KEY is not configured; skipped email to ${to}`)
    return false
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Daigow <onboarding@resend.dev>',
        to: [to],
        subject,
        text: body
      })
    })

    if (!response.ok) throw new Error(`Resend request failed: ${response.status} ${await response.text()}`)
    return true
  } catch (error) {
    console.error(`[mailer] failed to send email to ${to}:`, (error as Error).message)
    return false
  }
}
