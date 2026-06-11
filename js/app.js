// ===========================================================================
//  DCSA C++ Arena
//  App logic: Google sign-in, nickname capture, leaderboard, quiz arena.
// ===========================================================================

import { firebaseConfig, isConfigured } from "./firebase-config.js";
import { generateQuestion } from "./questions.js";

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

// `gen` is bumped every time a new question is loaded. It lets an in-flight
// answer handler detect that the question was swapped out from under it (e.g.
// by the focus-change anti-cheat) and bail instead of advancing on top of it.
const quizState = { current: null, wrongCount: 0, gen: 0 };

let currentViewName = null;

// The signed-in player's current point total, mirrored locally. While the
// player is in the arena the live leaderboard listener is detached (to save
// Firestore reads), so the in-arena score chip is driven from this value and
// reconciled with the authoritative server total whenever the leaderboard
// listener delivers a snapshot.
let myScore = 0;

function renderMyScore() {
  $("arenaScore").textContent = myScore;
}

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle("hidden", key !== name);
  }
  renderTabs(name);
  if (name === "arena" && !quizState.current) nextQuestion();

  currentViewName = name;

  // Reflect arena presence on the player's doc. Recomputed (rather than only
  // toggled on view transitions) so that losing focus on the arena tab —
  // switching browser tabs, minimizing, or alt-tabbing to another app — also
  // clears the flag even though the arena view is still technically open.
  refreshArenaPresence();

  // Attach the live leaderboard listener ONLY while the leaderboard is on
  // screen. A student playing in the arena doesn't need live standings, and
  // every connected listener turns each other player's points write into a
  // billed Firestore read for this client. Detaching in the arena (where
  // students spend most of their time) keeps read usage low enough for a full
  // classroom to stay on the free tier.
  if (name === "leaderboard") attachBoard();
  else teardownBoard();
}

// Whether the player is actively looking at the page right now. This is driven
// by the focus/visibility events below (see setWindowActive) rather than read
// from document.hasFocus(): hasFocus() is unreliable on mobile browsers — it
// can report false even when the tab is in the foreground — which previously
// broke both the presence tag and the anti-cheat swap on phones.
let windowActive = !document.hidden;

// The player counts as "in arena" only while they are on the arena view AND
// actively looking at it. This is what stops the "In Arena" tag from lingering
// on the leaderboard when a student opens the arena but then tabs away.
function isArenaActive() {
  return currentViewName === "arena" && windowActive;
}

function refreshArenaPresence() {
  const active = isArenaActive();
  // Only ever clear the flag if THIS device set it this session. Writing
  // `false` from a non-arena context would otherwise clobber an "in arena"
  // state owned by the same account signed in on another device.
  if (!active && lastWrittenInArena !== true) return;
  setInArenaFlag(active);
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

// Tracks the last `inArena` value we wrote to this player's Firestore doc.
// `null` means "unknown / not yet written this session" — used to force a
// reset write on first sign-in so a stale `true` from a crash gets cleared.
let lastWrittenInArena = null;

async function setInArenaFlag(value) {
  if (!currentUser) return;
  if (lastWrittenInArena === value) return; // skip redundant writes
  try {
    await updateDoc(doc(db, "players", currentUser.uid), { inArena: value });
    lastWrittenInArena = value;
  } catch (err) {
    console.error("Failed to update inArena flag:", err);
  }
}

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

// ---------------------------------------------------------------------------
//  User menu (avatar popup)
// ---------------------------------------------------------------------------
$("userMenuToggle").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = $("userMenu");
  const willOpen = menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  $("userMenuToggle").setAttribute("aria-expanded", String(willOpen));
});

// Click anywhere outside closes the menu.
document.addEventListener("click", (e) => {
  const menu = $("userMenu");
  if (menu.classList.contains("hidden")) return;
  if (!$("userChip").contains(e.target)) {
    menu.classList.add("hidden");
    $("userMenuToggle").setAttribute("aria-expanded", "false");
  }
});

// Esc closes the menu.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $("userMenu").classList.add("hidden");
    $("userMenuToggle").setAttribute("aria-expanded", "false");
  }
});

$("signOutBtn").addEventListener("click", () => {
  // Only clear the flag if we know it was set this session. Avoids the
  // wrong-overwrite race when the same account is signed in on another
  // device and currently in the arena.
  if (lastWrittenInArena === true) {
    setInArenaFlag(false).catch(() => {});
  }
  signOut(auth);
});

