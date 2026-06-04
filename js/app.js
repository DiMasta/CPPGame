// ===========================================================================
//  Dragon CS Academy — C++ Quiz Arena
//  App logic: Google sign-in, nickname capture, live leaderboard.
// ===========================================================================

import { firebaseConfig, isConfigured } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
//  View helpers
// ---------------------------------------------------------------------------
const views = {
  loading: document.getElementById("view-loading"),
  configError: document.getElementById("view-config-error"),
  login: document.getElementById("view-login"),
  nickname: document.getElementById("view-nickname"),
  leaderboard: document.getElementById("view-leaderboard"),
};

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("hidden", key !== name);
  }
}

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
//  Bail out early with a friendly message if Firebase isn't configured yet.
// ---------------------------------------------------------------------------
if (!isConfigured) {
  showView("configError");
  throw new Error("Firebase is not configured. Edit js/firebase-config.js — see README.md.");
}

// ---------------------------------------------------------------------------
//  Firebase init
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let unsubscribeBoard = null; // detach the leaderboard listener on sign-out

// ---------------------------------------------------------------------------
//  Auth: sign in / out
// ---------------------------------------------------------------------------
$("googleSignInBtn").addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Sign-in failed:", err);
    alert("Sign-in failed: " + (err?.message || err));
  }
});

$("signOutBtn").addEventListener("click", () => signOut(auth));

// React to login state changes (this fires on page load too).
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    teardownBoard();
    $("userChip").classList.add("hidden");
    showView("login");
    return;
  }

  // Show the user chip in the top bar.
  $("userAvatar").src = user.photoURL || "";
  $("userName").textContent = user.displayName || user.email || "Player";
  $("userChip").classList.remove("hidden");

  // Do they already have a player profile (with a nickname)?
  const playerRef = doc(db, "players", user.uid);
  const snap = await getDoc(playerRef);

  if (snap.exists() && snap.data().nickname) {
    enterLeaderboard();
  } else {
    showView("nickname");
    $("nicknameInput").focus();
  }
});

// ---------------------------------------------------------------------------
//  Nickname capture
// ---------------------------------------------------------------------------
$("nicknameForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const errorEl = $("nicknameError");
  errorEl.classList.add("hidden");

  const nickname = $("nicknameInput").value.trim();
  if (nickname.length < 2) {
    errorEl.textContent = "Please enter at least 2 characters.";
    errorEl.classList.remove("hidden");
    return;
  }

  const submitBtn = $("nicknameSubmit");
  submitBtn.disabled = true;

  try {
    // Create the player profile. Everyone starts at 0 points.
    await setDoc(doc(db, "players", currentUser.uid), {
      nickname,
      email: currentUser.email || null,
      photoURL: currentUser.photoURL || null,
      points: 0,
      createdAt: serverTimestamp(),
    });
    enterLeaderboard();
  } catch (err) {
    console.error("Could not save nickname:", err);
    errorEl.textContent = "Could not save your nickname. Please try again.";
    errorEl.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
//  Leaderboard (live)
// ---------------------------------------------------------------------------
function enterLeaderboard() {
  showView("leaderboard");

  // Avoid stacking multiple listeners.
  teardownBoard();

  const q = query(collection(db, "players"), orderBy("points", "desc"));
  unsubscribeBoard = onSnapshot(
    q,
    (snapshot) => {
      const players = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Tie-break alphabetically by nickname (locale-aware, case-insensitive).
      players.sort((a, b) => {
        const pointsDiff = (Number(b.points) || 0) - (Number(a.points) || 0);
        if (pointsDiff !== 0) return pointsDiff;
        return String(a.nickname || "").localeCompare(String(b.nickname || ""), undefined, {
          sensitivity: "base",
        });
      });
      renderBoard(players);
    },
    (err) => {
      console.error("Leaderboard listener error:", err);
    }
  );
}

function teardownBoard() {
  if (unsubscribeBoard) {
    unsubscribeBoard();
    unsubscribeBoard = null;
  }
}

function renderBoard(players) {
  const body = $("boardBody");
  const count = players.length;
  $("playerCount").textContent = `${count} player${count === 1 ? "" : "s"}`;

  if (count === 0) {
    body.innerHTML =
      '<tr class="empty-row"><td colspan="3">No players yet — be the first! 🐉</td></tr>';
    return;
  }

  const meId = currentUser?.uid;
  let lastPoints = null;
  let lastRank = 0;
  body.innerHTML = players
    .map((p, i) => {
      const points = Number(p.points) || 0;
      const rank = points === lastPoints ? lastRank : i + 1;
      lastPoints = points;
      lastRank = rank;
      const isYou = p.id === meId;
      const badgeClass = rank <= 3 ? `rank-badge rank-${rank}` : "rank-badge";
      const avatar = p.photoURL
        ? `<img src="${escapeAttr(p.photoURL)}" alt="" referrerpolicy="no-referrer" />`
        : `<img alt="" />`;
      const youTag = isYou ? '<span class="you-tag">You</span>' : "";
      return `
        <tr class="${isYou ? "is-you" : ""}">
          <td class="col-rank"><span class="${badgeClass}">${rank}</span></td>
          <td class="col-player">
            <div class="player-cell">
              ${avatar}
              <span class="player-name">${escapeHtml(p.nickname || "Player")}</span>
              ${youTag}
            </div>
          </td>
          <td class="col-points">${points}</td>
        </tr>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
//  Small escaping helpers (nicknames are user input).
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function escapeAttr(str) {
  return escapeHtml(str);
}
