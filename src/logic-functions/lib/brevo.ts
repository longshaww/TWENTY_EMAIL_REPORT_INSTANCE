/**
 * Brevo transactional email integration (the required third-party integration).
 * POST https://api.brevo.com/v3/smtp/email with an `api-key` header.
 *
 * The key lives in a secret server variable and is only read here, server-side.
 * When no key is configured the send is a no-op "dry run", so previews and local
 * demos still work end-to-end without leaking credentials to the client.
 */
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

// `memberId`/`scopeMode` are used by per-recipient scoped delivery; Brevo itself
// only ever reads `email`/`name`.
export type Recipient = { email: string; name?: string; memberId?: string; scopeMode?: string };

export type SendResult = {
  delivered: boolean;
  dryRun: boolean;
  messageId?: string;
  error?: string;
};

export async function sendEmail(args: {
  to: Recipient[];
  subject: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  // Sender is configured via the BREVO_SENDER_EMAIL / BREVO_SENDER_NAME
  // application variables (see application-config.ts) — set them per deployment
  // in the app settings UI. No sender is hardcoded here.
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || 'NorthPeak Reports';

  if (args.to.length === 0) {
    return { delivered: false, dryRun: false, error: 'No recipients.' };
  }
  if (!apiKey) {
    // Graceful dry-run: nothing is sent, but callers can still render/preview.
    return { delivered: false, dryRun: true };
  }
  if (!senderEmail) {
    return {
      delivered: false,
      dryRun: false,
      error: 'BREVO_SENDER_EMAIL is not configured (set a verified Brevo sender in the app settings).',
    };
  }

  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: args.to.map((r) => ({ email: r.email, ...(r.name ? { name: r.name } : {}) })),
      subject: args.subject,
      htmlContent: args.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { delivered: false, dryRun: false, error: `Brevo error ${res.status}: ${text.slice(0, 300)}` };
  }
  const data: any = await res.json().catch(() => ({}));
  return { delivered: true, dryRun: false, messageId: data?.messageId };
}
