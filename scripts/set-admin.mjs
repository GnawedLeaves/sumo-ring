// Grants (or revokes) the `admin` custom claim on a Firebase user.
//
//   node --env-file=.env.local scripts/set-admin.mjs you@example.com          # grant
//   node --env-file=.env.local scripts/set-admin.mjs you@example.com --revoke # revoke
//
// The user must sign out and back in afterwards so their session picks up the claim.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const [email, flag] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/set-admin.mjs <email> [--revoke]");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const auth = getAuth();
const user = await auth.getUserByEmail(email);
const admin = flag !== "--revoke";
await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), admin });
await auth.revokeRefreshTokens(user.uid); // forces existing sessions to re-authenticate
console.log(`${admin ? "Granted" : "Revoked"} admin for ${email} (${user.uid}).`);
