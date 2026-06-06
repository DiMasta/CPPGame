// ===========================================================================
//  One-off maintenance: clear stale "In Arena" flags
// ===========================================================================
//
//  WHY THIS EXISTS
//  ---------------
//  The web app marks a player `inArena: true` while they are on the arena
//  view (and, since the focus-detection fix, only while that tab is focused).
//  Players who opened the arena BEFORE that fix shipped — or whose browser
//  crashed mid-game — can be left with a stale `inArena: true` that keeps the
//  "In Arena" tag glued to their leaderboard row. The app can only ever clear
//  a player's OWN flag, so a one-time bulk reset has to run with admin rights.
//
//  WHAT IT DOES
//  ------------
//  Finds every players/* doc with `inArena == true` and sets it to `false`,
//  in batches. Safe to re-run; it only touches docs that are currently true.
//
//  HOW TO RUN  (needs admin credentials — bypasses Firestore rules)
//  ----------------------------------------------------------------
//    1. Firebase console -> Project settings -> Service accounts ->
//       "Generate new private key". Save the JSON somewhere private
//       (do NOT commit it).
//    2. Install the Admin SDK:        npm install firebase-admin
//    3. Point the env var at the key and run:
//
//         GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//         node scripts/reset-arena-flags.mjs
//
//    (Optional) override the project:  --project=dcsa-cpp-game
// ===========================================================================

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectArg = process.argv.find((a) => a.startsWith("--project="));
const projectId = projectArg ? projectArg.split("=")[1] : "dcsa-cpp-game";

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();

const WRITE_BATCH_LIMIT = 500; // Firestore's max writes per batch.

async function resetArenaFlags() {
  const snap = await db.collection("players").where("inArena", "==", true).get();

  if (snap.empty) {
    console.log("✓ No players have inArena == true — nothing to reset.");
    return;
  }

  console.log(`Found ${snap.size} player(s) flagged In Arena. Clearing…`);

  let batch = db.batch();
  let pending = 0;
  let cleared = 0;

  for (const docSnap of snap.docs) {
    batch.update(docSnap.ref, { inArena: false });
    pending += 1;
    cleared += 1;
    console.log(`  - ${docSnap.data().nickname || docSnap.id}`);

    if (pending === WRITE_BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();

  console.log(`✓ Done. Reset inArena on ${cleared} player(s).`);
}

resetArenaFlags()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