// Best-effort presence-clear when the player closes the tab or navigates away.
// Async writes in beforeunload are unreliable; falling back to the on-sign-in
// reset is what actually guarantees correctness.
window.addEventListener("beforeunload", () => {
  if (currentUser && lastWrittenInArena === true) {
    setInArenaFlag(false).catch(() => {});
  }
});

// Set the active/inactive state from a focus or visibility event, reacting
// only on a *real* transition. Each event type authoritatively reports the
// new state (visible/hidden, focused/blurred) rather than us polling
// document.hasFocus(), so this works on mobile where hasFocus() is unreliable.
// Switching browser tabs fires both `visibilitychange` and `blur`; the
// transition guard collapses that into a single swap.
function setWindowActive(active) {
  if (active === windowActive) return; // not a real transition — ignore
  windowActive = active;

  // Keep the leaderboard "In Arena" presence tag in sync with focus.
  refreshArenaPresence();

  // Anti-cheat: any focus transition while a question is on screen throws that
  // question away (awarding nothing) and loads a fresh one.
  //
  //   • Leaving — to screenshot or copy the question into an AI chat, or
  //     switching apps on a phone — invalidates the question they took.
  //   • Returning invalidates anything they lined up while away (e.g. reading
  //     the answer off a visible-but-unfocused arena on a second monitor, then
  //     clicking back in to answer).
  //
  // Net effect: a student can only ever answer a question that appeared while
  // the arena tab was focused.
  if (currentViewName === "arena" && quizState.current) {
    nextQuestion(); // bumps quizState.gen, cancelling any in-flight advance
    const fb = $("quizFeedback");
    fb.textContent =
      "🔄 The arena lost focus — new question loaded. No points for switching away.";
    fb.className = "feedback bad";
  }
}

// `visibilitychange` is the reliable cross-platform signal — it fires on mobile
// when switching tabs/apps or minimizing, and on desktop when switching tabs.
// Window blur/focus additionally cover the desktop case of alt-tabbing to
// another application or monitor while the tab stays visible.
document.addEventListener("visibilitychange", () => setWindowActive(!document.hidden));
window.addEventListener("blur", () => setWindowActive(false));
window.addEventListener("focus", () => setWindowActive(true));

