/*
 * Service classes: they do the "work" (talking to Supabase, building the download)
 * and know nothing about buttons or pages. The page controllers in main.js use them.
 */

/**
 * AuthService wraps the Supabase client so the rest of the site never touches it directly.
 * (Encapsulation: the client and session are private. Everyone else uses the public methods.)
 *
 * Every action returns a small result object: { ok: true, ... } or { ok: false, message }.
 */
class AuthService {
  #client = null;
  #session = null;
  #listeners = new Set();
  #configured = false;

  constructor(config) {
    const urlLooksValid = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config?.SUPABASE_URL ?? "");
    const keyLooksValid = Boolean(config?.SUPABASE_KEY) && !config.SUPABASE_KEY.startsWith("PASTE_");
    this.#configured = urlLooksValid && keyLooksValid;

    if (this.#configured && window.supabase?.createClient) {
      this.#client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
    }
  }

  /** True when config.js has real values. */
  get isConfigured() {
    return this.#configured;
  }

  /** True when the Supabase client is actually ready to use (configured AND the library loaded). */
  get isAvailable() {
    return this.#client !== null;
  }

  get user() {
    return this.#session?.user ?? null;
  }

  get isLoggedIn() {
    return this.user !== null;
  }

  get displayName() {
    const user = this.user;
    if (!user) return "";
    return user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "friend");
  }

  /** Restore any saved login and start listening for login/logout changes. */
  async init() {
    if (!this.#client) return;
    try {
      const { data } = await this.#client.auth.getSession();
      this.#session = data.session;
    } catch {
      this.#session = null;
    }
    // Keep this callback tiny and synchronous. Supabase recommends not awaiting inside it.
    this.#client.auth.onAuthStateChange((_event, session) => {
      this.#session = session;
      this.#notify();
    });
  }

  /** Register a function to run whenever the user logs in or out. Returns an "unsubscribe" function. */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #notify() {
    this.#listeners.forEach((listener) => listener(this.user));
  }

  async signUp({ name, email, password }) {
    if (!this.#client) return this.#unavailable();
    try {
      const { data, error } = await this.#client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          // Where the "confirm your email" link sends people. Must be allowed in Supabase -> Auth -> URL Configuration.
          emailRedirectTo: new URL("login.html", window.location.href).href,
        },
      });
      if (error) return { ok: false, message: this.#explain(error) };

      // When "Confirm email" is ON, Supabase hides whether an email already exists
      // by returning a fake user with no identities. Detect that case.
      if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
        return { ok: false, message: "An account with this email already exists. Try logging in instead." };
      }
      return { ok: true, needsConfirmation: !data.session };
    } catch {
      return this.#networkError();
    }
  }

  async signIn({ email, password }) {
    if (!this.#client) return this.#unavailable();
    try {
      const { error } = await this.#client.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: this.#explain(error) };
      return { ok: true };
    } catch {
      return this.#networkError();
    }
  }

  async signOut() {
    if (!this.#client) return { ok: true };
    try {
      const { error } = await this.#client.auth.signOut();
      return error ? { ok: false, message: this.#explain(error) } : { ok: true };
    } catch {
      return this.#networkError();
    }
  }

  #unavailable() {
    const message = this.#configured
      ? "Could not load the Supabase library. Check your internet connection and refresh the page."
      : "Supabase is not set up yet. Open js/config.js and paste in your Project URL and Publishable key.";
    return { ok: false, message };
  }

  #networkError() {
    return { ok: false, message: "Could not reach the server. Check your internet connection and try again." };
  }

  /** Turn Supabase's technical errors into messages a normal person can understand. */
  #explain(error) {
    const code = error.code ?? "";
    const text = (error.message ?? "").toLowerCase();

    if (code === "invalid_credentials" || text.includes("invalid login credentials")) return "Incorrect email or password.";
    if (code === "email_not_confirmed" || text.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the confirmation link.";
    if (code === "user_already_exists" || text.includes("already registered")) return "An account with this email already exists. Try logging in instead.";
    if (code === "weak_password") return "That password is too weak. Try a longer one with a mix of letters and numbers.";
    if (code.includes("rate_limit") || text.includes("rate limit")) return "Too many attempts right now. Please wait a few minutes and try again.";
    return error.message || "Something went wrong. Please try again.";
  }
}

/**
 * DownloadService is an "abstract" parent class using the Template Method pattern:
 * download() is the fixed recipe, and child classes fill in the details.
 * Today we use DemoTextDownloadService. When your real scanner exists, write a new
 * child class (for example ScannerInstallerDownloadService) and swap it in inside main.js.
 */
class DownloadService {
  get fileName() {
    throw new Error("Child classes must provide a fileName.");
  }

  get mimeType() {
    return "application/octet-stream";
  }

  buildContent(_user) {
    throw new Error("Child classes must provide buildContent().");
  }

  /** Builds the file in the browser and triggers a normal "Save as" download. Returns the file name. */
  download(user) {
    const blob = new Blob([this.buildContent(user)], { type: this.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = this.fileName;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return this.fileName;
  }
}

/** Placeholder download: a random text file that proves the login-protected download works. */
class DemoTextDownloadService extends DownloadService {
  static #FACTS = [
    "Chickens form a social 'pecking order' that decides who eats and rests first.",
    "A healthy hen often lays about one egg every 24 to 26 hours.",
    "Chickens see more colors than people do, including ultraviolet light.",
    "Chickens use different alarm calls for different kinds of predators.",
    "Chicks start communicating with their mother hen before they even hatch.",
  ];

  #referenceCode = DemoTextDownloadService.#makeReferenceCode();

  get fileName() {
    return "PoultryVision-demo-download.txt";
  }

  get mimeType() {
    return "text/plain;charset=utf-8";
  }

  buildContent(user) {
    const fact = DemoTextDownloadService.#FACTS[Math.floor(Math.random() * DemoTextDownloadService.#FACTS.length)];
    return [
      "==============================================",
      "  PoultryVision - Demo Download",
      "==============================================",
      "",
      `Downloaded by : ${user?.email ?? "unknown user"}`,
      `Date          : ${new Date().toLocaleString()}`,
      `Reference code: ${this.#referenceCode}`,
      "",
      "If you can read this, your login works and the download button is protected correctly.",
      "This file is only a placeholder. The real Chicken Scanner system is still in development.",
      "",
      `Random chicken fact: ${fact}`,
      "",
      "PoultryVision is informational support only. It is not a veterinary diagnosis.",
      "",
    ].join("\n");
  }

  static #makeReferenceCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += letters[Math.floor(Math.random() * letters.length)];
    return `PV-${code}`;
  }
}
