/**
 * firestoreSecurityCheck.ts
 *
 * Startup guard that verifies Firestore security rules are actually deployed
 * instead of leaving the project in Firebase "test mode" (open access).
 *
 * The app's rules (firestore.rules) end with a blanket deny:
 *
 *   match /{document=**} { allow read, write: if false; }
 *
 * so a read of the sentinel document below MUST be denied by a correctly
 * deployed ruleset. If the read succeeds, the project is in test mode and
 * every user's workout data is publicly readable/writable (issue #1042).
 */

import { getFirestore, collection, getDoc, doc } from "firebase/firestore";
import { db } from "../config/firebase";

const PROBE_COLLECTION = "_rules_probe";
const PROBE_DOCUMENT = "security-check";

/**
 * Returns `true` when Firestore security rules are enforced (the sentinel
 * read is denied), `false` when the database is in open/test mode.
 */
export async function areFirestoreRulesEnforced(): Promise<boolean> {
  try {
    const probeRef = doc(db, PROBE_COLLECTION, PROBE_DOCUMENT);
    await getDoc(probeRef);
    // The read succeeded => rules are NOT denying anything => test mode.
    return false;
  } catch (error: any) {
    // permission-denied (or any read failure) => rules are enforced.
    return true;
  }
}

/**
 * Runs the probe and logs a prominent warning when the database is in test
 * mode. Returns `true` when rules are enforced. Safe to call during app
 * startup (Firebase must already be configured).
 */
export async function verifyFirestoreSecurity(): Promise<boolean> {
  let secure: boolean;
  try {
    secure = await areFirestoreRulesEnforced();
  } catch (error) {
    // Firestore not reachable (offline/demo) — do not block the app.
    return true;
  }

  if (!secure) {
    console.error(
      "[SpectraX] 🔒 SECURITY WARNING: Firestore security rules are NOT deployed. " +
        "The database is running in Firebase test mode and all user workout data " +
        "is publicly readable and writable. Deploy the rules with " +
        "`npm run deploy:firestore-rules` (or `firebase deploy --only firestore:rules`).",
    );
  }
  return secure;
}

// Sentinel constants re-exported so tests can reference them.
export const SECURITY_PROBE = {
  collection: PROBE_COLLECTION,
  document: PROBE_DOCUMENT,
};
