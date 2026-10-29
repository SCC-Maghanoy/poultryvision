/*
 * Chicken scanner UI and simulation.
 * The report generator is intentionally a prototype simulator, not an AI or a diagnostic model.
 */

class ChickenAnalysisSimulator {
  #durations = [20, 30, 35, 40, 45, 50, 60];
  #phases = [
    "Scanning video segments",
    "Checking activity cues",
    "Reviewing movement patterns",
    "Comparing sample indicators",
    "Organizing the review profile",
    "Preparing the demonstration report",
  ];
  #conditions = [
    "Coccidiosis",
    "Infectious bronchitis",
    "Mycoplasmosis",
    "Newcastle disease",
    "Fowl cholera",
    "Avian influenza",
  ];

  async analyze(onProgress = () => {}) {
    const durationSeconds = this.#pick(this.#durations);
    const durationMs = durationSeconds * 1000;
    const startTime = Date.now();
    const shuffledPhases = this.#shuffle(this.#phases);

    onProgress({ percentage: 0, durationSeconds, secondsRemaining: durationSeconds, phase: shuffledPhases[0] });

    await new Promise((resolve) => {
      const timer = window.setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percentage = Math.min(100, Math.floor((elapsed / durationMs) * 100));
        const phaseIndex = Math.floor(elapsed / 1800) % shuffledPhases.length;

        onProgress({
          percentage,
          durationSeconds,
          secondsRemaining: Math.max(0, Math.ceil((durationMs - elapsed) / 1000)),
          phase: shuffledPhases[phaseIndex],
        });

        if (elapsed >= durationMs) {
          window.clearInterval(timer);
          resolve();
        }
      }, 250);
    });

    return this.#createSampleResult(durationSeconds);
  }

  #createSampleResult(durationSeconds) {
    // The status and example reference are deliberately randomized for the prototype UI.
    const profiles = [
      {
        status: "Healthy",
        tone: "healthy",
        title: "Low-concern sample profile",
        description: "This demonstration profile shows a low-concern status. In real flock care, normal eating, movement, breathing, posture, and droppings should still be considered together.",
        condition: "No example condition selected",
        observation: "Continue routine flock checks. Seek expert advice if you notice a real change in condition.",
      },
      {
        status: "Needs observation",
        tone: "warning",
        title: "Closer observation sample profile",
        description: "This demonstration profile represents a situation that could merit a closer look. Reduced activity, appetite changes, respiratory signs, or unusual droppings can have many different causes.",
        condition: this.#pick(this.#conditions),
        observation: "Observe the flock carefully and contact a qualified poultry veterinarian if concerning signs are present or persist.",
      },
      {
        status: "Unhealthy",
        tone: "critical",
        title: "Higher-concern sample profile",
        description: "This demonstration profile represents a higher-concern scenario. The example condition below is a random reference only; the uploaded clip was not checked for that disease.",
        condition: this.#pick(this.#conditions),
        observation: "Do not rely on this sample output for a health decision. Seek a qualified poultry veterinarian for an actual assessment.",
      },
    ];

    return {
      reference: this.#makeReference(),
      generatedAt: new Date(),
      durationSeconds,
      ...this.#pick(profiles),
    };
  }

  #pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  #shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  #makeReference() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suffix = "";
    for (let index = 0; index < 6; index += 1) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `PV-${suffix}`;
  }
}

/** Owns the upload, progress, result, and delete flow for the home-page scanner modal. */
class ChickenScannerModal {
  #root;
  #storage;
  #simulator;
  #user = null;
  #currentUserId = null;
  #previousFocus = null;
  #selectedFile = null;
  #selectedDuration = 0;
  #objectUrl = null;
  #storedObjectPath = null;
  #existingFiles = [];
  #result = null;
  #busy = false;
  #checkingStorage = false;

  #fileInput;
  #dropzone;
  #dropTitle;
  #videoWrap;
  #video;
  #fileDetails;
  #fileName;
  #fileMeta;
  #fileCheck;
  #uploadStatus;
  #uploadMessage;
  #uploadPercent;
  #uploadProgress;
  #uploadProgressBar;
  #feedback;
  #analyzeButton;
  #seeResultButton;
  #deleteButton;
  #retryButton;
  #sidePanel;
  #closeButton;

  #keyHandler = (event) => this.#handleKeydown(event);

