# FF Hub — Free Fire squad management site

A static site (works on GitHub Pages, free) for running a Free Fire clan/team:
upcoming matches & schedule, match results, prize pool & payment tracking, and
a player roster. Admins manage everything from an in-browser admin panel;
players can log in to see only their own payment history.

Data lives in **Firebase** (Firestore for data, Storage for screenshots,
Authentication for logins) — Firebase's free "Spark" plan covers this
comfortably for a clan-sized project.

---

## 1. What's in this project

```
index.html            Public overview / dashboard
schedule.html         Full match schedule (upcoming + past)
results.html          Match results with screenshots
prize-pool.html       Prize pool totals + payment status by player
roster.html           Players grouped by squad
login.html            Single login for both admins and players
admin/dashboard.html  Admin panel (add matches, results, players, teams, payments)
player/dashboard.html Player-only page: their profile + payment history
assets/css/style.css  All styling
assets/js/db.js               Firebase init + shared helper functions
assets/js/firebase-config.js  <-- put your Firebase project keys here
assets/js/nav.js       Shared sidebar navigation
assets/js/admin.js     Admin panel logic
firestore.rules        Firestore security rules (who can read/write what)
storage.rules          Storage security rules (screenshot uploads)
```

No build step, no npm install — open `index.html` in a browser or push the
folder straight to GitHub Pages.

---

## 2. Create your Firebase project (free)

1. Go to **console.firebase.google.com** → **Add project** → give it a name
   (e.g. "ff-hub") → finish the wizard (Google Analytics is optional).
2. In the project, click the **web icon (`</>`)** to register a web app.
   Name it anything, skip Firebase Hosting (you're using GitHub Pages).
3. Copy the `firebaseConfig` object it shows you.
4. Open `assets/js/firebase-config.js` in this project and paste your values
   in place of the placeholders.

### Turn on the three services you need

- **Authentication** → Sign-in method → enable **Email/Password**.
- **Firestore Database** → Create database → start in **production mode**
  (the rules file below handles access control).
- **Storage** → Get started (keep default settings).

### Publish the security rules

- Firestore → **Rules** tab → replace the contents with everything in
  `firestore.rules` from this project → **Publish**.
- Storage → **Rules** tab → replace the contents with `storage.rules` →
  **Publish**.

These rules mean: anyone can *view* matches, results, the roster and payment
status (good for transparency with players), but only an admin login can
*add or edit* anything.

---

## 3. Create your admin account

1. Firebase console → **Authentication** → **Users** → **Add user** → enter
   your email and a password. This is your admin login.
2. Copy the **User UID** shown next to the user you just created.
3. Firebase console → **Firestore Database** → **Start collection** →
   collection ID: `admins` → **Document ID: paste the UID you copied** →
   add any field, e.g. `name: "Owner"` → **Save**.

That's it — signing in with that email/password on `login.html` will now
take you to the admin panel. You can add more admins the same way.

---

## 4. Adding players with their own login

In the admin panel's **Players** tab, add a player's IGN, Free Fire UID,
squad, etc. Each player row has a **Create login** button — enter an email
and a temporary password for them, and it creates their sign-in without
logging you out of the admin panel. Give the player that email + password;
they can change nothing except sign in and view `player/dashboard.html`,
where they'll only ever see their own data.

Players you haven't created a login for still show up on the public roster
— they just won't have their own personal dashboard until you do.

---

## 5. Running it locally before you deploy

Because the pages use JavaScript modules (`type="module"`), opening
`index.html` directly via `file://` will be blocked by the browser for
security reasons. Serve the folder locally instead, e.g.:

```bash
# Python 3
python3 -m http.server 8080
# then open http://localhost:8080
```

or use the "Live Server" extension in VS Code.

---

## 6. Deploying to GitHub Pages

1. Push this whole folder to a GitHub repository.
2. Repo → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**,
   branch `main`, folder `/ (root)` → **Save**.
4. GitHub gives you a URL like `https://yourname.github.io/repo-name/` —
   that's your live site. It can take a minute to go live after the first
   push.

Because the Firebase keys in `firebase-config.js` are a public **web app**
config (not a secret key), it's safe for this file to be in a public repo —
access control is enforced by the Firestore/Storage rules, not by hiding
this file.

---

## 7. Data model (for reference / customizing)

| Collection | Fields |
|---|---|
| `admins`   | doc ID = Auth UID (existence = is admin) |
| `players`  | `ign`, `playerId` (FF UID), `teamId`, `role`, `contact`, `joinedDate`, `uid` (linked login), `loginEmail` |
| `teams`    | `name`, `tag` |
| `matches`  | `title`, `date`, `mode`, `map`, `status` (upcoming/live/completed), `teams`, `roomId`, `roomPass`, `stream` |
| `results`  | `matchId`, `matchTitle`, `date`, `totalPrize`, `placements` (array of `{position, teamName, kills, prize}`), `winnerTeam`, `notes`, `screenshotUrl` |
| `payments` | `playerId`, `uid`, `matchId`, `matchTitle`, `amount`, `status` (pending/paid), `screenshotUrl`, `date` |

---

## 8. Ideas to extend this later

- **WhatsApp/Discord webhook** on new match creation, so the squad gets
  pinged automatically (Cloud Functions would be the place for this).
- **Per-match room-code countdown** — a live timer on the schedule page
  for "room opens in".
- **CSV export** of the payments table for your own records.
- **Team logos** — add a `logoUrl` field to `teams` and display it on the
  roster page.
- **Multi-admin roles**, e.g. a "manager" who can add results but not
  payments — extend the `admins` doc with a `role` field and check it in
  the rules.

If any of these would help, or you hit an issue setting Firebase up, just
ask and this can be built out further.
