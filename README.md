# OGX Sprinter

AIESEC in CINEC's campaign performance tracker. Members can create a local account, submit promotional-post details, earn points, view department leaderboards, and see their profile.

## Run Locally

This is a static HTML, CSS, and JavaScript project; it has no package installation or build step.

1. Open the project folder in Visual Studio Code.
2. Start a local web server from the project root, for example with the **Live Server** extension.
3. Open `http://127.0.0.1:5500/index.html` (or the URL provided by your server).

Use the project root as the server root so page links and assets resolve correctly. On the first visit in a browser tab, the logo splash appears and then redirects to the dashboard.

## Main Pages

- `index.html` — Dashboard, overall podium and leaderboard, points chart, sign-in/sign-up modal, and member profile.
- `ogt.html` — oGT department podium and leaderboard.
- `ogv.html` — oGV department podium and leaderboard.
- `submit-post.html` — Form for submitting a social post link or title, date, and platform. A submission adds 5 points.
- `login.html` — Standalone sign-in and registration page.
- `js/splash.html` — Animated intro shown on first dashboard visit in a browser tab; it redirects back to `index.html`.

## Accounts and Demo Data

The app stores members in the browser's `localStorage` under `ogx_members` and the active session under `ogx_current_member`. When a browser has no saved members, the app initializes five sample members so the leaderboards are populated.

Demo accounts use `demo@example.com`-style addresses (for example, `maya.demo@example.com`) and the password `demo123`. They are for local demonstration only.

To test registration, open **Login / Sign Up**, switch to **Sign Up**, enter a name, email, password, and department, and optionally choose a profile photo. After account creation, the member profile appears in the modal. Profile photos are stored in browser storage as image data.

To submit a post, sign in, open **Submit Post**, complete all fields, and submit. Each new submission is saved to the member profile with its title, platform, and date, and adds 5 points.

## Project Structure

```text
assets/       Logo and image assets
css/          Shared site styles
js/script.js  Shared account, post, leaderboard, and chart logic
js/splash.html
              Animated intro page
index.html    Main dashboard and auth modal
login.html    Standalone auth page
ogt.html      oGT leaderboard
ogv.html      oGV leaderboard
submit-post.html
              Post submission form
```

## Important Limitations

This project currently has no server-side database or authentication service. Accounts, passwords, profile photos, and submissions are stored only in the current browser profile, so they do not sync across devices and can be cleared with browser storage. Passwords are stored client-side in plain text; use only throwaway demo credentials and do not deploy this implementation for real accounts without adding secure server-side authentication and storage.
