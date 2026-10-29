# PoultryVision: Setup Guide (Supabase + Git + GitHub Pages)

Do the parts in order. Part A makes login/sign-up work on your computer. Part B puts the code on GitHub. Part C makes the website live on the internet.

---

## Part A: Supabase (login, sign-up, and video storage)

### A1. Wait for the project to finish starting
Your dashboard showed **Status: Coming up...**. Wait until it says healthy/active (a minute or two) and refresh.

### A2. Copy your Project URL and key
These two values live in **different places** in the dashboard.

**Project URL** (looks like `https://xxxxxxxx.supabase.co`). Any ONE of these works:
- **Project Home page:** click the project's home icon (top of the left sidebar). The URL is shown under your project name with a **Copy** button.
- **Connect button:** the green **Connect** button at the top of the dashboard shows the Project URL and key together.
- **Integrations, Data API:** in the left sidebar under INTEGRATIONS, click **Data API**. The URL is shown there.

Use the **Copy** button instead of retyping it, because letters like `l` and `I` look the same.

**Publishable key** (starts with `sb_publishable_`):
1. Go to **Project Settings** (gear, bottom-left) then **API Keys**.
2. Stay on the tab **"Publishable and secret API keys"**.
3. In the **Publishable key** box, click the copy icon next to `default`. The key looks cut off on screen, but the copy button copies all of it.

> **Never** use the **Secret key** (the `sb_secret_...` one below it) or a legacy `service_role` key in this website. Those must stay private, and you should not post screenshots with them revealed. The publishable key is designed to be public.

### A3. Paste them into the website
Open `js/config.js` in VS Code and replace the two placeholder values:

```js
const PV_CONFIG = Object.freeze({
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx",
});
```

### A4. Turn off email confirmation (for testing)
1. In Supabase go to **Authentication** then **Configuration** then **Sign In / Providers** (older dashboards just say **Providers**) and open **Email**.
2. Make sure Email is **enabled**.
3. Turn **OFF** "Confirm email". Click **Save**.

Why: with confirmation ON, every sign-up sends an email, and Supabase's free built-in email service allows only a few emails per hour. That blocks you while testing. With it OFF, people are logged in immediately after signing up. (Turn it back ON later, ideally with your own email provider, if you want verified emails.)

### A5. Tell Supabase which website addresses are allowed
Go to **Authentication** then **Configuration** then **URL Configuration** and set:

- **Site URL**: `https://scc-maghanoy.github.io/poultryvision/` (you will have this address after Part C. You can set it now.)
- **Redirect URLs**: add all of these (click Add URL for each):
  - `http://127.0.0.1:5501/**`
  - `http://localhost:5501/**`
  - `https://scc-maghanoy.github.io/poultryvision/**`

Click **Save**. (Port 5501 comes from your `.vscode/settings.json`. Change it if you change that file.)

### A6. Configure private video storage
1. In VS Code, open `STORAGE-SETUP.sql`.
2. Copy the full SQL into Supabase Dashboard → **SQL Editor** → **New query**, then click **Run**.
3. Confirm a private bucket named `poultry-videos` appears under **Storage**. The SQL creates owner-only policies for uploading, listing and deleting videos.
4. Open **Storage → Settings** and check **Global file size limit**. The bucket SQL sets a bucket-level limit of 250 MB, but a lower global limit always takes priority.

> **Important size limit:** Supabase Free currently allows individual uploads up to 50 MB. The website validates files up to 250 MB, but a Free project will still reject files over 50 MB. A plan and global setting that support 250 MB are required for the full limit. Supabase Free currently includes 1 GB total Storage, so delete test videos when finished.

### A7. Test it on your computer
1. Open the folder in VS Code and right-click `index.html`, then choose **Open with Live Server**.
2. Click **Use the system now**. A popup should ask you to log in.
3. Create an account or log in, then click **Use the system now** again.
4. Choose an MP4, MOV or WebM chicken clip that is 30 seconds or shorter. Wait for the private Storage upload to finish; **Analyze chicken** unlocks only after upload succeeds.
5. Click **Analyze chicken**. The timed prototype sequence takes 20–60 seconds; click **See result** when it finishes.
6. Click **Delete video & analyze again** and confirm to permanently remove the clip from your Storage folder before uploading another.
7. In Supabase, check **Authentication → Users** and **Storage → poultry-videos** to see the test account and stored file. The report is a randomized UI simulation, not a real diagnosis.
---