  constructor(storageService, simulator = new ChickenAnalysisSimulator()) {
    this.#root = document.querySelector("[data-scanner-modal]");
    this.#storage = storageService;
    this.#simulator = simulator;
    if (!this.#root) return;

    this.#fileInput = this.#root.querySelector("[data-pv-file-input]");
    this.#dropzone = this.#root.querySelector("[data-pv-dropzone]");
    this.#dropTitle = this.#root.querySelector("[data-pv-drop-title]");
    this.#videoWrap = this.#root.querySelector("[data-pv-video-wrap]");
    this.#video = this.#root.querySelector("[data-pv-video]");
    this.#fileDetails = this.#root.querySelector("[data-pv-file-details]");
    this.#fileName = this.#root.querySelector("[data-pv-file-name]");
    this.#fileMeta = this.#root.querySelector("[data-pv-file-meta]");
    this.#fileCheck = this.#root.querySelector("[data-pv-file-check]");
    this.#uploadStatus = this.#root.querySelector("[data-pv-upload-status]");
    this.#uploadMessage = this.#root.querySelector("[data-pv-upload-message]");
    this.#uploadPercent = this.#root.querySelector("[data-pv-upload-percent]");
    this.#uploadProgress = this.#root.querySelector("[data-pv-upload-progress]");
    this.#uploadProgressBar = this.#root.querySelector("[data-pv-upload-progress-bar]");
    this.#feedback = this.#root.querySelector("[data-pv-feedback]");
    this.#analyzeButton = this.#root.querySelector("[data-pv-analyze]");
    this.#seeResultButton = this.#root.querySelector("[data-pv-see-result]");
    this.#deleteButton = this.#root.querySelector("[data-pv-delete]");
    this.#retryButton = this.#root.querySelector("[data-pv-retry-upload]");
    this.#sidePanel = this.#root.querySelector("[data-pv-side-panel]");
    this.#closeButton = this.#root.querySelector("[data-pv-close]");

    this.#bindEvents();
  }

  get isOpen() {
    return Boolean(this.#root && !this.#root.hidden);
  }

  open(user) {
    if (!this.#root || !user?.id) return;
    this.#previousFocus = document.activeElement;

    if (this.#currentUserId !== user.id) {
      this.#clearLocalState();
      this.#currentUserId = user.id;
    }
    this.#user = user;
    this.#root.hidden = false;
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", this.#keyHandler);
    this.#closeButton?.focus();

    if (!this.#storedObjectPath && this.#existingFiles.length === 0) this.#loadExistingFiles();
  }

  close() {
    if (!this.#root || this.#root.hidden) return;
    this.#root.hidden = true;
    document.body.classList.remove("modal-open");
    document.removeEventListener("keydown", this.#keyHandler);
    this.#previousFocus?.focus?.();
  }

  #bindEvents() {
    this.#fileInput?.addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      if (file) this.#selectVideo(file);
    });

    this.#dropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (!this.#dropzone.classList.contains("is-locked")) this.#dropzone.classList.add("is-dragging");
    });
    this.#dropzone?.addEventListener("dragleave", () => this.#dropzone.classList.remove("is-dragging"));
    this.#dropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      this.#dropzone.classList.remove("is-dragging");
      if (this.#dropzone.classList.contains("is-locked")) return;
      const file = event.dataTransfer?.files?.[0];
      if (file) this.#selectVideo(file);
    });

    this.#root.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.matches("[data-pv-close]")) this.close();
      else if (target.matches("[data-pv-analyze]")) this.#analyze();
      else if (target.matches("[data-pv-see-result]")) this.#revealResult();
      else if (target.matches("[data-pv-delete]")) this.#deleteAndReset();
      else if (target.matches("[data-pv-retry-upload]")) this.#uploadSelectedVideo();
      else if (target.matches("[data-pv-delete-existing]")) this.#deleteExistingVideos();
      else if (target.matches("[data-pv-pick-again]")) this.#fileInput?.click();
    });

    this.#root.addEventListener("click", (event) => {
      if (event.target === this.#root) this.close();
    });
  }

  async #loadExistingFiles() {
    if (this.#checkingStorage || !this.#user?.id || this.#storedObjectPath) return;
    this.#checkingStorage = true;
    this.#setDropzoneLocked(true);
    this.#renderStorageChecking();

    const userId = this.#user.id;
    const result = await this.#storage.listUserVideos(userId);
    this.#checkingStorage = false;
    if (this.#user?.id !== userId) return;

    if (!result.ok) {
      this.#setDropzoneLocked(true);
      this.#renderStorageError(result.message);
      return;
    }

    this.#existingFiles = result.files;
    if (this.#existingFiles.length > 0) {
      this.#setDropzoneLocked(true);
      this.#renderExistingFiles(this.#existingFiles);
      this.#showFeedback("A previous video is still stored. Delete it before uploading another clip.", "info");
      return;
    }

    this.#setDropzoneLocked(false);
    this.#renderLandingPanel();
  }

  async #selectVideo(file) {
    if (this.#busy || this.#storedObjectPath || this.#existingFiles.length > 0 || this.#checkingStorage) return;
    this.#clearFeedback();

    if (!this.#isSupportedVideo(file)) {
      this.#showFeedback("Choose an MP4, MOV, or WebM video file.", "error");
      if (this.#fileInput) this.#fileInput.value = "";
      return;
    }
    if (file.size > (PV_CONFIG.MAX_VIDEO_SIZE_BYTES || 250 * 1024 * 1024)) {
      this.#showFeedback("This video is larger than 250 MB. Choose a smaller file.", "error");
      if (this.#fileInput) this.#fileInput.value = "";
      return;
    }
    if (file.size === 0) {
      this.#showFeedback("That file is empty. Choose another video.", "error");
      if (this.#fileInput) this.#fileInput.value = "";
      return;
    }

    this.#clearSelectedVideo();
    this.#selectedFile = file;
    this.#objectUrl = URL.createObjectURL(file);
    this.#video.src = this.#objectUrl;
    this.#videoWrap.hidden = false;
    this.#dropzone.hidden = true;
    this.#fileDetails.hidden = true;
    this.#showFeedback("Checking the video duration and file details…", "info");
    this.#setUploadStatus("Checking video properties…", 0, false);

    try {
      const duration = await this.#readDuration();
      if (!Number.isFinite(duration) || duration <= 0) throw new Error("We couldn't read the duration of this video. Try exporting it as MP4 or WebM.");
      const maxDuration = PV_CONFIG.MAX_VIDEO_DURATION_SECONDS || 30;
      if (duration > maxDuration + 0.05) throw new Error(`This clip is longer than ${maxDuration} seconds. Trim it to ${maxDuration} seconds or less, then try again.`);

      this.#selectedDuration = duration;
      this.#fileName.textContent = file.name;
      this.#fileMeta.textContent = `${this.#formatBytes(file.size)} · ${duration.toFixed(1)} seconds`;
      this.#fileDetails.hidden = false;
      this.#showFeedback("Clip accepted. Uploading it to your private storage folder…", "info");
      await this.#uploadSelectedVideo();
    } catch (error) {
      this.#clearSelectedVideo();
      this.#uploadStatus.hidden = true;
      this.#retryButton.hidden = true;
      this.#showFeedback(error.message || "Could not read this video. Try another file.", "error");
      this.#setSideToLanding();
    }
  }

  #isSupportedVideo(file) {
    const acceptedExtension = /\.(mp4|mov|webm|m4v)$/i.test(file.name || "");
    const acceptedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"];
    return acceptedExtension && (!file.type || acceptedTypes.includes(file.type.toLowerCase()));
  }

  #readDuration() {
    return new Promise((resolve, reject) => {
      const finish = (handler, value) => {
        window.clearTimeout(timeout);
        this.#video.removeEventListener("loadedmetadata", onLoaded);
        this.#video.removeEventListener("error", onError);
        handler(value);
      };
      const onLoaded = () => finish(resolve, Number(this.#video.duration));
      const onError = () => finish(reject, new Error("This browser couldn't read the video. Try an MP4 or WebM file."));
      const timeout = window.setTimeout(() => finish(reject, new Error("The video took too long to read. Try a smaller MP4 or WebM clip.")), 15000);
      this.#video.addEventListener("loadedmetadata", onLoaded, { once: true });
      this.#video.addEventListener("error", onError, { once: true });
      this.#video.load();
    });
  }

  async #uploadSelectedVideo() {
    if (!this.#selectedFile || !this.#user?.id || this.#busy) return;
    const file = this.#selectedFile;
    const userId = this.#user.id;
    this.#busy = true;
    this.#setDropzoneLocked(true);
    this.#analyzeButton.disabled = true;
    this.#retryButton.hidden = true;
    this.#deleteButton.hidden = true;
    this.#setUploadStatus("Uploading video to private storage…", 0, true);
    this.#uploadStatus.classList.remove("is-error", "is-complete");
    this.#showFeedback("Your video is being uploaded. The Analyze button unlocks when the upload is complete.", "info");

    const result = await this.#storage.uploadVideo(userId, file, ({ percentage, uploadedBytes, totalBytes }) => {
      if (this.#user?.id !== userId) return;
      this.#setUploadStatus("Uploading video to private storage…", percentage, true);
      if (this.#uploadMessage) this.#uploadMessage.textContent = `Uploading · ${this.#formatBytes(uploadedBytes)} of ${this.#formatBytes(totalBytes)}`;
    });

    if (this.#user?.id !== userId) return;
    this.#busy = false;
    if (!result.ok) {
      this.#setUploadStatus("Upload did not complete", Number(this.#uploadProgress?.getAttribute("aria-valuenow") ?? 0), false);
      this.#uploadStatus.classList.add("is-error");
      this.#showFeedback(result.message, "error");
      this.#retryButton.hidden = false;
      this.#setDropzoneLocked(true);
      return;
    }

    this.#storedObjectPath = result.path;
    this.#setUploadStatus("Video stored successfully", 100, false);
    this.#uploadStatus.classList.add("is-complete");
    this.#uploadStatus.hidden = true;
    this.#fileCheck.hidden = false;
    this.#analyzeButton.disabled = false;
    this.#analyzeButton.hidden = false;
    this.#deleteButton.hidden = false;
    this.#deleteButton.textContent = "Delete video";
    this.#retryButton.hidden = true;
    this.#showFeedback("Upload complete. You can now run the sample analysis.", "success");
    this.#renderLandingPanel();
    this.#setDropzoneLocked(true);
  }

  async #analyze() {
    if (!this.#storedObjectPath || !this.#selectedFile || this.#busy) return;
    this.#busy = true;
    this.#result = null;
    this.#analyzeButton.hidden = true;
    this.#seeResultButton.hidden = true;
    this.#deleteButton.disabled = true;
    this.#showFeedback("The timed prototype sequence is running. Results are a randomized demonstration, not a real diagnosis.", "info");
    this.#renderAnalysisProgress();

    const userId = this.#user.id;
    const objectPath = this.#storedObjectPath;
    const result = await this.#simulator.analyze((progress) => this.#updateAnalysisProgress(progress));
    if (this.#user?.id !== userId || this.#storedObjectPath !== objectPath) return;
    this.#busy = false;
    this.#result = result;
    this.#deleteButton.disabled = false;
    this.#seeResultButton.hidden = false;
    this.#deleteButton.textContent = "Delete video & start over";
    this.#renderAnalysisComplete(result);
    this.#showFeedback("Sample sequence complete. Select See result to open the report.", "success");
  }

  #updateAnalysisProgress(progress) {
    const phase = this.#sidePanel.querySelector("[data-pv-scan-phase]");
    const percentageLabel = this.#sidePanel.querySelector("[data-pv-scan-percent]");
    const timeLabel = this.#sidePanel.querySelector("[data-pv-scan-time]");
    const bar = this.#sidePanel.querySelector("[data-pv-scan-bar]");
    const progressTrack = this.#sidePanel.querySelector("[data-pv-scan-progress]");
    if (phase) phase.textContent = progress.phase;
    if (percentageLabel) percentageLabel.textContent = `${progress.percentage}%`;
    if (timeLabel) timeLabel.textContent = `${progress.secondsRemaining}s remaining`;
    if (bar) bar.style.width = `${progress.percentage}%`;
    if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(progress.percentage));
  }

  #renderAnalysisProgress() {
    this.#sidePanel.innerHTML = `
      <div class="pv-scan-progress-panel">
        <div class="pv-panel-topline"><span class="pv-scanning-indicator"><span></span> SAMPLE SEQUENCE</span><span class="pv-overline">02 / 03</span></div>
        <span class="pv-scan-orbit" aria-hidden="true"><span></span><span></span><span></span></span>
        <p class="pv-overline">RUNNING DEMONSTRATION</p>
        <h3 data-pv-scan-phase>Scanning video segments</h3>
        <p class="pv-panel-copy">The interface is playing a timed sample sequence. No model is interpreting the uploaded video.</p>
        <div class="pv-scan-progress-meta"><span>Processing sequence</span><strong data-pv-scan-percent>0%</strong></div>
        <div class="pv-scan-progress-track" data-pv-scan-progress role="progressbar" aria-label="Sample sequence progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-pv-scan-bar></span></div>
        <div class="pv-scan-time-row"><span class="pv-live-dot"></span><span>Demo pipeline active</span><span data-pv-scan-time>0s remaining</span></div>
        <div class="pv-scan-log"><span>PROCESS</span><p>Initializing review sequence<span class="pv-typing-dots"><i></i><i></i><i></i></span></p><p>Loading sample indicator library<span class="pv-typing-dots"><i></i><i></i><i></i></span></p></div>
      </div>`;
  }

  #renderAnalysisComplete(result) {
    this.#sidePanel.innerHTML = `
      <div class="pv-analysis-complete">
        <span class="pv-complete-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></span>
        <p class="pv-overline">03 / 03 · COMPLETE</p><h3>Sample sequence complete</h3>
        <p class="pv-panel-copy">Your demonstration report is ready. Open it to review the randomized status, descriptive text and example condition reference.</p>
        <div class="pv-complete-summary"><span>Reference ID</span><strong data-pv-complete-ref></strong><span>Sequence time</span><strong>${result.durationSeconds} seconds</strong></div>
        <div class="pv-disclosure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg><p><strong>Reminder</strong><span>The report is randomized for prototype testing and is not a finding about the uploaded chicken.</span></p></div>
      </div>`;
    const reference = this.#sidePanel.querySelector("[data-pv-complete-ref]");
    if (reference) reference.textContent = result.reference;
  }

  #revealResult() {
    if (!this.#result) return;
    const result = this.#result;
    this.#sidePanel.innerHTML = `
      <div class="pv-report-card">
        <div class="pv-report-heading"><div><p class="pv-overline">POULTRYVISION / REPORT</p><h3>Chicken description</h3></div><span class="pv-simulated-label">SIMULATED OUTPUT</span></div>
        <div class="pv-status-card" data-tone="${result.tone}"><div><span class="pv-status-kicker">Sample status</span><strong data-pv-result-status></strong></div><span class="pv-status-symbol" data-pv-status-symbol></span></div>
        <p class="pv-report-description" data-pv-result-description></p>
        <div class="pv-condition-card"><span class="pv-condition-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3.8 7.5v9L12 21l8.2-4.5v-9L12 3Z"/><path d="M12 8v5m0 3h.01"/></svg></span><div><span class="pv-condition-label">Example condition reference</span><strong data-pv-result-condition></strong><p>This is an illustrative reference selected at random, not a disease detected in your video.</p></div></div>
        <div class="pv-followup-card"><span class="pv-overline">GENERAL FOLLOW-UP</span><p data-pv-result-observation></p></div>
        <div class="pv-report-meta"><span>Reference <strong data-pv-result-ref></strong></span><span>Generated <strong data-pv-result-date></strong></span></div>
        <div class="pv-report-disclaimer"><strong>Prototype disclaimer</strong><p>The status and condition reference were randomly selected. This website did not analyze the video or diagnose an animal. Consult a qualified poultry veterinarian for real health concerns.</p></div>
      </div>`;
    const status = this.#sidePanel.querySelector("[data-pv-result-status]");
    const symbol = this.#sidePanel.querySelector("[data-pv-status-symbol]");
    const description = this.#sidePanel.querySelector("[data-pv-result-description]");
    const condition = this.#sidePanel.querySelector("[data-pv-result-condition]");
    const observation = this.#sidePanel.querySelector("[data-pv-result-observation]");
    const reference = this.#sidePanel.querySelector("[data-pv-result-ref]");
    const date = this.#sidePanel.querySelector("[data-pv-result-date]");

    if (status) status.textContent = result.status;
    if (symbol) symbol.textContent = result.tone === "healthy" ? "✓" : result.tone === "warning" ? "!" : "×";
    if (description) description.textContent = result.description;
    if (condition) condition.textContent = result.condition;
    if (observation) observation.textContent = result.observation;
    if (reference) reference.textContent = result.reference;
    if (date) date.textContent = result.generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    this.#seeResultButton.hidden = true;
    this.#deleteButton.textContent = "Delete video & analyze again";
    this.#showFeedback("Report opened. Delete the stored video before starting another analysis.", "info");
  }

  async #deleteAndReset() {
    if (this.#busy || !this.#user?.id) return;
    const paths = this.#storedObjectPath ? [this.#storedObjectPath] : this.#existingFiles.map((file) => file.path);
    if (paths.length === 0) return;
    const confirmed = window.confirm("Permanently delete the stored video from Supabase Storage? This frees the stored file and lets you upload another clip.");
    if (!confirmed) return;

    const userId = this.#user.id;
    this.#busy = true;
    this.#deleteButton.disabled = true;
    this.#showFeedback("Deleting the video from private storage…", "info");
    const result = await this.#storage.deleteUserVideos(userId, paths);
    if (this.#user?.id !== userId) return;
    this.#busy = false;
    this.#deleteButton.disabled = false;

    if (!result.ok) {
      this.#showFeedback(result.message, "error");
      return;
    }

    this.#clearLocalState();
    this.#currentUserId = this.#user.id;
    this.#renderLandingPanel();
    this.#setDropzoneLocked(false);
    this.#showFeedback("The stored video was permanently deleted. You can upload a new clip now.", "success");
  }

  async #deleteExistingVideos() {
    if (this.#busy || !this.#user?.id || this.#existingFiles.length === 0) return;
    const paths = this.#existingFiles.map((file) => file.path);
    const confirmed = window.confirm("Permanently delete all stored videos in your PoultryVision folder? This cannot be undone.");
    if (!confirmed) return;
    const userId = this.#user.id;
    this.#busy = true;
    this.#showFeedback("Deleting stored video files…", "info");
    const result = await this.#storage.deleteUserVideos(userId, paths);
    if (this.#user?.id !== userId) return;
    this.#busy = false;
    if (!result.ok) {
      this.#showFeedback(result.message, "error");
      return;
    }
    this.#clearLocalState();
    this.#currentUserId = this.#user.id;
    this.#renderLandingPanel();
    this.#setDropzoneLocked(false);
    this.#showFeedback("Stored video files deleted. You can upload a new clip.", "success");
  }

  #renderExistingFiles(files) {
    const panel = document.createElement("div");
    panel.className = "pv-existing-files-panel";
    const icon = document.createElement("span");
    icon.className = "pv-panel-icon pv-warning-icon";
    icon.textContent = "!";
    const label = document.createElement("p");
    label.className = "pv-overline";
    label.textContent = "STORAGE CLEANUP";
    const title = document.createElement("h3");
    title.textContent = "A video is already stored";
    const copy = document.createElement("p");
    copy.className = "pv-panel-copy";
    copy.textContent = "To prevent old clips from taking up space, delete the previous upload before adding another video.";
    const list = document.createElement("div");
    list.className = "pv-stored-file-list";
    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "pv-stored-file-item";
      const name = document.createElement("strong");
      name.textContent = file.name;
      const meta = document.createElement("small");
      meta.textContent = file.size ? this.#formatBytes(file.size) : "Stored in private bucket";
      item.append(name, meta);
      list.append(item);
    });
    const button = document.createElement("button");
    button.className = "button pv-existing-delete-button";
    button.type = "button";
    button.dataset.pvDeleteExisting = "";
    button.textContent = "Delete stored video";
    const disclosure = document.createElement("p");
    disclosure.className = "pv-small-disclosure";
    disclosure.textContent = "Deletion permanently removes these files from your private Supabase bucket.";
    panel.append(icon, label, title, copy, list, button, disclosure);
    this.#sidePanel.replaceChildren(panel);
  }

  #renderStorageChecking() {
    this.#sidePanel.innerHTML = `<div class="pv-storage-checking"><span class="pv-small-spinner" aria-hidden="true"></span><p class="pv-overline">CHECKING PRIVATE STORAGE</p><h3>Checking for a previous upload</h3><p class="pv-panel-copy">PoultryVision checks your own storage folder before allowing another upload.</p></div>`;
  }

  #renderStorageError(message) {
    this.#sidePanel.innerHTML = `<div class="pv-storage-error"><span class="pv-panel-icon pv-warning-icon">!</span><p class="pv-overline">STORAGE SETUP REQUIRED</p><h3>Storage is not ready yet</h3><p class="pv-panel-copy" data-pv-storage-error-copy></p><p class="pv-small-disclosure">Open <strong>STORAGE-SETUP.sql</strong> and run it in the Supabase SQL Editor, then refresh this page.</p></div>`;
    const copy = this.#sidePanel.querySelector("[data-pv-storage-error-copy]");
    if (copy) copy.textContent = message;
  }

  #renderLandingPanel() {
    if (!this.#sidePanel) return;
    this.#sidePanel.innerHTML = `
      <div class="pv-panel-landing"><span class="pv-panel-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 12h5M8 15h7"/></svg></span><p class="pv-overline">WHAT HAPPENS NEXT</p><h3>Your report will appear here</h3><p class="pv-panel-copy">Add a video to prepare a sample review. The demo status and condition reference are randomized for interface testing.</p><div class="pv-mini-steps"><div><span>1</span><p><strong>Upload</strong><small>Validate and store your clip</small></p></div><div><span>2</span><p><strong>Analyze</strong><small>Run the timed demo sequence</small></p></div><div><span>3</span><p><strong>Review</strong><small>Open the sample report</small></p></div></div><div class="pv-disclosure"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg><p><strong>Prototype output</strong><span>This version does not run an AI model or diagnose disease. The uploaded clip is not used to generate the randomized report.</span></p></div></div>`;
  }

  #setSideToLanding() {
    if (!this.#storedObjectPath && this.#existingFiles.length === 0) this.#renderLandingPanel();
  }

  #setUploadStatus(message, percentage, showProgress) {
    this.#uploadStatus.hidden = false;
    this.#uploadMessage.textContent = message;
    this.#uploadPercent.textContent = `${Math.max(0, Math.min(100, percentage))}%`;
    this.#uploadProgressBar.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    this.#uploadProgress.setAttribute("aria-valuenow", String(Math.max(0, Math.min(100, percentage))));
    this.#uploadProgress.hidden = !showProgress;
  }

  #setDropzoneLocked(isLocked) {
    if (this.#dropzone) {
      this.#dropzone.classList.toggle("is-locked", isLocked);
      this.#dropzone.setAttribute("aria-disabled", String(isLocked));
    }
    if (this.#fileInput) this.#fileInput.disabled = isLocked;
  }

  #showFeedback(message, type = "info") {
    if (!this.#feedback) return;
    this.#feedback.textContent = message;
    this.#feedback.dataset.type = type;
    this.#feedback.hidden = false;
  }

  #clearFeedback() {
    if (!this.#feedback) return;
    this.#feedback.hidden = true;
    this.#feedback.textContent = "";
    delete this.#feedback.dataset.type;
  }

  #clearSelectedVideo() {
    if (this.#objectUrl) URL.revokeObjectURL(this.#objectUrl);
    this.#objectUrl = null;
    this.#selectedFile = null;
    this.#selectedDuration = 0;
    if (this.#video) {
      this.#video.pause();
      this.#video.removeAttribute("src");
      this.#video.load();
    }
    if (this.#videoWrap) this.#videoWrap.hidden = true;
    if (this.#fileDetails) this.#fileDetails.hidden = true;
    if (this.#fileCheck) this.#fileCheck.hidden = true;
    if (this.#dropzone) this.#dropzone.hidden = false;
    if (this.#fileInput) this.#fileInput.value = "";
  }

  #clearLocalState() {
    this.#clearSelectedVideo();
    this.#storedObjectPath = null;
    this.#existingFiles = [];
    this.#result = null;
    this.#busy = false;
    this.#checkingStorage = false;
    this.#analyzeButton.hidden = false;
    this.#analyzeButton.disabled = true;
    this.#seeResultButton.hidden = true;
    this.#deleteButton.hidden = true;
    this.#deleteButton.disabled = false;
    this.#deleteButton.textContent = "Delete video";
    this.#retryButton.hidden = true;
    this.#uploadStatus.hidden = true;
    this.#uploadStatus.classList.remove("is-error", "is-complete");
    this.#uploadProgress.hidden = false;
    this.#uploadProgressBar.style.width = "0%";
    this.#setDropzoneLocked(false);
    this.#clearFeedback();
    this.#renderLandingPanel();
  }

  #formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  #handleKeydown(event) {
    if (!this.isOpen) return;
    if (event.key === "Escape") {
      this.close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...this.#root.querySelectorAll("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), video[controls], label[for]:not([hidden])")]
      .filter((element) => element.getClientRects().length > 0);
    if (focusable.length === 0) return;
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
