// ponytail: console.log stub, swap for real provider (Resend/SendGrid) when chosen
export function sendEmail(to: string, subject: string, body: string) {
  console.log(`[mailer] to=${to} subject="${subject}"\n${body}`)
}
