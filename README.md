# PoultryVision Website

A responsive, no-framework website for a student project about scanning chicken behavior and helping farmers notice changes in flock activity.

**New in this version:** real login and sign-up using **Supabase**, and a **login-protected download**. If someone who is not logged in presses a download button, a popup asks them to log in or create an account. Once logged in, the button downloads a placeholder `.txt` file. (The real scanner is not finished yet.)

> **Start here:** read [`SETUP-GUIDE.md`](SETUP-GUIDE.md) for step-by-step Supabase, Git and GitHub Pages instructions.

## Run it

1. Paste your Supabase Project URL and publishable key into `js/config.js`. See the guide, Part A (the URL and the key are in different places in the dashboard).
2. In VS Code, right-click `index.html` then **Open with Live Server**.

There is nothing to install. The Supabase library loads from a CDN.

## Project files

```text
PoultryVision-Website/
├── index.html         # Landing page + protected download buttons
├── about.html         # Project overview and team roles
├── contact.html       # Contact form mockup (not connected to anything yet)
├── login.html         # Real log in form
├── register.html      # Real sign-up form
├── styles.css         # Shared responsive styles
├── main.js            # Page controllers (one class per page)
├── js/
│   ├── config.js      # YOUR Supabase URL + publishable key go here
│   ├── services.js    # AuthService, DownloadService, DemoTextDownloadService
│   └── components.js  # Dom, Notice, FormValidator, AuthModal, AuthNav
├── assets/images/
├── SETUP-GUIDE.md     # Supabase + Git + GitHub Pages guide
└── README.md
```

Script order on every page matters: Supabase library, then `config.js`, `services.js`, `components.js`, `main.js`.

## Where the OOP is

### Class map

```text
SERVICES (js/services.js)            COMPONENTS (js/components.js)
AuthService                          Dom           (static helpers)
DownloadService  (abstract)          Notice
└── DemoTextDownloadService          FormValidator
                                     AuthModal
CONTROLLERS (main.js)                AuthNav
PageController
├── HomePageController
├── AboutPageController
├── DemoFormController
│   └── ContactPageController
└── AuthPageController  (abstract)
    ├── LoginPageController
    └── RegisterPageController

PageControllerFactory  (picks the right controller for the page)
```

### OOP ideas and where to find them

- **Encapsulation:** `AuthService` keeps the Supabase client and session in `#private` fields. Nothing else can touch them. Controllers use public methods (`signIn`, `signUp`, `signOut`, `user`).
- **Inheritance:** every page controller `extends PageController` to reuse the menu, footer year, login state and notices. `LoginPageController` and `RegisterPageController` also extend `AuthPageController` to share all form-handling code.
- **Abstraction / abstract methods:** `AuthPageController.getValidator()` and `submit()` and `DownloadService.buildContent()` are meant to be overridden, and throw an error if they are not.
- **Polymorphism:** the page calls `submit(values)` and `onAuthChanged(user)` without knowing which child class it is. Login signs in, Register signs up, Home updates the download hint.
- **Template Method pattern:** `DownloadService.download()` is the fixed recipe (build file, save it). Child classes only supply the file name and contents.
- **Composition:** a controller *has* an `AuthService`, a `Notice`, an `AuthNav` and (on Home) an `AuthModal`.
- **Dependency injection:** `main.js` creates `AuthService` and the download service once and passes them into the controller. To use a real installer later, write a new `DownloadService` child class and swap one line at the bottom of `main.js`.
- **Factory pattern:** `PageControllerFactory.create()` chooses the controller from `data-page` on `<body>`.
- **Static members:** `FormValidator.isEmail()`, `Dom.create()`, `DemoTextDownloadService`'s private fact list.

## How the protected download works

1. Download buttons have `data-download-system`. `HomePageController` listens for clicks.
2. Not logged in: `AuthModal` opens (Log in / Create an account). Those links carry `?redirect=index.html#download` so the user comes back to the download afterwards. Only the site's own pages are accepted as redirect targets.
3. Logged in: `DemoTextDownloadService.download(user)` builds a text file in the browser and saves it.
4. The page's `<body data-auth="in|out">` switches the button between a lock icon and a download icon.

## Important honesty notes

- **The download gate is a front-end gate.** It stops normal users, but a technical person could still reach any file you place publicly on the website. When you have a real installer, store it in **Supabase Storage** in a private bucket and only hand out signed links to logged-in users. Don't just drop the file into this repository.
- The publishable key in `config.js` is meant to be public. Never put the **secret** or **service_role** key anywhere in this project.
- The contact form is still a demo and sends nothing.
- The site describes behavior monitoring as a planned support tool, not a veterinary diagnosis.

## Next steps

1. Replace the team role placeholders in `about.html` with real names.
2. Make the contact form real by saving messages to a Supabase table (with Row Level Security).
3. When the scanner exists: private Supabase Storage bucket plus a new `DownloadService` child class.
4. Optional: log each download in a Supabase table.
