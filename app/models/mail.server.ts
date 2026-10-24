// Email through Resend's HTTP API: no SMTP, so it also works on hosts that block outbound mail ports.
// Off unless RESEND_API_KEY is set. Never throws: email is a notification, not part of the request.

type Mail = { to: string; subject: string; text: string; replyTo?: string };

export const mailEnabled = () => Boolean(process.env.RESEND_API_KEY);

export async function sendMail({ to, subject, text, replyTo }: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  // Resend's test sender can only mail the Resend account's own address; set MAIL_FROM on a verified domain.
  const from = process.env.MAIL_FROM || "Cartivo Support <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("Email failed", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email failed", e);
    return false;
  }
}