// React to login state changes (this fires on page load too).
onAuthStateChanged(auth, async (user) => {
  currentUser = user;

  if (!user) {
    teardownBoard();
    quizState.current = null;
    lastWrittenInArena = null;
    currentViewName = null;
    myScore = 0;
    $("userChip").classList.add("hidden");
    $("arenaScoreChip").classList.add("hidden");
    showView("login");
    return;
  }

  // Show the user chip + live score in the top bar.
  $("userAvatar").src = user.photoURL || "";
  $("userName").textContent = user.displayName || user.email || "Player";
  $("userChip").classList.remove("hidden");
  $("arenaScoreChip").classList.remove("hidden");

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
// Navigating to the leaderboard view also (re)attaches the listener — see
// showView, which owns the listener lifecycle.
function enterLeaderboard() {
  showView("leaderboard");
}

// Attach the live leaderboard listener. Idempotent: a no-op if already
// attached, so re-entering the leaderboard view never stacks listeners.
function attachBoard() {
  if (unsubscribeBoard || !currentUser) return;

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

  // Reconcile the local score with the authoritative server total. This is the
  // source of truth; the in-arena chip's local increments are a stand-in while
  // the listener is detached, corrected here on return to the leaderboard.
  const me = players.find((p) => p.id === currentUser?.uid);
  myScore = me ? Number(me.points) || 0 : 0;
  renderMyScore();

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
      const arenaTag = p.inArena ? '<span class="arena-tag">In Arena</span>' : "";
      const tags = youTag + arenaTag;
      return `
        <tr class="${isYou ? "is-you" : ""}">
          <td class="col-rank"><span class="${badgeClass}">${rank}</span></td>
          <td class="col-player">
            <div class="player-cell">
              ${avatar}
              <div class="player-info">
                <span class="player-name">${escapeHtml(p.nickname || "Player")}</span>
                ${tags ? `<div class="player-tags">${tags}</div>` : ""}
              </div>
            </div>
          </td>
          <td class="col-points">${points}</td>
        </tr>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
//  Quiz Arena
// ---------------------------------------------------------------------------
const TYPE_ICONS = {
  output:   "📝",
  mistake:  "🐞",
  behavior: "🤔",
  theory:   "💡",
};
const DEFAULT_PROMPTS = {
  output:   "What does this program print?",
  mistake:  "Where is the mistake?",
  behavior: "What does this program do?",
  theory:   "",  // theory questions must provide their own prompt
};

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function nextQuestion() {
  // questions.js handles random selection across generators + static bank
  // and skips immediate repeats.
  const q = generateQuestion();
  const correctText = q.options[q.correctIndex];
  quizState.current = {
    type:    q.type,
    complex: !!q.complex,
    prompt:  q.prompt || DEFAULT_PROMPTS[q.type] || "Pick the correct answer",
    code:    q.code || "",
    options: shuffleInPlace([...q.options]),
    correct: correctText,
  };
  quizState.wrongCount = 0;
  quizState.gen += 1;
  renderQuestion();
}

function renderQuestion() {
  const { type, complex, prompt, code, options } = quizState.current;

  // Complex questions get a gold look and a badge, and are worth more points.
  const card = $("arenaCard");
  if (card) card.classList.toggle("complex-active", complex);
  const badge = $("complexBadge");
  if (badge) badge.classList.toggle("hidden", !complex);

  // Prompt with an icon — a gem for complex questions, else the type icon.
  const icon = complex ? "💎" : (TYPE_ICONS[type] || "📝");
  $("quizPrompt").textContent = `${icon} ${prompt}`;

  // Code block — hidden when the question has no code (e.g. most theory).
  const codeEl = $("quizCode");
  if (code) {
    codeEl.classList.remove("hidden");
    codeEl.innerHTML = highlightCpp(code);
  } else {
    codeEl.classList.add("hidden");
  }

  // Reset feedback.
  $("quizFeedback").className = "feedback hidden";
  $("quizFeedback").textContent = "";

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

// ---------------------------------------------------------------------------
//  C++ syntax highlighter — small tokenizer that wraps tokens in <span class="tk-*">.
//  Recognized classes match the colors defined in css/styles.css (.tk-pp, .tk-kw,
//  .tk-id, .tk-fn, .tk-str, .tk-num, .tk-hdr, .tk-cmt).
// ---------------------------------------------------------------------------
const CPP_KEYWORDS = new Set([
  "auto", "bool", "break", "case", "catch", "char", "class", "const", "continue",
  "default", "delete", "do", "double", "else", "enum", "extern", "false", "float",
  "for", "if", "int", "long", "namespace", "new", "nullptr", "private", "protected",
  "public", "return", "short", "signed", "sizeof", "static", "struct", "switch",
  "this", "throw", "true", "try", "typedef", "unsigned", "using", "virtual", "void",
  "volatile", "while",
]);
const CPP_STD = new Set([
  "std", "cout", "cin", "endl", "cerr", "string", "vector", "map", "set", "pair",
  "size_t", "NULL",
]);

function highlightCpp(code) {
  // Ordered alternatives. Each capture group corresponds to one token kind.
  const re = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(0b[01]+|0x[\da-fA-F]+|\d+\.?\d*)|(#[A-Za-z]+)|([A-Za-z_]\w*)|(\s+)|(\S)/g;

  let html = "";
  let lastWasInclude = false;
  let m;
  while ((m = re.exec(code)) !== null) {
    const [whole, lineCmt, blockCmt, str, chr, num, pp, ident, ws, other] = m;

    // Whitespace passes through and doesn't reset the #include state, so that
    // "#include   <iostream>" still recognizes the header.
    if (ws) {
      html += whole;
      continue;
    }

    if (lineCmt || blockCmt) {
      html += `<span class="tk-cmt">${escapeHtml(whole)}</span>`;
    } else if (str || chr) {
      html += `<span class="tk-str">${escapeHtml(whole)}</span>`;
    } else if (num) {
      html += `<span class="tk-num">${escapeHtml(whole)}</span>`;
    } else if (pp) {
      html += `<span class="tk-pp">${escapeHtml(whole)}</span>`;
      lastWasInclude = (pp === "#include");
      continue; // preserve the lastWasInclude flag through trailing whitespace
    } else if (ident) {
      let cls = "";
      if (CPP_KEYWORDS.has(ident)) cls = "kw";
      else if (CPP_STD.has(ident)) cls = "id";
      else {
        // Function call / declaration: identifier followed by "(".
        const after = code.slice(m.index + ident.length);
        if (/^\s*\(/.test(after)) cls = "fn";
      }
      html += cls
        ? `<span class="tk-${cls}">${escapeHtml(ident)}</span>`
        : escapeHtml(ident);
    } else if (other === "<" && lastWasInclude) {
      // Header lookahead — consume up to and including the matching ">".
      const restStart = m.index + 1;
      const rest = code.slice(restStart);
      const closeIdx = rest.indexOf(">");
      if (closeIdx >= 0) {
        const header = "<" + rest.slice(0, closeIdx + 1);
        html += `<span class="tk-hdr">${escapeHtml(header)}</span>`;
        re.lastIndex = restStart + closeIdx + 1;
      } else {
        html += escapeHtml(whole);
      }
    } else {
      html += escapeHtml(whole);
    }

    lastWasInclude = false;
  }
  return html;
}

async function onAnswer(btn) {
  if (!quizState.current || btn.disabled) return;
  const choice = btn.dataset.option;
  const correct = quizState.current.correct;
  const isCorrect = choice === correct;

  if (!isCorrect) {
    // Wrong: light up only this button red. Others stay clickable so the
    // player can keep trying until they get it right.
    btn.classList.add("incorrect");
    btn.disabled = true;
    quizState.wrongCount += 1;
    return;
  }

  // Correct: lock all buttons and highlight the chosen one green.
  btn.classList.remove("incorrect");
  btn.classList.add("correct");
  $("quizAnswers").querySelectorAll(".answer-btn").forEach((b) => {
    b.disabled = true;
  });

  // Award by tries. Complex questions are worth more (10 on the first shot);
  // normal questions give 5 / 1 / 0.
  const AWARD_BY_WRONGS = quizState.current.complex ? [10, 2, 0] : [5, 1, 0];
  const award = AWARD_BY_WRONGS[Math.min(quizState.wrongCount, AWARD_BY_WRONGS.length - 1)];

  // Save the points. Skip the write entirely when the answer earns nothing
  // (Firestore rules allow an increment of +1..10, or leaving points unchanged).
  if (currentUser && award > 0) {
    try {
      await updateDoc(doc(db, "players", currentUser.uid), {
        points: increment(award),
      });
    } catch (err) {
      console.error("Failed to award points:", err);
      const fb = $("quizFeedback");
      fb.textContent = "Could not save your points — try again";
      fb.className = "feedback bad";
      return; // don't auto-advance if the write failed
    }
    // Reflect the award on the score chip right away. In the arena the
    // leaderboard listener is detached, so without this the chip wouldn't move
    // until the player returns to the leaderboard and the snapshot reconciles.
    myScore += award;
    renderMyScore();
  }

  if (award > 0) flashScore(award);

  // Hold on the green button for a moment, then slide to the next question.
  // If the focus-change anti-cheat (or anything else) replaced the question
  // while we waited, bail so we don't advance on top of the fresh one.
  const gen = quizState.gen;
  await wait(1400);
  if (quizState.gen !== gen) return;
  await transitionToNextQuestion();
}

// Green flash on the "Score:" chip + a floating "+N" pop above it.
function flashScore(amount) {
  const chip = $("arenaScoreChip");
  if (!chip) return;

  // Remove any in-flight pop from a previous answer.
  const oldPop = chip.querySelector(".score-pop");
  if (oldPop) oldPop.remove();

  const pop = document.createElement("span");
  pop.className = "score-pop";
  pop.textContent = `+${amount}`;
  chip.appendChild(pop);

  // Restart the chip's flash animation by removing/re-adding the class.
  chip.classList.remove("score-flash");
  void chip.offsetWidth; // force reflow
  chip.classList.add("score-flash");

  setTimeout(() => {
    chip.classList.remove("score-flash");
    pop.remove();
  }, 1300);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// TikTok-style: current question slides up + fades out, new one slides in from below.
async function transitionToNextQuestion() {
  const slide = $("quizSlide");
  await slide.animate(
    [
      { transform: "translateY(0)",    opacity: 1, filter: "blur(0)" },
      { transform: "translateY(-35%)", opacity: 0, filter: "blur(4px)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }
  ).finished;

  nextQuestion();

  await slide.animate(
    [
      { transform: "translateY(40%)", opacity: 0, filter: "blur(4px)" },
      { transform: "translateY(0)",   opacity: 1, filter: "blur(0)" },
    ],
    { duration: 380, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" }
  ).finished;
}

// "Enter the Arena" button on the leaderboard view.
$("enterArenaBtn").addEventListener("click", () => showView("arena"));

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
