import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** One Supabase client per request (shared by layout, page and helpers). */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: the proxy refreshes the session instead.
          }
        },
      },
    }
  );
});

export type SessionUser = { id: string; email: string | null };

/**
 * The signed-in user, or null. Verifies the session token's signature
 * (locally when the project uses signing keys) instead of asking the Auth
 * server on every request, and runs once per request however often it is called.
 * Row-level security in the database still decides what each user can read or write.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user: SessionUser | null = claims?.sub ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null;
  return { supabase, user };
});
