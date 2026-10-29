# PoultryVision Website

A responsive static website for a student project about observing chicken behavior. The home page now opens a login-protected video workspace instead of downloading a placeholder text file.

## What this version does

- Keeps the workspace locked until the user signs in with Supabase Auth.
- Accepts MP4, MOV, and WebM videos up to **30 seconds** and **250 MB** at the website level.
- Uploads the clip to a **private Supabase Storage bucket**, inside a folder named for the signed-in user's ID.
- Shows actual resumable-upload progress; the **Analyze chicken** button becomes active only after the upload finishes.
- Runs a timed, randomized prototype sequence (20, 30, 35, 40, 45, 50, or 60 seconds), cycles through status phrases, and then reveals a randomized sample report.
- Includes real chicken disease names as **example references only**, not diagnoses. No AI model analyzes the uploaded video.
- Requires deleting the stored clip from Supabase before another video can be uploaded. If the page is refreshed, the app checks the user's private folder and offers to delete any clip it finds.
- Uses private Storage Row Level Security policies so one signed-in user cannot list or delete another user's clips.

> **Supabase size caveat:** the website's limit is 250 MB and the setup SQL sets that bucket-level limit, but Supabase's project-wide limit takes precedence. Supabase Free currently has a 50 MB per-file limit. To accept files larger than 50 MB, the project must be on a plan and global Storage setting that support 250 MB. The total Free plan storage quota is also limited, so delete test clips when finished.

## Run it

1. Open `js/config.js` and check the Project URL and publishable key. The project values are already filled in, but use your own project's values if needed.
2. Open `STORAGE-SETUP.sql`, copy it into Supabase Dashboard → SQL Editor, and run it. This creates the private bucket and owner-only policies required for uploads, listing, and deletion.
3. In Supabase Dashboard → Storage → Settings, check the **Global file size limit**. The project-wide limit must permit 250 MB for the full website limit to work; Supabase Free currently caps uploads at 50 MB.
4. In VS Code, right-click `index.html` and choose **Open with Live Server**, or push the updated folder to the repository used by GitHub Pages.
5. Log in, click **Use the system now**, choose a supported video, wait for upload completion, then click **Analyze chicken** and **See result**. Delete the video before starting another run.

Supabase and TUS are loaded from CDNs; no build step or package installation is required. A working internet connection is required for authentication and storage.

## Project files

```text
PoultryVision-Website/
├── index.html             # Landing page, login gate, and scanner modal
├── about.html             # Project overview
├── contact.html           # Contact form demo (not connected to a backend)
├── login.html             # Supabase login
├── register.html          # Supabase sign-up
├── styles.css             # Shared site styles and responsive scanner workspace
├── main.js                # Page controllers and app composition
├── js/
│   ├── config.js           # Supabase URL, publishable key, bucket and limits
│   ├── services.js         # Supabase provider, AuthService, private Storage service
│   ├── components.js       # DOM helper, notices, validator, auth modal and navigation
│   └── scanner.js          # Video modal and randomized analysis simulator
├── assets/images/         # Website imagery
├── STORAGE-SETUP.sql       # Private bucket and RLS policies
├── SETUP-GUIDE.md          # Supabase, Git, and GitHub Pages steps
└── README.md
```

## OOP design used here

- **Encapsulation:** `SupabaseClientProvider`, `AuthService`, `SupabaseVideoStorageService`, `ChickenScannerModal`, and `ChickenAnalysisSimulator` use private fields for internal state. The page controllers call public methods instead of manipulating the Supabase client directly.
- **Abstraction:** `PageController` defines shared page behavior and hook methods (`onReady`, `onAuthChanged`). `AuthPageController` defines the shared account-form workflow while requiring child classes to supply validation and submission behavior.
- **Inheritance:** Home, About, Contact, Login, and Register controllers reuse the shared `PageController`; Login and Register extend `AuthPageController`.
- **Polymorphism:** `PageControllerFactory` chooses a concrete controller for the active page. Overridden `getPageKey`, `onAuthChanged`, `getValidator`, and `submit` methods let the common lifecycle call the appropriate page-specific behavior.
- **Composition / dependency injection:** `HomePageController` uses `AuthService`, `SupabaseVideoStorageService`, `AuthModal`, and `ChickenScannerModal`. `ChickenScannerModal` uses the simulator and storage service without needing to know the underlying Supabase setup.

These patterns match actual responsibilities in the website; there is no extra inheritance layer just to demonstrate OOP.

## Important notes

- The randomized report is a **simulation**, not a veterinary tool. The status and example condition are selected at random and are not inferred from the clip. Do not use the result to make animal-health or food-safety decisions.
- The bucket is private. Keep the SQL policies enabled, and never place a Supabase `service_role` or secret key in `js/config.js` or any browser code.
- Deletion calls Supabase Storage's remove operation for the selected user's own object(s). Supabase usage dashboards may not update immediately, and storage quota reporting is measured over time.
- The contact form remains a front-end demo and sends nothing.
