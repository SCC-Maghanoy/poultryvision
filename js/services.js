/*
 * Application services for PoultryVision.
 * Services own the business rules and keep UI controllers away from Supabase details.
 */

/**
 * Owns the single Supabase client shared by authentication and video storage.
 * This keeps configuration and client creation in one place.
 */
class SupabaseClientProvider {
  #client = null;
  #configured = false;
  #projectUrl = "";
  #publishableKey = "";

  constructor(config) {
    this.#projectUrl = String(config?.SUPABASE_URL ?? "").trim().replace(/\/$/, "");
    this.#publishableKey = String(config?.SUPABASE_KEY ?? "").trim();
    const urlLooksValid = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(this.#projectUrl);
    const keyLooksValid = Boolean(this.#publishableKey) && !this.#publishableKey.startsWith("PASTE_");
    this.#configured = urlLooksValid && keyLooksValid;

    if (this.#configured && window.supabase?.createClient) {
      this.#client = window.supabase.createClient(this.#projectUrl, this.#publishableKey);
    }
  }

  get client() { return this.#client; }
  get isConfigured() { return this.#configured; }
  get isAvailable() { return this.#client !== null; }
  get projectUrl() { return this.#projectUrl; }
  get publishableKey() { return this.#publishableKey; }
}

/**
 * AuthService wraps Supabase Auth. Private fields protect the session and listeners;
 * the rest of the website interacts through these public methods and getters.
 */
class AuthService {
  #client = null;
  #session = null;
  #listeners = new Set();
  #configured = false;
  #authListenerStarted = false;

  constructor(clientProvider) {
    this.#client = clientProvider?.client ?? null;
    this.#configured = Boolean(clientProvider?.isConfigured);
  }

  get isConfigured() { return this.#configured; }
  get isAvailable() { return this.#client !== null; }
  get user() { return this.#session?.user ?? null; }
  get isLoggedIn() { return this.user !== null; }

  get displayName() {
    const user = this.user;
    if (!user) return "";
    return user.user_metadata?.full_name || (user.email ? user.email.split("@")[0] : "friend");
  }

  /** Restore any saved login and subscribe to future login/logout changes. */
  async init() {
    if (!this.#client) return;
    try {
      const { data } = await this.#client.auth.getSession();
      this.#session = data.session;
    } catch {
      this.#session = null;
    }

    if (!this.#authListenerStarted) {
      this.#authListenerStarted = true;
      // Keep this callback synchronous; Supabase advises against awaiting inside it.
      this.#client.auth.onAuthStateChange((_event, session) => {
        this.#session = session;
        this.#notify();
      });
    }
  }

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
          emailRedirectTo: new URL("login.html", window.location.href).href,
        },
      });
      if (error) return { ok: false, message: this.#explain(error) };
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

  #explain(error) {
    const code = error.code ?? "";
    const message = (error.message ?? "").toLowerCase();
    if (code === "invalid_credentials" || message.includes("invalid login credentials")) return "Incorrect email or password.";
    if (code === "email_not_confirmed" || message.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the confirmation link.";
    if (code === "user_already_exists" || message.includes("already registered")) return "An account with this email already exists. Try logging in instead.";
    if (code === "weak_password") return "That password is too weak. Try a longer one with a mix of letters and numbers.";
    if (code.includes("rate_limit") || message.includes("rate limit")) return "Too many attempts right now. Please wait a few minutes and try again.";
    return error.message || "Something went wrong. Please try again.";
  }
}

/**
 * Encapsulates private Storage bucket operations. Every object is placed in a folder
 * named after its owner's Supabase user ID; Storage RLS policies enforce ownership.
 */
class SupabaseVideoStorageService {
  #client = null;
  #provider = null;
  #bucket;

  constructor(clientProvider, bucketName = "poultry-videos") {
    this.#provider = clientProvider;
    this.#client = clientProvider?.client ?? null;
    this.#bucket = bucketName;
  }

  get isAvailable() { return this.#client !== null; }
  get bucketName() { return this.#bucket; }

  async listUserVideos(userId) {
    if (!this.#client) return this.#unavailable();
    if (!userId) return { ok: false, message: "Please log in before managing stored videos." };
    try {
      const { data, error } = await this.#client.storage.from(this.#bucket).list(userId, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) return { ok: false, message: this.#explain(error) };
      const files = (data ?? [])
        .filter((entry) => entry?.id && entry?.name && entry.name !== ".emptyFolderPlaceholder")
        .map((entry) => ({
          name: entry.name,
          path: `${userId}/${entry.name}`,
          size: Number(entry.metadata?.size ?? 0),
          createdAt: entry.created_at ?? null,
        }));
      return { ok: true, files };
    } catch (error) {
      return { ok: false, message: this.#explain(error) };
    }
  }

  /** Upload with TUS resumable upload so large clips report real upload progress. */
  async uploadVideo(userId, file, onProgress = () => {}) {
    if (!this.#client) return this.#unavailable();
    if (!userId) return { ok: false, message: "Your login session expired. Please log in again." };
    if (!window.tus?.Upload) {
      return { ok: false, message: "The resumable-upload library could not load. Refresh the page and try again." };
    }

    try {
      const { data, error } = await this.#client.auth.getSession();
      if (error || !data?.session?.access_token) {
        return { ok: false, message: "Your login session expired. Please log in again." };
      }

      const projectHost = new URL(this.#provider.projectUrl).hostname;
      const projectRef = projectHost.split(".")[0];
      const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
      const safeName = String(file.name || "chicken-video.mp4")
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(-80) || "chicken-video.mp4";
      const uniquePart = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const objectPath = `${userId}/${uniquePart}-${safeName}`;

      return await new Promise((resolve) => {
        let settled = false;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        const upload = new window.tus.Upload(file, {
          endpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${data.session.access_token}`,
            apikey: this.#provider.publishableKey,
          },
          metadata: {
            bucketName: this.#bucket,
            objectName: objectPath,
            contentType: file.type || "video/mp4",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024,
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          onError: (uploadError) => finish({ ok: false, message: this.#explain(uploadError) }),
          onProgress: (uploadedBytes, totalBytes) => {
            const percentage = totalBytes > 0 ? Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)) : 0;
            onProgress({ percentage, uploadedBytes, totalBytes });
          },
          onSuccess: () => finish({ ok: true, path: objectPath }),
        });

        try {
          upload.start();
        } catch (uploadError) {
          finish({ ok: false, message: this.#explain(uploadError) });
        }
      });
    } catch (error) {
      return { ok: false, message: this.#explain(error) };
    }
  }

  async deleteUserVideos(userId, objectPaths) {
    if (!this.#client) return this.#unavailable();
    if (!userId) return { ok: false, message: "Please log in before deleting stored videos." };
    const paths = [...new Set((objectPaths ?? []).filter((path) => typeof path === "string" && path.startsWith(`${userId}/`) && !path.includes("../")))];
    if (paths.length === 0) return { ok: true };

    try {
      const { error } = await this.#client.storage.from(this.#bucket).remove(paths);
      if (error) return { ok: false, message: this.#explain(error) };
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.#explain(error) };
    }
  }

  #unavailable() {
    return {
      ok: false,
      message: "Supabase Storage is unavailable. Check js/config.js and make sure the Supabase library loaded.",
    };
  }

  #explain(error) {
    const rawMessage = String(error?.message ?? error ?? "Unknown storage error");
    const message = rawMessage.toLowerCase();
    if (message.includes("bucket not found") || (message.includes("bucket") && message.includes("not found"))) {
      return `The private “${this.#bucket}” bucket does not exist yet. Run STORAGE-SETUP.sql in your Supabase SQL Editor.`;
    }
    if (message.includes("row-level security") || message.includes("permission denied") || message.includes("unauthorized") || message.includes("403")) {
      return "Supabase Storage denied this action. Run STORAGE-SETUP.sql and confirm the owner-only Storage policies are enabled.";
    }
    if (message.includes("maximum") || message.includes("file size") || message.includes("payload too large") || message.includes("exceed") || message.includes("413")) {
      return "Supabase rejected the file because of its upload-size limit. The website allows up to 250 MB, but the project-wide Supabase limit takes priority; the Free plan currently caps individual files at 50 MB.";
    }
    if (message.includes("failed to fetch") || message.includes("network")) {
      return "The upload could not reach Supabase. Check your connection and try again.";
    }
    return rawMessage.length > 240 ? `${rawMessage.slice(0, 237)}…` : rawMessage;
  }
}
