/*
 * PoultryVision website interactions.
 *
 * Load order on every page (see the <script> tags in each HTML file):
 *   supabase library -> js/config.js -> js/services.js -> js/components.js -> main.js
 *
 * This file holds the PAGE CONTROLLERS: one object per page, built from a shared parent class.
 *
 *   PageController                  shared: menu, footer year, login state, notices
 *   |-- HomePageController          protects the download button
 *   |-- AboutPageController
 *   |-- DemoFormController          form that is not connected to anything yet
 *   |   `-- ContactPageController
 *   `-- AuthPageController          shared login/sign-up form logic (abstract)
 *       |-- LoginPageController
 *       `-- RegisterPageController
 */

class PageController {
  #pageKey;
  #menuButton;
  #navigation;
  #notice;
  #auth;
  #authNav;
  #downloads;

  constructor(pageKey, auth, downloads = null) {
    this.#pageKey = pageKey;
    this.#auth = auth;
    this.#downloads = downloads;
    this.#menuButton = document.querySelector("[data-menu-toggle]");
    this.#navigation = document.querySelector("[data-navigation]");
    this.#notice = new Notice(document.querySelector("[data-site-notice]"));
    this.#authNav = new AuthNav(document.querySelector("[data-auth-slot]"), () => this.handleLogout());
  }

  // Child classes override these when they need page-specific behavior.
  onReady() {}
  onAuthChanged(_user) {}

  getPageKey() {
    return this.#pageKey;
  }

  // Child classes can read the services through these getters (private fields themselves stay private).
  get auth() {
    return this.#auth;
  }

  get downloads() {
    return this.#downloads;
  }

  async init() {
    this.#setupNavigation();
    this.#setFooterYear();
    this.#syncAuthState(); // show the logged-out state straight away
    this.onReady();

    await this.#auth.init(); // restore a saved login, if any
    this.#auth.subscribe(() => this.#syncAuthState());
    this.#syncAuthState();
  }

  #syncAuthState() {
    const user = this.#auth.user;
    document.body.dataset.auth = user ? "in" : "out";
    this.#authNav.render(user, this.#auth.displayName);
    this.#markCurrentPage();
    this.onAuthChanged(user);
  }

  #setupNavigation() {
    if (!this.#menuButton || !this.#navigation) return;

    this.#menuButton.addEventListener("click", () => {
      const isOpen = this.#menuButton.getAttribute("aria-expanded") === "true";
      this.#menuButton.setAttribute("aria-expanded", String(!isOpen));
      this.#navigation.classList.toggle("is-open", !isOpen);
    });

    // One listener on the whole menu (event delegation) so it also covers links added later.
    this.#navigation.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) {
        this.#menuButton.setAttribute("aria-expanded", "false");
        this.#navigation.classList.remove("is-open");
      }
    });
  }

  #setFooterYear() {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  #markCurrentPage() {
    const pageKey = this.getPageKey();
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.dataset.nav === pageKey) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  showNotice(message, options) {
    this.#notice.show(message, options);
  }

  async handleLogout() {
    const result = await this.#auth.signOut();
    if (result.ok) this.showNotice("You have been logged out.");
    else this.showNotice(result.message, { type: "error" });
  }

  // Reusable form behavior for forms that are visual demos and not connected to a backend yet.
  handleDemoForm(formSelector, message) {
    const form = document.querySelector(formSelector);
    if (!form) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formNotice = form.querySelector("[data-form-notice]");
      if (formNotice) {
        formNotice.textContent = message;
        formNotice.hidden = false;
      } else {
        this.showNotice(message);
      }
    });
  }
}

class HomePageController extends PageController {
  #downloadButtons = [];
  #modal = new AuthModal({ redirectTo: "index.html#download" });

  constructor(auth, downloads) {
    super("home", auth, downloads);
  }

  getPageKey() {
    return "home";
  }

  // Overrides PageController.onReady() to protect the download buttons.
  onReady() {
    this.#downloadButtons = Array.from(document.querySelectorAll("[data-download-system]"));
    this.#downloadButtons.forEach((button) => {
      button.addEventListener("click", () => this.#handleDownloadClick());
    });
  }

  // Overrides PageController.onAuthChanged() to update the hint text under the download button.
  onAuthChanged(user) {
    document.querySelectorAll("[data-download-hint]").forEach((element) => {
      element.textContent = user ? `Signed in as ${user.email}. You can download now.` : "Free account required to download.";
    });
    if (user && this.#modal.isOpen) this.#modal.close();
  }

  #handleDownloadClick() {
    if (!this.auth.isLoggedIn) {
      this.#modal.open(); // not logged in: show the popup instead of downloading
      return;
    }
    const fileName = this.downloads.download(this.auth.user);
    this.showNotice(`Your download has started: ${fileName}`, { type: "success" });
  }
}

class AboutPageController extends PageController {
  constructor(auth) {
    super("about", auth);
  }

  getPageKey() {
    return "about";
  }
}

class DemoFormController extends PageController {
  #formSelector;

  constructor(pageKey, formSelector, auth) {
    super(pageKey, auth);
    this.#formSelector = formSelector;
  }

  onReady() {
    this.handleDemoForm(this.#formSelector, this.getSubmissionNotice());
  }

  // Child classes override this method to show an accurate message for each form.
  getSubmissionNotice() {
    return "This form is a front-end demo and is not connected to a service yet. Nothing has been sent.";
  }
}

class ContactPageController extends DemoFormController {
  constructor(auth) {
    super("contact", "[data-contact-form]", auth);
  }

  getPageKey() {
    return "contact";
  }

