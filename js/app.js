// ===========================================================================
//  DCSA C++ Arena
//  App logic: Google sign-in, nickname capture, leaderboard, quiz arena.
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
  updateDoc,
  increment,
  collection,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------------
//  View helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const views = {
  loading: document.getElementById("view-loading"),
  configError: document.getElementById("view-config-error"),
  login: document.getElementById("view-login"),
  nickname: document.getElementById("view-nickname"),
  leaderboard: document.getElementById("view-leaderboard"),
  arena: document.getElementById("view-arena"),
};

const VIEW_TAB_NAMES = {
  loading: "loading.cpp",
  configError: "setup-required.txt",
  login: "welcome.cpp",
  nickname: "register.cpp",
  leaderboard: "leaderboard.cpp",
  arena: "arena.cpp",
};

// In post-login views the tab strip is a navigation between these views.
// In pre-login views only the current view's filename is shown.
const NAV_VIEWS = ["arena", "leaderboard"];

const quizState = { current: null };

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("hidden", key !== name);
  }
  renderTabs(name);
  if (name === "arena" && !quizState.current) nextQuestion();
}

function renderTabs(activeView) {
  const tabsBar = $("tabsBar");
  if (!tabsBar) return;

  if (NAV_VIEWS.includes(activeView)) {
    tabsBar.innerHTML = NAV_VIEWS.map(
      (v) => `
        <button class="tab clickable ${v === activeView ? "active" : ""}" data-view="${v}" type="button">
          <span class="tab-icon" aria-hidden="true">C<sup>++</sup></span>
          <span class="tab-name">${VIEW_TAB_NAMES[v]}</span>
        </button>`
    ).join("");
    tabsBar.querySelectorAll("button.tab").forEach((btn) => {
      btn.addEventListener("click", () => showView(btn.dataset.view));
    });
  } else {
    const fname = VIEW_TAB_NAMES[activeView] || "view.cpp";
    tabsBar.innerHTML = `
      <span class="tab active">
        <span class="tab-icon" aria-hidden="true">C<sup>++</sup></span>
        <span class="tab-name">${fname}</span>
      </span>`;
  }
}

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
    quizState.current = null;
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

  // Keep the arena score display in sync with the live leaderboard data.
  const me = players.find((p) => p.id === currentUser?.uid);
  $("arenaScore").textContent = me ? Number(me.points) || 0 : 0;

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
//  Quiz Arena — "what does this print?" with a Hello World snippet
// ---------------------------------------------------------------------------
const HELLO_MESSAGES = [
  "Hello Dragons!",
  "Hello, World!",
  "Greetings, mortals!",
  "C++ is awesome!",
  "Welcome to the Arena!",
  "Dragons rule!",
  "Code or perish!",
  "Long live C++!",
  "May the code be with you",
  "Beware of segfaults",
  "DCSA forever!",
  "Quiz time!",
];

function pickN(arr, n, exclude) {
  const pool = arr.filter((x) => !exclude.has(x));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextQuestion() {
  const correct = HELLO_MESSAGES[Math.floor(Math.random() * HELLO_MESSAGES.length)];
  const distractors = pickN(HELLO_MESSAGES, 3, new Set([correct]));
  quizState.current = {
    correct,
    options: shuffleInPlace([correct, ...distractors]),
  };
  renderQuestion();
}

function renderQuestion() {
  const { correct, options } = quizState.current;
  $("quizCode").innerHTML = helloWorldSnippet(correct);
  $("quizFeedback").className = "feedback hidden";
  $("quizFeedback").textContent = "";
  $("quizNextBtn").classList.add("hidden");

  const labels = ["A", "B", "C", "D"];
  $("quizAnswers").innerHTML = options
    .map(
      (opt, i) => `
        <button class="answer-btn" data-option="${escapeAttr(opt)}" type="button">
          <span class="answer-btn-label">${labels[i]}</span>
          <span class="answer-btn-text">${escapeHtml(opt)}</span>
        </button>`
    )
    .join("");
  $("quizAnswers").querySelectorAll(".answer-btn").forEach((btn) => {
    btn.addEventListener("click", () => onAnswer(btn));
  });
}

// Build a VS-Dark-styled Hello World snippet with the given output message.
function helloWorldSnippet(message) {
  const msg = escapeHtml(message);
  return [
    `<span class="tk-pp">#include</span> <span class="tk-hdr">&lt;iostream&gt;</span>`,
    ``,
    `<span class="tk-kw">using</span> <span class="tk-kw">namespace</span> <span class="tk-id">std</span>;`,
    ``,
    `<span class="tk-kw">int</span> <span class="tk-fn">main</span>() {`,
    `    <span class="tk-id">cout</span> &lt;&lt; <span class="tk-str">"${msg}"</span> &lt;&lt; <span class="tk-id">endl</span>;`,
    `}`,
  ].join("\n");
}

async function onAnswer(btn) {
  const choice = btn.dataset.option;
  const correct = quizState.current.correct;
  const isCorrect = choice === correct;

  // Lock the choices and mark right/wrong.
  $("quizAnswers").querySelectorAll(".answer-btn").forEach((b) => {
    b.disabled = true;
    if (b.dataset.option === correct) b.classList.add("correct");
    else if (b === btn) b.classList.add("incorrect");
  });

  const fb = $("quizFeedback");
  if (isCorrect) {
    fb.textContent = "🎯 Correct! +1 point";
    fb.className = "feedback ok";
  } else {
    fb.textContent = `🐉 Not quite — the correct output was "${correct}"`;
    fb.className = "feedback bad";
  }

  // Award the point. Firestore rules cap the increment at +1 per write.
  if (isCorrect && currentUser) {
    try {
      await updateDoc(doc(db, "players", currentUser.uid), {
        points: increment(1),
      });
    } catch (err) {
      console.error("Failed to award point:", err);
    }
  }

  $("quizNextBtn").classList.remove("hidden");
}

// "Enter the Arena" button on the leaderboard view.
$("enterArenaBtn").addEventListener("click", () => showView("arena"));
$("quizNextBtn").addEventListener("click", nextQuestion);

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
