# DCSA C++ Arena 🐉

A simple, mobile-friendly website for a C++ quiz game with a live leaderboard.

**This first step delivers:**

1. **Sign in with Google (Gmail)** — students log in with their Google account.
2. **Choose a nickname** — a single text field; this is their leaderboard name.
3. **Live leaderboard** — a table of all players, everyone starting at **0 points**, updating in real time and sorted highest-first.

It's built as a plain static site (HTML/CSS/JavaScript) using **Firebase** for Google login and the leaderboard database. There is **no build step** — the files run as-is in any browser.

```
CPPGame/
├── index.html              ← the page (3 screens: login, nickname, leaderboard)
├── css/styles.css          ← responsive styling (looks good on phone + desktop)
├── js/
│   ├── app.js              ← all the logic
│   └── firebase-config.js  ← ⚠️ paste your Firebase keys here
├── firebase.json           ← hosting + Firestore config
├── firestore.rules         ← database security rules (anti-cheat)
└── README.md
```

---

## One-time setup (about 10 minutes)

You need a free Firebase project. You only do this once.

### 1. Create a Firebase project
1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. Click **Add project**, give it a name (e.g. `dragon-cpp-quiz`), and accept the defaults. (You can disable Google Analytics — not needed.)

### 2. Register a Web app
1. On the project overview page, click the **`</>`** (Web) icon.
2. Give it a nickname (e.g. `quiz-web`) and click **Register app**.
3. Firebase shows you a `firebaseConfig = { ... }` block. **Copy those values** into [`js/firebase-config.js`](js/firebase-config.js), replacing the `YOUR_...` placeholders.

### 3. Turn on Google sign-in
1. In the left menu: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab, click **Google**, toggle **Enable**, pick a support email, and **Save**.

### 4. Create the leaderboard database
1. In the left menu: **Build → Firestore Database → Create database**.
2. Choose a location near you and start in **Production mode**.
3. After it's created, publish the security rules from this repo (see step 6), or temporarily start in test mode while developing.

### 5. Authorize your domains (for login to work)
In **Authentication → Settings → Authorized domains**, make sure these are listed (Firebase usually adds them automatically):
- `localhost` (for local testing)
- `your-project-id.web.app` and `your-project-id.firebaseapp.com` (added when you deploy hosting)

---

## Running it locally

Because the app uses JavaScript modules, open it through a local web server (not by double-clicking the file).

**Option A — Python (already on most machines):**
```powershell
cd path\to\CPPGame
python -m http.server 5500
```
Then open <http://localhost:5500> in your browser.

**Option B — VS Code:** install the *Live Server* extension and click **Go Live**.

---

## Deploying it to the internet (free)

Firebase Hosting gives you a free public URL like `https://your-project-id.web.app`.

```powershell
# Install the Firebase tools once (needs Node.js installed):
npm install -g firebase-tools

# Sign in and link this folder to your project:
firebase login
firebase use --add        # pick the project you created

# Publish the leaderboard security rules + the site:
firebase deploy
```

After deploying, share the `.web.app` URL with your students — it works on any phone or laptop.

> **Tip:** `firebase deploy --only hosting` re-publishes just the website;
> `firebase deploy --only firestore:rules` re-publishes just the database rules.

### Automatic deploys (already set up)

This repo auto-deploys on every push to `main` via GitHub Actions
([`.github/workflows/firebase-deploy.yml`](.github/workflows/firebase-deploy.yml)).

```
edit code  →  git push to main  →  GitHub Actions deploys  →  https://dcsa-cpp-game.web.app
```

So the normal workflow is just: **commit and push.** No manual `firebase deploy` needed.

How it's wired: a Firebase CI token (from `firebase login:ci`) is stored as a
GitHub repository secret named **`FIREBASE_TOKEN`** (Settings → Secrets and
variables → Actions). The workflow reads it to authenticate the deploy. If you
ever rotate the token, regenerate it and update that secret.

You can still deploy by hand anytime with `firebase deploy --only hosting`, and
you can trigger the workflow manually from the repo's **Actions** tab
(**Run workflow**).

---

## How the data works

- Each player is one document in the `players` collection, keyed by their Google account ID.
- Fields: `nickname`, `email`, `photoURL`, `points` (starts at `0`), `createdAt`.
- The leaderboard reads all players ordered by `points` descending, live.

### Awarding points (next step)
The security rules in [`firestore.rules`](firestore.rules) **stop students from editing their own points** — so nobody can cheat. To award points you (the teacher) can, for now:
- Open **Firestore Database** in the Firebase console and edit a player's `points` field by hand, **or**
- Wait for the next step, where the quiz itself will award points through a trusted path.

---

## What's next (roadmap)
- [ ] Quiz screens with C++ questions grouped by topic
- [ ] Awarding points automatically for correct answers
- [ ] Per-topic progress for each student
- [ ] Teacher view to add/edit questions

---

### Troubleshooting
- **"Firebase setup needed" message** → you haven't filled in `js/firebase-config.js` yet.
- **Login popup closes with an error** → check that Google sign-in is enabled (step 3) and your domain is authorized (step 5).
- **Leaderboard is empty after signing in** → that's expected until at least one player picks a nickname; you should see yourself appear immediately.