/** Sending email through Resend. Without RESEND_API_KEY nothing is sent (and nothing breaks). */
export const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.discomplete.com";

export function mailConfigured() {
  return !!process.env.RESEND_API_KEY && !!process.env.PARTY_MAIL_KEY;
}

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM ?? "Discomplete <onboarding@resend.dev>", to, subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A short, plain email: a heading, a few lines, one button, and how to stop these. */
export function partyMail({ heading, lines, cover, button, href }: { heading: string; lines: string[]; cover?: string | null; button: string; href: string }) {
  const html = `<!doctype html><html><body style="margin:0;background:#141414;font-family:Helvetica,Arial,sans-serif;color:#f2efe9">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="margin:0 0 20px;font-size:13px;letter-spacing:2px;color:#ff6a3d;font-weight:700">DISCOMPLETE</p>
${cover ? `<img src="${esc(cover)}" width="160" height="160" alt="" style="display:block;border-radius:8px;margin:0 0 20px">` : ""}
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2">${esc(heading)}</h1>
${lines.map((l) => `<p style="margin:0 0 10px;font-size:16px;line-height:1.5;color:#d9d5ce">${esc(l)}</p>`).join("")}
<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;background:#ff6a3d;color:#131314;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${esc(button)}</a></p>
<p style="margin:32px 0 0;font-size:12px;color:#a3a09a">You get this because you’re in a listening party on Discomplete. Turn these emails off under Settings → Emails: ${esc(SITE)}/settings</p>
</div></body></html>`;
  const text = [heading, "", ...lines, "", `${button}: ${href}`, "", `Turn these emails off: ${SITE}/settings`].join("\n");
  return { html, text };
}
