import "server-only";

/**
 * Who is an admin: a comma-separated list of emails in ADMIN_EMAILS (server-only env var, never sent to
 * the browser). The email must be verified, so nobody can claim an admin address by signing up with it
 * using a password they made up. Google sign-in emails are verified automatically.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminIdentity(claims: { email?: string; email_verified?: boolean }): boolean {
  return Boolean(claims.email && claims.email_verified === true && ADMIN_EMAILS.has(claims.email.toLowerCase()));
}