## Part B: Put it on GitHub with Git

### B1. Install Git (once)
Download from https://git-scm.com/downloads and install with the default options. Restart VS Code afterwards. Check it worked by opening the VS Code terminal (**Terminal** then **New Terminal**, or Ctrl+`) and typing `git --version`.

### B2. Tell Git who you are (once)
```bash
git config --global user.name "Your Name"
git config --global user.email "the-email-you-used-for-github@example.com"
```

### B3. Create an empty repository on GitHub
1. Sign in to GitHub (your account: **SCC-Maghanoy**). Click the green **New** button.
2. **Repository name**: `poultryvision` (no spaces).
3. Choose **Public** (needed for free GitHub Pages).
4. Do **not** tick "Add a README", ".gitignore" or "license". Keep it empty.
5. Click **Create repository**.

### B4. Push your code
In VS Code use **File** then **Open Folder** and open the `PoultryVision-Website` folder. Then in the terminal:

```bash
git init
git add .
git commit -m "Add PoultryVision website with Supabase login"
git branch -M main
git remote add origin https://github.com/SCC-Maghanoy/poultryvision.git
git push -u origin main
```

A browser window will open the first time asking you to sign in to GitHub. Approve it. Refresh the repo page on GitHub and your files are there.

**Easier alternative inside VS Code:** open the **Source Control** panel (branch icon on the left), click **Initialize Repository**, type a message, click **Commit**, then **Publish Branch / Publish to GitHub**.

### B5. Saving future changes
Every time you change something:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

---

## Part C: Make the website live (GitHub Pages)

1. On your GitHub repo page click **Settings** then **Pages** (left menu).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Set **Branch** to `main` and the folder to `/ (root)`. Click **Save**.
4. Wait 1 to 3 minutes and refresh. GitHub shows your live address:
   `https://scc-maghanoy.github.io/poultryvision/`
5. Make sure that address is in Supabase **URL Configuration** (step A5).
6. Open the live site and repeat the test from A7.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Can't find the Project URL | It is not on the API Keys page. See step A2: Project Home, the Connect button, or Integrations > Data API. |
| Form says "Supabase is not set up yet" | Check the Project URL and publishable key in `js/config.js`. |
| Workspace says the bucket is missing | Run `STORAGE-SETUP.sql` in Supabase SQL Editor. |
| Upload says Storage permission denied | Re-run `STORAGE-SETUP.sql`, confirm the owner-only Storage policies exist, and ensure the user is signed in. |
| Supabase rejects a video larger than 50 MB | This is the current Supabase Free per-file upload cap. The project-wide limit must support 250 MB; the website cannot override a lower server limit. |
| The 30-second clip is rejected | The site reads the actual video metadata. Trim the file to 30 seconds or less and export as MP4 or WebM. |
| "Could not load the Supabase library" | You are offline, or an ad-blocker blocked `cdn.jsdelivr.net`. |
| Sign-up says "email rate limit exceeded" | Turn OFF "Confirm email" (step A4) and wait about an hour. |
| Confirmation email link goes to the wrong place | Fix **Site URL** and **Redirect URLs** in Authentication, Configuration, URL Configuration (step A5). |
| Works locally but not on GitHub Pages | Add the GitHub Pages address to Redirect URLs, and check you pushed the latest code. |
| `git push` is rejected or asks for a password | Sign in through the browser popup. Don't type your GitHub password in the terminal. |
| `remote origin already exists` | Run `git remote set-url origin https://github.com/SCC-Maghanoy/poultryvision.git` |
| Site stopped working after a quiet week | Free Supabase projects pause after about 7 days of no activity. Open the dashboard and click **Restore**. |
