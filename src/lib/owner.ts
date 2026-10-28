// Who sees the owner-only guide in Settings. Set OWNER_EMAILS (comma-separated) in Vercel to change it.
const DEFAULT_OWNERS = ["kevin.wedin@ci.se"];

export function isOwner(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.OWNER_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return (list.length ? list : DEFAULT_OWNERS).includes(email.toLowerCase());
}
