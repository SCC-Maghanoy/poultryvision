/*
 * UI component classes: small reusable pieces of the interface.
 * Each one manages its own element(s) and hides its internals.
 */

/** Tiny helper for building HTML elements safely (text is never treated as HTML). */
class Dom {
  static create(tag, props = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === "text") element.textContent = value;
      else if (key === "class") element.className = value;
      else element.setAttribute(key, value);
    }
    element.append(...children);
    return element;
  }

  static svg(pathData) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    pathData.forEach((d) => {
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", d);
      svg.append(path);
    });
    return svg;
  }
}

/** The small message box in the corner of the screen. It hides itself after a few seconds. */
class Notice {
  #element;
  #timer = null;

  constructor(element) {
    this.#element = element;
  }

  show(message, { type = "info", duration = 6000 } = {}) {
    if (!this.#element) return;
    const messageElement = this.#element.querySelector("[data-notice-message]");
    if (messageElement) messageElement.textContent = message;
    else this.#element.textContent = message;

    this.#element.dataset.type = type;
    this.#element.hidden = false;

    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.hide(), duration);
  }

  hide() {
    if (this.#element) this.#element.hidden = true;
  }
}

/**
 * Checks form values against a list of rules and returns the messages for rules that failed.
 *   new FormValidator().addRule("email", (v) => v.includes("@"), "Enter a valid email.")
 */
class FormValidator {
  #rules = [];

  addRule(field, isValid, message) {
    this.#rules.push({ field, isValid, message });
    return this; // lets you chain .addRule().addRule()
  }

  validate(values) {
    return this.#rules.filter((rule) => !rule.isValid(values[rule.field] ?? "", values)).map((rule) => rule.message);
  }

  static isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}

/**
 * The "Log in or create an account" popup shown when someone who is not signed in
 * tries to download. Handles keyboard use (Esc to close, Tab stays inside) for accessibility.
 */
class AuthModal {
  #redirectTo;
  #root = null;
  #dialog = null;
  #previousFocus = null;
  #onKeydown = (event) => this.#handleKeydown(event);

  constructor({ redirectTo = "index.html" } = {}) {
    this.#redirectTo = redirectTo;
  }

  get isOpen() {
    return this.#root !== null;
  }

  open() {
    if (this.isOpen) return;
    this.#previousFocus = document.activeElement;
    this.#root = this.#build();
    document.body.append(this.#root);
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", this.#onKeydown);
    this.#dialog.querySelector("a, button")?.focus();
  }

  close() {
    if (!this.isOpen) return;
    document.removeEventListener("keydown", this.#onKeydown);
    this.#root.remove();
    this.#root = null;
    this.#dialog = null;
    document.body.classList.remove("modal-open");
    this.#previousFocus?.focus?.();
  }

  #build() {
    const query = `?redirect=${encodeURIComponent(this.#redirectTo)}`;

    const closeButton = Dom.create("button", { class: "modal-close", type: "button", "aria-label": "Close" }, Dom.svg(["M6 6l12 12M18 6 6 18"]));
    closeButton.addEventListener("click", () => this.close());

    this.#dialog = Dom.create(
      "div",
      { class: "modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "auth-modal-title", "aria-describedby": "auth-modal-text" },
      closeButton,
      Dom.create("span", { class: "modal-icon" }, Dom.svg(["M7 11V8a5 5 0 0 1 10 0v3", "M5 11h14v10H5z"])),
      Dom.create("h2", { id: "auth-modal-title", text: "Log in to download" }),
      Dom.create("p", { id: "auth-modal-text", text: "The PoultryVision download is available to account holders. Log in, or create a free account in less than a minute." }),
      Dom.create(
        "div",
        { class: "modal-actions" },
        Dom.create("a", { class: "button", href: `login.html${query}`, text: "Log in" }),
        Dom.create("a", { class: "button button-secondary", href: `register.html${query}`, text: "Create an account" })
      )
    );

    const backdrop = Dom.create("div", { class: "modal-backdrop" }, this.#dialog);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) this.close(); // clicking outside the box closes it
    });
    return backdrop;
  }

  #handleKeydown(event) {
    if (event.key === "Escape") {
      this.close();
      return;
    }
    if (event.key !== "Tab" || !this.#dialog) return;

    // Keep keyboard focus inside the popup.
    const focusable = [...this.#dialog.querySelectorAll("a[href], button:not([disabled])")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/** The area of the navigation bar that shows "Log in" or "Hi, Name / Log out". */
class AuthNav {
  #slot;
  #onLogout;

  constructor(slot, onLogout) {
    this.#slot = slot;
    this.#onLogout = onLogout;
  }

  render(user, displayName) {
    if (!this.#slot) return;
    this.#slot.replaceChildren();

    if (!user) {
      this.#slot.append(Dom.create("a", { href: "login.html", "data-nav": "login", text: "Log in" }));
      return;
    }

    const logout = Dom.create("button", { class: "nav-logout", type: "button", text: "Log out" });
    logout.addEventListener("click", () => this.#onLogout());
    this.#slot.append(Dom.create("span", { class: "nav-user", text: `Hi, ${displayName}` }), logout);
  }
}