  // Overrides DemoFormController.getSubmissionNotice().
  getSubmissionNotice() {
    return "Thanks for testing the contact form. Messaging is not connected yet, so your message was not sent.";
  }
}

/**
 * Shared logic for the Log in and Sign up pages: reading the form, validating,
 * showing a "please wait" state, showing errors, and redirecting after success.
 * Child classes only provide the two things that differ: getValidator() and submit().
 */
class AuthPageController extends PageController {
  static #ALLOWED_REDIRECT = /^(index|about|contact)\.html(#[\w-]+)?$/;

  #form = null;
  #formNotice = null;
  #submitButton = null;
  #submitLabel = "";
  #redirecting = false;

  onReady() {
    this.#form = document.querySelector("[data-account-form]");
    if (!this.#form) return;

    this.#formNotice = this.#form.querySelector("[data-form-notice]");
    this.#submitButton = this.#form.querySelector("[type='submit']");
    this.#submitLabel = this.#submitButton?.textContent ?? "";
    this.#form.addEventListener("submit", (event) => this.#handleSubmit(event));

    // Keep the ?redirect=... part when jumping between Log in and Create account.
    const switchLink = document.querySelector("[data-auth-switch]");
    if (switchLink && window.location.search) switchLink.search = window.location.search;

    if (!this.auth.isConfigured) {
      this.showFormMessage("Supabase is not set up yet. Open js/config.js and paste in your Project URL and Publishable key.", "warning");
    }
  }

  // Abstract methods: child classes MUST override these.
  getValidator() {
    throw new Error("Child classes must provide a FormValidator.");
  }

  async submit(_values) {
    throw new Error("Child classes must implement submit().");
  }

  // Optional hook for child classes.
  onSuccess(_result, _values) {}

  // Overrides PageController.onAuthChanged(): if someone is logged in, this page is no longer useful to them.
  onAuthChanged(user) {
    if (user) this.#redirectAway();
  }

  collectValues() {
    const data = new FormData(this.#form);
    return {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };
  }

  showFormMessage(message, type = "info") {
    if (!this.#formNotice) return;
    this.#formNotice.textContent = message;
    this.#formNotice.dataset.type = type;
    this.#formNotice.hidden = false;
  }

  async #handleSubmit(event) {
    event.preventDefault();
    const values = this.collectValues();

    const problems = this.getValidator().validate(values);
    if (problems.length > 0) {
      this.showFormMessage(problems[0], "error");
      return;
    }

    this.#setBusy(true);
    const result = await this.submit(values);
    this.#setBusy(false);

    if (!result.ok) {
      this.showFormMessage(result.message, "error");
      return;
    }
    this.onSuccess(result, values);
  }

  #setBusy(isBusy) {
    if (!this.#submitButton) return;
    this.#submitButton.disabled = isBusy;
    this.#submitButton.textContent = isBusy ? "Please wait..." : this.#submitLabel;
  }

  #redirectAway() {
    if (this.#redirecting) return;
    this.#redirecting = true;
    window.location.replace(this.#destination());
  }

  // Only allow redirects to our own pages (stops "open redirect" tricks).
  #destination() {
    const requested = new URLSearchParams(window.location.search).get("redirect") ?? "";
    return AuthPageController.#ALLOWED_REDIRECT.test(requested) ? requested : "index.html";
  }
}

class LoginPageController extends AuthPageController {
  constructor(auth) {
    super("login", auth);
  }

  getPageKey() {
    return "login";
  }

  getValidator() {
    return new FormValidator()
      .addRule("email", FormValidator.isEmail, "Enter a valid email address.")
      .addRule("password", (value) => value.length > 0, "Enter your password.");
  }

  submit(values) {
    return this.auth.signIn(values);
  }

  onSuccess() {
    this.showFormMessage("Logged in! Taking you back...", "success");
  }
}

class RegisterPageController extends AuthPageController {
  constructor(auth) {
    super("register", auth);
  }

  getPageKey() {
    return "register";
  }

  getValidator() {
    return new FormValidator()
      .addRule("name", (value) => value.length >= 2, "Enter your full name.")
      .addRule("email", FormValidator.isEmail, "Enter a valid email address.")
      .addRule("password", (value) => value.length >= 8, "Your password needs at least 8 characters.")
      .addRule("confirmPassword", (value, all) => value === all.password, "The two passwords do not match.");
  }

  submit(values) {
    return this.auth.signUp(values);
  }

  // Overrides the hook: if email confirmation is turned on, the user must check their inbox first.
  onSuccess(result, values) {
    if (result.needsConfirmation) {
      this.showFormMessage(`Account created! We sent a confirmation link to ${values.email}. Click it, then log in.`, "success");
    } else {
      this.showFormMessage("Account created! Taking you back...", "success");
    }
  }
}

/** Factory: picks the right controller for the current page (polymorphism in action). */
class PageControllerFactory {
  static create(pageKey, auth, downloads) {
    switch (pageKey) {
      case "about":
        return new AboutPageController(auth);
      case "contact":
        return new ContactPageController(auth);
      case "login":
        return new LoginPageController(auth);
      case "register":
        return new RegisterPageController(auth);
      case "home":
      default:
        return new HomePageController(auth, downloads);
    }
  }
}

// Start-up: build the shared services once, then hand them to the page's controller.
const authService = new AuthService(PV_CONFIG);
const downloadService = new DemoTextDownloadService(); // swap for a real DownloadService child class later
const pageController = PageControllerFactory.create(document.body.dataset.page || "home", authService, downloadService);
pageController.init();
