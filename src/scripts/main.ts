const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const smoothstep = (value: number) => {
  const normalized = clamp(value);
  return normalized * normalized * (3 - 2 * normalized);
};
const visualPalette = {
  void: "#080b0a",
  panel: "#111715",
  paper: "#f2f4f1",
  blue: "#405fae",
  live: "#b8d879",
  teal: "#4fa88f",
  rust: "#c86a4f",
};

function setupHeader() {
  const header = document.querySelector<HTMLElement>("[data-header]");
  if (!header) return;

  let queued = false;
  const update = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
    queued = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}

function setupMenu() {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-button]");
  const navigation = document.querySelector<HTMLElement>("[data-mobile-nav]");
  if (!button || !navigation) return;
  const background = Array.from(
    document.querySelectorAll<HTMLElement>("main, footer, #flow-toggle"),
  );

  const setBackgroundInert = (value: boolean) => {
    background.forEach((element) => {
      element.inert = value;
    });
  };

  const close = (restoreFocus = false) => {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation");
    button.setAttribute("title", "Open navigation");
    navigation.hidden = true;
    document.body.classList.remove("menu-open");
    setBackgroundInert(false);
    if (restoreFocus) button.focus();
  };

  const open = () => {
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close navigation");
    button.setAttribute("title", "Close navigation");
    navigation.hidden = false;
    document.body.classList.add("menu-open");
    setBackgroundInert(true);
    navigation.querySelector<HTMLAnchorElement>("a")?.focus();
  };

  button.addEventListener("click", () => {
    if (button.getAttribute("aria-expanded") === "true") close();
    else open();
  });

  navigation.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a");
    if (!link) return;
    const href = link.getAttribute("href");
    close();
    if (!href?.startsWith("#")) return;
    window.setTimeout(() => {
      const destination = document.querySelector<HTMLElement>(href);
      const focusTarget =
        destination?.querySelector<HTMLElement>("[data-menu-focus], h1, h2, h3") ?? destination;
      if (!focusTarget) return;
      focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
      focusTarget.addEventListener("blur", () => focusTarget.removeAttribute("tabindex"), {
        once: true,
      });
    }, 350);
  });

  document.addEventListener("keydown", (event) => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (event.key === "Escape" && isOpen) {
      close(true);
      return;
    }
    if (event.key !== "Tab" || !isOpen) return;
    const focusable = [button, ...navigation.querySelectorAll<HTMLAnchorElement>("a")];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 920) close();
  });
}

function setupRevealMotion() {
  const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (!elements.length || reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("motion-ready");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  elements.forEach((element) => observer.observe(element));
}

function setupActiveNavigation() {
  const links = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(
      '.desktop-nav a[href^="#"], [data-mobile-nav] a[href^="#"]',
    ),
  );
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;

  const activate = (sectionName: string) => {
    links.forEach((link) => {
      const active = link.getAttribute("href") === `#${sectionName}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const sectionName = (visible.target as HTMLElement).dataset.section;
      if (sectionName) activate(sectionName);
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.1, 0.3] },
  );

  sections.forEach((section) => observer.observe(section));
}

function setupCounters() {
  const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
  if (!counters.length) return;

  const finish = (counter: HTMLElement) => {
    const target = Number(counter.dataset.count ?? 0);
    counter.textContent = `${target}${counter.dataset.suffix ?? ""}`;
    counter.parentElement?.classList.add("is-counted");
  };

  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    counters.forEach(finish);
    return;
  }

  const animate = (counter: HTMLElement) => {
    const target = Number(counter.dataset.count ?? 0);
    const suffix = counter.dataset.suffix ?? "";
    const start = performance.now();
    const duration = 1100;

    const frame = (time: number) => {
      const progress = clamp((time - start) / duration);
      counter.textContent = `${Math.round(target * easeOutCubic(progress))}${suffix}`;
      if (progress < 1) window.requestAnimationFrame(frame);
    };

    counter.parentElement?.classList.add("is-counted");
    window.requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animate(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.55 },
  );

  counters.forEach((counter) => observer.observe(counter));
}

function setupMotionSections() {
  const hero = document.querySelector<HTMLElement>(".hero");
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("[data-motion-section]"),
  );

  let userPaused = false;
  let reducedMotion = reducedMotionQuery.matches;

  const applyReducedMotionState = () => {
    hero?.style.setProperty("--hero-progress", "0");
    document.documentElement.style.setProperty("--ambient-scroll-y", "0px");
    sections.forEach((section) => {
      section.classList.add("is-motion-active");
      section.style.setProperty("--section-progress", "1");
      section.style.setProperty("--section-enter", "1");
      section.style.setProperty("--section-focus", "1");
      section.style.setProperty("--section-exit", "0");
      section.style.setProperty("--section-shift", "0px");
      section.style.setProperty("--section-rise", "18%");
      section.style.setProperty("--section-ribbon-x", "-6vw");
      section.style.setProperty("--project-scan-y", "50%");
      section.style.setProperty("--project-depth-x", "0px");
      section.style.setProperty("--project-stage", "1");
      section.style.setProperty("--dashboard-scale", "1");
      section.style.setProperty("--project-line-dash", "0");
    });
  };

  if (reducedMotion) applyReducedMotionState();

  if ("IntersectionObserver" in window) {
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle(
            "is-motion-active",
            reducedMotion || entry.isIntersecting,
          );
        });
      },
      { rootMargin: "12% 0px 12% 0px", threshold: 0.04 },
    );
    sections.forEach((section) => visibilityObserver.observe(section));
  } else {
    sections.forEach((section) => section.classList.add("is-motion-active"));
  }

  let queued = false;
  const update = () => {
    if (userPaused || reducedMotion) {
      queued = false;
      return;
    }
    const viewport = window.innerHeight;
    document.documentElement.style.setProperty(
      "--ambient-scroll-y",
      `${((window.scrollY * 0.055) % 180).toFixed(2)}px`,
    );
    if (hero) {
      const heroProgress = clamp(window.scrollY / Math.max(hero.offsetHeight * 0.75, 1));
      hero.style.setProperty("--hero-progress", heroProgress.toFixed(3));
    }

    const sectionSnapshots = sections.map((section) => ({
      section,
      bounds: section.getBoundingClientRect(),
    }));

    sectionSnapshots.forEach(({ section, bounds }) => {
      if (bounds.bottom < -viewport || bounds.top > viewport * 2) return;
      const progress = clamp((viewport - bounds.top) / (viewport + bounds.height));
      const enter = easeOutCubic(clamp(progress / 0.24));
      const focus = 1 - clamp(Math.abs(progress - 0.5) / 0.5);
      const exit = easeOutCubic(clamp((progress - 0.76) / 0.24));
      const copyShift = (0.5 - progress) * 54;
      const visualShift = (0.5 - progress) * -34;
      const sectionShift = (1 - enter) * 28 - exit * 18;
      const sectionRise = 72 - enter * 54;
      const ribbonX = progress * -10;
      const projectScan = 8 + progress * 84;
      const projectDepth = (progress - 0.5) * 22;
      const projectStage = easeOutCubic(clamp((progress - 0.08) / 0.56));
      const dashboardScale = 0.05 + projectStage * 0.95;
      const projectLineDash = 900 * (1 - projectStage);
      section.style.setProperty("--section-progress", progress.toFixed(3));
      section.style.setProperty("--section-enter", enter.toFixed(3));
      section.style.setProperty("--section-focus", focus.toFixed(3));
      section.style.setProperty("--section-exit", exit.toFixed(3));
      section.style.setProperty("--section-shift", `${sectionShift.toFixed(2)}px`);
      section.style.setProperty("--section-rise", `${sectionRise.toFixed(2)}%`);
      section.style.setProperty("--section-ribbon-x", `${ribbonX.toFixed(2)}vw`);
      section.style.setProperty("--project-scan-y", `${projectScan.toFixed(2)}%`);
      section.style.setProperty("--project-depth-x", `${projectDepth.toFixed(2)}px`);
      section.style.setProperty("--project-stage", projectStage.toFixed(3));
      section.style.setProperty("--dashboard-scale", dashboardScale.toFixed(3));
      section.style.setProperty("--project-line-dash", projectLineDash.toFixed(1));
      section.style.setProperty("--copy-shift", `${copyShift.toFixed(2)}px`);
      section.style.setProperty("--visual-shift", `${visualShift.toFixed(2)}px`);
      section.classList.toggle("is-motion-focus", focus > 0.7);
    });
    queued = false;
  };

  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("motionstatechange", (event) => {
    userPaused = Boolean((event as CustomEvent<{ paused: boolean }>).detail?.paused);
    requestUpdate();
  });
  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
    if (reducedMotion) applyReducedMotionState();
    requestUpdate();
  });
  update();
}

function setupPortraitReveal() {
  const portrait = document.querySelector<HTMLElement>("[data-portrait]");
  if (!portrait) return;

  let userPaused = false;
  let reducedMotion = reducedMotionQuery.matches;
  let queued = false;

  const apply = (progress: number) => {
    const grayscale = smoothstep(progress);
    const colorFocus = 1 - grayscale;
    portrait.style.setProperty("--portrait-gray", grayscale.toFixed(3));
    portrait.style.setProperty(
      "--portrait-saturation",
      (1.1 - grayscale * 0.38).toFixed(3),
    );
    portrait.style.setProperty("--portrait-contrast", (1.04 + grayscale * 0.04).toFixed(3));
    portrait.style.setProperty("--portrait-frame-x", `${(colorFocus * 8).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-frame-y", `${(colorFocus * 8).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-line-x", `${(colorFocus * -6).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-line-y", `${(colorFocus * -6).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-focus", colorFocus.toFixed(3));
    portrait.style.setProperty("--portrait-scale", (1 + colorFocus * 0.035).toFixed(3));
  };

  const update = () => {
    if (reducedMotion) {
      apply(0);
      queued = false;
      return;
    }
    if (userPaused) {
      queued = false;
      return;
    }

    const bounds = portrait.getBoundingClientRect();
    const viewport = window.innerHeight;
    const progress = clamp(
      (viewport * 0.72 - bounds.top) / Math.max(viewport * 0.54, 1),
    );
    portrait.classList.toggle(
      "is-portrait-active",
      progress < 0.38 && bounds.bottom > 0 && bounds.top < viewport,
    );
    apply(progress);
    queued = false;
  };

  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("motionstatechange", (event) => {
    userPaused = Boolean((event as CustomEvent<{ paused: boolean }>).detail?.paused);
    if (!userPaused) requestUpdate();
  });
  reducedMotionQuery.addEventListener("change", (event) => {
    reducedMotion = event.matches;
    requestUpdate();
  });
  update();
}

function setupScrollMonitor() {
  const monitor = document.querySelector<HTMLElement>(".scroll-monitor");
  const indexOutput = monitor?.querySelector<HTMLElement>("[data-scroll-index]");
  const labelOutput = monitor?.querySelector<HTMLElement>("[data-scroll-label]");
  const meter = monitor?.querySelector<HTMLElement>("[data-scroll-meter]");
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>("main [data-scroll-label]"),
  );
  const contact = document.querySelector<HTMLElement>("#contact");
  const railSegments = Array.from(document.querySelectorAll<HTMLElement>(".chromatic-rail span"));
  if (!monitor || !indexOutput || !labelOutput || !meter || !sections.length) return;

  const accents = [visualPalette.blue, visualPalette.live];
  let queued = false;

  const update = () => {
    const viewport = window.innerHeight;
    if (window.innerWidth <= 1100) {
      const contactBounds = contact?.getBoundingClientRect();
      document.body.classList.toggle(
        "at-contact",
        Boolean(
          contactBounds &&
            contactBounds.top < viewport * 0.62 &&
            contactBounds.bottom > viewport * 0.2,
        ),
      );
      queued = false;
      return;
    }
    const anchor = viewport * 0.46;
    let activeIndex = 0;
    let activeBounds = sections[0].getBoundingClientRect();
    let nearest = Number.POSITIVE_INFINITY;

    sections.forEach((section, index) => {
      const bounds = section.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > viewport) return;
      const distance = Math.abs(bounds.top + Math.min(bounds.height, viewport) * 0.5 - anchor);
      if (distance >= nearest) return;
      nearest = distance;
      activeIndex = index;
      activeBounds = bounds;
    });

    const section = sections[activeIndex];
    const progress = clamp((anchor - activeBounds.top) / Math.max(activeBounds.height, 1));
    const accent = accents[activeIndex % accents.length];
    monitor.classList.toggle("is-dormant", activeIndex <= 1);
    indexOutput.textContent = String(activeIndex).padStart(2, "0");
    labelOutput.textContent = section.dataset.scrollLabel ?? "Signal";
    meter.style.transform = `scaleX(${progress.toFixed(3)})`;
    document.documentElement.style.setProperty("--active-accent", accent);
    document.body.classList.toggle("at-contact", section.id === "contact");
    document.body.classList.toggle("at-project", section.classList.contains("project-chapter"));
    railSegments.forEach((segment, index) => {
      segment.style.opacity = index === activeIndex % railSegments.length ? "1" : "0.34";
    });
    queued = false;
  };

  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();
}

function setupExperienceSpotlight() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-experience-row]"));
  if (!rows.length) return;
  if (reducedMotionQuery.matches) {
    rows[0].classList.add("is-experience-active");
    return;
  }

  let userPaused = false;
  let queued = false;
  const update = () => {
    if (userPaused) {
      queued = false;
      return;
    }
    const anchor = window.innerHeight * 0.54;
    let active = rows[0];
    let nearest = Number.POSITIVE_INFINITY;
    rows.forEach((row) => {
      const bounds = row.getBoundingClientRect();
      const distance = Math.abs(bounds.top + bounds.height * 0.5 - anchor);
      if (distance >= nearest) return;
      nearest = distance;
      active = row;
    });
    rows.forEach((row) => row.classList.toggle("is-experience-active", row === active));
    queued = false;
  };

  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  window.addEventListener("motionstatechange", (event) => {
    userPaused = Boolean((event as CustomEvent<{ paused: boolean }>).detail?.paused);
    if (!userPaused) requestUpdate();
  });
  update();
}

function setupContactActions() {
  const button = document.querySelector<HTMLButtonElement>("[data-copy-email]");
  const label = button?.querySelector<HTMLElement>("[data-copy-label]");
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  if (!button || !label || !status) return;

  const copyWithFallback = async (value: string) => {
    if (!navigator.clipboard?.writeText) return false;
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  button.addEventListener("click", async () => {
    const email = button.dataset.email;
    if (!email) return;
    const copied = await copyWithFallback(email);
    button.classList.toggle("is-copied", copied);
    label.textContent = copied ? "Copied" : "Copy failed";
    status.textContent = copied ? "Email address copied." : "Email address could not be copied.";
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      label.textContent = "Copy email";
      status.textContent = "";
    }, 2400);
  });
}

function setupBackToTop() {
  const control = document.querySelector<HTMLElement>("[data-back-to-top]");
  if (!control) return;

  let queued = false;
  const update = () => {
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = clamp(window.scrollY / maxScroll);
    control.style.setProperty("--back-progress-angle", `${(progress * 360).toFixed(1)}deg`);
    queued = false;
  };
  const requestUpdate = () => {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  update();
}

function setupTiltSurfaces() {
  if (!finePointerQuery.matches || reducedMotionQuery.matches) return;
  const surfaces = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tilt-surface]"),
  );

  surfaces.forEach((surface) => {
    let queued = false;
    let tiltX = 0;
    let tiltY = 0;

    const update = () => {
      surface.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
      surface.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
      queued = false;
    };

    const requestUpdate = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    };

    surface.addEventListener("pointermove", (event) => {
      if (document.body.classList.contains("motion-paused")) return;
      const bounds = surface.getBoundingClientRect();
      tiltX = ((event.clientY - bounds.top) / bounds.height - 0.5) * -5;
      tiltY = ((event.clientX - bounds.left) / bounds.width - 0.5) * 7;
      requestUpdate();
    });

    surface.addEventListener("pointerleave", () => {
      tiltX = 0;
      tiltY = 0;
      requestUpdate();
    });
  });
}

function setupCapabilitySpotlight() {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".capability-row"));
  if (!rows.length) return;

  if (reducedMotionQuery.matches || !("IntersectionObserver" in window)) {
    rows[0]?.classList.add("is-current");
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const current = entries.find((entry) => entry.isIntersecting);
      if (!current) return;
      rows.forEach((row) => row.classList.remove("is-current"));
      (current.target as HTMLElement).classList.add("is-current");
    },
    { rootMargin: "-41% 0px -41% 0px", threshold: 0 },
  );

  rows.forEach((row) => observer.observe(row));
}

type Point = { x: number; y: number };

class DataFlowScene {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frame = 0;
  private startTime = performance.now();
  private visible = true;
  private pageVisible = !document.hidden;
  private userPaused = false;
  private reducedMotion = reducedMotionQuery.matches;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private toggle: HTMLButtonElement | null;
  private label: HTMLElement | null;
  private throughput: HTMLElement | null;
  private lastMetricUpdate = 0;
  private pausedElapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    this.canvas = canvas;
    this.context = context;
    this.toggle = document.querySelector<HTMLButtonElement>("#flow-toggle");
    this.label = document.querySelector<HTMLElement>("[data-flow-label]");
    this.throughput = document.querySelector<HTMLElement>("[data-flow-throughput]");
    this.bind();
    this.resize();
    this.draw(performance.now());
    this.updateLoop();
  }

  private bind() {
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.canvas);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = Boolean(entry?.isIntersecting);
        this.updateLoop();
      },
      { threshold: 0.02 },
    );
    visibilityObserver.observe(this.canvas);

    document.addEventListener("visibilitychange", () => {
      this.pageVisible = !document.hidden;
      this.updateLoop();
    });

    reducedMotionQuery.addEventListener("change", (event) => {
      this.reducedMotion = event.matches;
      this.draw(performance.now());
      this.updateLoop();
    });

    if (finePointerQuery.matches) {
      this.canvas.parentElement?.addEventListener("pointermove", (event) => {
        const bounds = this.canvas.getBoundingClientRect();
        this.pointer.targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 14;
        this.pointer.targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
      });

      this.canvas.parentElement?.addEventListener("pointerleave", () => {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
      });
    }

    this.toggle?.addEventListener("click", () => {
      const now = performance.now();
      this.userPaused = !this.userPaused;
      if (this.userPaused) {
        this.pausedElapsed = (now - this.startTime) / 1000;
        this.updateThroughput(this.pausedElapsed);
      } else {
        this.startTime = now - this.pausedElapsed * 1000;
      }
      this.lastMetricUpdate = now;
      this.toggle?.setAttribute("aria-pressed", String(this.userPaused));
      const action = this.userPaused ? "Resume motion" : "Pause motion";
      this.toggle?.setAttribute("title", action);
      this.toggle?.setAttribute("aria-label", action);
      if (this.label) this.label.textContent = action;
      document.body.classList.toggle("motion-paused", this.userPaused);
      window.dispatchEvent(
        new CustomEvent("motionstatechange", { detail: { paused: this.userPaused } }),
      );
      this.draw(performance.now());
      this.updateLoop();
    });
  }

  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    const dprCeiling = window.innerWidth <= 700 ? 1.25 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, dprCeiling);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw(performance.now());
  }

  private shouldAnimate() {
    return this.visible && this.pageVisible && !this.userPaused && !this.reducedMotion;
  }

  private updateThroughput(elapsed: number) {
    if (!this.throughput) return;
    const value = 10.4 + Math.sin(elapsed / 0.95) * 0.6;
    this.throughput.textContent = `${value.toFixed(1)}k/min`;
  }

  private updateLoop() {
    if (this.shouldAnimate() && !this.frame) {
      this.frame = window.requestAnimationFrame((time) => this.tick(time));
    } else if (!this.shouldAnimate() && this.frame) {
      window.cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private tick(time: number) {
    this.frame = 0;
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.06;
    this.draw(time);

    if (this.throughput && time - this.lastMetricUpdate > 220) {
      this.updateThroughput((time - this.startTime) / 1000);
      this.lastMetricUpdate = time;
    }

    if (this.shouldAnimate()) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private getRoutes(): Point[][] {
    const compact = this.width <= 1100;
    const shiftX = this.pointer.x;
    const shiftY = this.pointer.y;

    if (compact) {
      const y = this.height * (this.width < 700 ? 0.97 : 0.94) + shiftY;
      const points = [0.09, 0.295, 0.5, 0.705, 0.91].map((ratio, index) => ({
        x: this.width * ratio + shiftX * (index / 5),
        y,
      }));
      return [points];
    }

    const sourceX = this.width * 0.54;
    const centerY = this.height * 0.5 + shiftY;
    const shared = [
      { x: this.width * 0.64 + shiftX * 0.3, y: centerY },
      { x: this.width * 0.73 + shiftX * 0.55, y: centerY },
      { x: this.width * 0.81 + shiftX * 0.75, y: centerY },
      { x: this.width * 0.89 + shiftX, y: centerY },
    ];
    return [0.29, 0.5, 0.71].map((ratio) => [
      { x: sourceX, y: this.height * ratio + shiftY * 0.25 },
      ...shared,
    ]);
  }

  private routeLength(route: Point[]) {
    let total = 0;
    for (let index = 1; index < route.length; index += 1) {
      total += Math.hypot(route[index].x - route[index - 1].x, route[index].y - route[index - 1].y);
    }
    return total;
  }

  private pointOnRoute(route: Point[], progress: number, total = this.routeLength(route)): Point {
    let remaining = progress * total;

    for (let index = 0; index < route.length - 1; index += 1) {
      const length = Math.hypot(
        route[index + 1].x - route[index].x,
        route[index + 1].y - route[index].y,
      );
      if (remaining <= length) {
        const start = route[index];
        const end = route[index + 1];
        const ratio = remaining / length;
        return {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
      }
      remaining -= length;
    }

    return route[route.length - 1];
  }

  private drawGrid() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(242, 244, 241, 0.06)";
    context.lineWidth = 1;
    const step = this.width <= 1100 ? 32 : 48;

    for (let x = 0.5; x < this.width; x += step) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
      context.stroke();
    }
    for (let y = 0.5; y < this.height; y += step) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.width, y);
      context.stroke();
    }
    context.restore();
  }

  private drawSignalField(time: number) {
    const context = this.context;
    const elapsed = this.reducedMotion
      ? 1.2
      : this.userPaused
        ? this.pausedElapsed
        : (time - this.startTime) / 1000;
    const colors = [visualPalette.blue, visualPalette.live, visualPalette.paper];
    const count = this.width <= 1100 ? 7 : 12;

    context.save();
    for (let index = 0; index < count; index += 1) {
      const baseX = this.width * (0.47 + ((index * 0.137) % 0.5));
      const baseY = this.height * (0.12 + ((index * 0.211) % 0.76));
      const offset = Math.sin(elapsed * 0.7 + index * 1.9) * (index % 3 === 0 ? 9 : 4);
      context.globalAlpha = 0.13 + ((index * 7) % 4) * 0.05;
      context.fillStyle = colors[index % colors.length];
      const size = index % 6 === 0 ? 5 : 3;
      context.fillRect(baseX + offset, baseY - offset * 0.45, size, size);
    }
    context.restore();
  }

  private drawTrustBloom(center: Point, time: number, compact: boolean, reveal: number) {
    const context = this.context;
    const elapsed = this.reducedMotion
      ? 1.2
      : this.userPaused
        ? this.pausedElapsed
        : (time - this.startTime) / 1000;
    const petalCount = compact ? 7 : 9;
    const radius = compact ? 31 : 56;
    const colors = [visualPalette.blue, visualPalette.live];
    const pulse = this.reducedMotion ? 1 : 0.96 + Math.sin(elapsed * 0.8) * 0.04;

    context.save();
    context.translate(center.x, center.y);
    context.rotate(elapsed * 0.035);

    for (let index = 0; index < petalCount; index += 1) {
      const angle = (Math.PI * 2 * index) / petalCount;
      const length = radius * pulse * (index % 2 === 0 ? 1 : 0.78);
      const width = compact ? 9 : 15;
      const tipX = Math.cos(angle) * length;
      const tipY = Math.sin(angle) * length;
      const normalX = Math.cos(angle + Math.PI / 2) * width;
      const normalY = Math.sin(angle + Math.PI / 2) * width;

      context.beginPath();
      context.moveTo(0, 0);
      context.bezierCurveTo(
        tipX * 0.34 + normalX,
        tipY * 0.34 + normalY,
        tipX * 0.76 + normalX * 0.3,
        tipY * 0.76 + normalY * 0.3,
        tipX,
        tipY,
      );
      context.bezierCurveTo(
        tipX * 0.76 - normalX * 0.3,
        tipY * 0.76 - normalY * 0.3,
        tipX * 0.34 - normalX,
        tipY * 0.34 - normalY,
        0,
        0,
      );
      context.globalAlpha = 0.08 + reveal * 0.08;
      context.fillStyle = colors[index % colors.length];
      context.fill();
      context.globalAlpha = 0.28 + reveal * 0.44;
      context.strokeStyle = colors[index % colors.length];
      context.lineWidth = 1;
      context.stroke();
    }

    context.globalAlpha = 0.3 + reveal * 0.34;
    context.strokeStyle = visualPalette.paper;
    context.setLineDash([2, 6]);
    context.beginPath();
    context.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  private drawNode(point: Point, label: string, active = false, reveal = 1) {
    const context = this.context;
    const compact = this.width <= 1100;
    const veryCompact = this.width <= 430;
    const nodeWidth = veryCompact ? 54 : compact ? 70 : 98;
    const nodeHeight = veryCompact ? 32 : compact ? 38 : 44;
    const x = point.x - (1 - reveal) * 18;
    context.save();
    context.globalAlpha = reveal;
    context.fillStyle = active ? visualPalette.live : visualPalette.panel;
    context.strokeStyle = active ? visualPalette.live : "rgba(242, 244, 241, 0.42)";
    context.lineWidth = 1;
    context.fillRect(x - nodeWidth / 2, point.y - nodeHeight / 2, nodeWidth, nodeHeight);
    context.strokeRect(x - nodeWidth / 2, point.y - nodeHeight / 2, nodeWidth, nodeHeight);
    context.fillStyle = active ? "#101513" : "#d9ded9";
    context.font = `600 ${veryCompact ? 10 : compact ? 12 : 13}px IBM Plex Mono, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, x, point.y + 0.5);
    context.restore();
  }

  private draw(time: number) {
    if (!this.width || !this.height) return;
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.drawGrid();
    this.drawSignalField(time);

    const routes = this.getRoutes();
    const routeLengths = routes.map((route) => this.routeLength(route));
    const compact = this.width <= 1100;
    const labels = compact
      ? ["RAW", "INGEST", "MODEL", "CHECK", "SERVE"]
      : ["SOURCE", "INGEST", "TRANSFORM", "QUALITY", "WAREHOUSE"];
    const elapsed = this.reducedMotion
      ? 1.2
      : this.userPaused
        ? this.pausedElapsed
        : (time - this.startTime) / 1000;
    const routeReveal = this.reducedMotion ? 1 : easeOutCubic(clamp(elapsed / 1.05));

    context.save();
    context.strokeStyle = "rgba(242, 244, 241, 0.28)";
    context.lineWidth = 1;
    routes.forEach((route, routeIndex) => {
      const length = routeLengths[routeIndex];
      context.setLineDash([Math.max(length * routeReveal, 1), length + 1]);
      context.beginPath();
      context.moveTo(route[0].x, route[0].y);
      route.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
    context.setLineDash([]);
    context.strokeStyle = "rgba(64, 95, 174, 0.7)";
    context.setLineDash([18, 14]);
    context.lineDashOffset = -elapsed * 28;
    routes.forEach((route) => {
      context.beginPath();
      context.moveTo(route[0].x, route[0].y);
      route.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
    context.restore();

    const primaryRoute = routes[Math.floor(routes.length / 2)];
    const bloomReveal = easeOutCubic(clamp((elapsed - 0.72) / 0.5));
    this.drawTrustBloom(primaryRoute[primaryRoute.length - 1], time, compact, bloomReveal);
    primaryRoute.forEach((point, index) => {
      const nodeReveal = easeOutCubic(clamp((elapsed - index * 0.11) / 0.48));
      this.drawNode(point, labels[index], index === labels.length - 1, nodeReveal);
    });

    if (routes.length > 1) {
      routes.forEach((route, index) => {
        if (index !== Math.floor(routes.length / 2)) {
          this.drawNode(route[0], `SRC 0${index + 1}`, false, easeOutCubic(clamp(elapsed / 0.48)));
        }
      });
    }

    const colors = [visualPalette.paper, visualPalette.blue, visualPalette.live];
    const packetCount = compact ? 7 : 12;

    for (let index = 0; index < packetCount; index += 1) {
      const route = routes[index % routes.length];
      const routeLength = routeLengths[index % routes.length];
      const progress = (elapsed * (0.13 + (index % 4) * 0.012) + index / packetCount) % 1;
      const point = this.pointOnRoute(route, progress, routeLength);
      const tail = this.pointOnRoute(route, Math.max(0, progress - 0.028), routeLength);
      const color = colors[index % colors.length];
      context.save();
      context.globalAlpha = 0.28;
      context.strokeStyle = color;
      context.lineWidth = index % 4 === 0 ? 2 : 1;
      context.beginPath();
      context.moveTo(tail.x, tail.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      context.globalAlpha = 0.95;
      context.fillStyle = color;
      const size = index % 5 === 0 ? 6 : 4;
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
      context.restore();
    }

  }
}

class TrustBloomScene {
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private section: HTMLElement;
  private stage: HTMLElement;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private frame = 0;
  private visible = false;
  private pageVisible = !document.hidden;
  private reducedMotion = reducedMotionQuery.matches;
  private userPaused = false;
  private progress = 0.24;
  private startTime = performance.now();
  private pausedElapsed = 0;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  constructor(canvas: HTMLCanvasElement, section: HTMLElement, stage: HTMLElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable");
    this.canvas = canvas;
    this.context = context;
    this.section = section;
    this.stage = stage;
    this.bind();
    this.resize();
    this.updateProgress();
    this.draw(performance.now());
  }

  private bind() {
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.stage);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = Boolean(entry?.isIntersecting);
        if (this.visible) {
          this.updateProgress();
          this.draw(performance.now());
        }
        this.updateLoop();
      },
      { rootMargin: "20% 0px 20% 0px", threshold: 0.01 },
    );
    visibilityObserver.observe(this.stage);

    let scrollQueued = false;
    const requestProgress = () => {
      if (!this.visible || scrollQueued) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        this.updateProgress();
        this.draw(performance.now());
        scrollQueued = false;
      });
    };

    window.addEventListener("scroll", requestProgress, { passive: true });

    document.addEventListener("visibilitychange", () => {
      this.pageVisible = !document.hidden;
      this.updateLoop();
    });

    reducedMotionQuery.addEventListener("change", (event) => {
      this.reducedMotion = event.matches;
      this.progress = event.matches ? 1 : this.progress;
      this.draw(performance.now());
      this.updateLoop();
    });

    window.addEventListener("motionstatechange", (event) => {
      const paused = Boolean((event as CustomEvent<{ paused: boolean }>).detail?.paused);
      if (paused && !this.userPaused) {
        this.pausedElapsed = (performance.now() - this.startTime) / 1000;
      } else if (!paused && this.userPaused) {
        this.startTime = performance.now() - this.pausedElapsed * 1000;
      }
      this.userPaused = paused;
      this.draw(performance.now());
      this.updateLoop();
    });

    if (finePointerQuery.matches) {
      this.stage.addEventListener("pointermove", (event) => {
        const bounds = this.stage.getBoundingClientRect();
        this.pointer.targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 16;
        this.pointer.targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 16;
      });
      this.stage.addEventListener("pointerleave", () => {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
      });
    }
  }

  private resize() {
    const bounds = this.stage.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw(performance.now());
  }

  private updateProgress() {
    if (this.reducedMotion) {
      this.progress = 1;
      return;
    }
    const bounds = this.section.getBoundingClientRect();
    const viewport = window.innerHeight;
    this.progress = clamp((viewport * 0.94 - bounds.top) / (bounds.height + viewport * 0.36));
  }

  private shouldAnimate() {
    return this.visible && this.pageVisible && !this.reducedMotion && !this.userPaused;
  }

  private updateLoop() {
    if (this.shouldAnimate() && !this.frame) {
      this.frame = window.requestAnimationFrame((time) => this.tick(time));
    } else if (!this.shouldAnimate() && this.frame) {
      window.cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private tick(time: number) {
    this.frame = 0;
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.055;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.055;
    this.draw(time);
    if (this.shouldAnimate()) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private drawGrid() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(242, 244, 241, 0.07)";
    context.lineWidth = 1;
    const step = this.width < 380 ? 28 : 34;
    for (let x = 0.5; x < this.width; x += step) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.height);
      context.stroke();
    }
    for (let y = 0.5; y < this.height; y += step) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.width, y);
      context.stroke();
    }
    context.restore();
  }

  private drawPetal(
    angle: number,
    length: number,
    width: number,
    color: string,
    alpha: number,
  ) {
    const context = this.context;
    const tipX = Math.cos(angle) * length;
    const tipY = Math.sin(angle) * length;
    const normalX = Math.cos(angle + Math.PI / 2) * width;
    const normalY = Math.sin(angle + Math.PI / 2) * width;

    context.beginPath();
    context.moveTo(0, 0);
    context.bezierCurveTo(
      tipX * 0.28 + normalX,
      tipY * 0.28 + normalY,
      tipX * 0.76 + normalX * 0.34,
      tipY * 0.76 + normalY * 0.34,
      tipX,
      tipY,
    );
    context.bezierCurveTo(
      tipX * 0.76 - normalX * 0.34,
      tipY * 0.76 - normalY * 0.34,
      tipX * 0.28 - normalX,
      tipY * 0.28 - normalY,
      0,
      0,
    );
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fill();
    context.globalAlpha = Math.min(1, alpha * 4.2);
    context.strokeStyle = color;
    context.lineWidth = 1.2;
    context.stroke();
  }

  private draw(time: number) {
    if (!this.width || !this.height) return;
    const context = this.context;
    const elapsed = this.reducedMotion
      ? 1.2
      : this.userPaused
        ? this.pausedElapsed
        : (time - this.startTime) / 1000;
    const open = this.reducedMotion ? 1 : easeOutCubic(clamp(this.progress * 1.22 + 0.04));
    const minSize = Math.min(this.width, this.height);
    const centerX = this.width / 2 + this.pointer.x;
    const centerY = this.height / 2 - minSize * 0.035 + this.pointer.y;
    const outerRadius = minSize * (0.2 + open * 0.23);
    const colors = [visualPalette.blue, visualPalette.live];

    context.clearRect(0, 0, this.width, this.height);
    context.fillStyle = visualPalette.void;
    context.fillRect(0, 0, this.width, this.height);
    this.drawGrid();

    context.save();
    context.translate(centerX, centerY);
    context.rotate(elapsed * 0.045 + open * 0.18);

    const outerPetals = 12;
    for (let index = 0; index < outerPetals; index += 1) {
      const angle = (Math.PI * 2 * index) / outerPetals;
      const alternating = index % 2 === 0 ? 1 : 0.84;
      this.drawPetal(
        angle,
        outerRadius * alternating,
        minSize * (0.035 + open * 0.022),
        colors[index % colors.length],
        0.1 + open * 0.08,
      );
    }

    context.rotate(-elapsed * 0.09 - 0.2);
    const innerPetals = 8;
    for (let index = 0; index < innerPetals; index += 1) {
      const angle = (Math.PI * 2 * index) / innerPetals + Math.PI / innerPetals;
      this.drawPetal(
        angle,
        outerRadius * 0.58,
        minSize * (0.028 + open * 0.018),
        colors[(index + 2) % colors.length],
        0.16 + open * 0.1,
      );
    }

    context.globalAlpha = 0.68;
    context.strokeStyle = visualPalette.paper;
    context.lineWidth = 1;
    context.setLineDash([2, 7]);
    [0.52, 0.78, 1].forEach((ratio) => {
      context.beginPath();
      context.arc(0, 0, outerRadius * ratio, 0, Math.PI * 2);
      context.stroke();
    });
    context.setLineDash([]);

    const packetCount = this.width < 380 ? 10 : 16;
    for (let index = 0; index < packetCount; index += 1) {
      const angle = (Math.PI * 2 * (index % outerPetals)) / outerPetals;
      const travel = this.reducedMotion
        ? 0.66
        : (elapsed * (0.12 + (index % 4) * 0.018) + index / packetCount) % 1;
      const radius = outerRadius * (0.14 + travel * 0.92) * open;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const size = index % 5 === 0 ? 6 : 4;
      context.globalAlpha = 0.95;
      context.fillStyle = colors[index % colors.length];
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }

    context.globalAlpha = 1;
    context.fillStyle = visualPalette.blue;
    context.fillRect(-37, -37, 74, 74);
    context.fillStyle = "#27362f";
    context.fillRect(-31, -31, 62, 62);
    context.fillStyle = visualPalette.void;
    context.fillRect(-25, -25, 50, 50);
    context.restore();

    context.save();
    context.fillStyle = "rgba(242, 244, 241, 0.58)";
    context.font = "11px IBM Plex Mono, monospace";
    context.fillText("SIGNAL / BLOOM", 14, 22);
    context.textAlign = "right";
    context.fillText(`${Math.round(open * 100)}% OPEN`, this.width - 14, 22);
    context.restore();
  }
}

async function setupDataFlow() {
  const canvas = document.querySelector<HTMLCanvasElement>("#data-flow");
  if (!canvas) return;
  let fallbackCanvas = canvas;

  if (!reducedMotionQuery.matches && window.innerWidth > 680) {
    try {
      const { ThreeDataFlowScene } = await import("./three-flow");
      new ThreeDataFlowScene(canvas);
      return;
    } catch (error) {
      console.warn("3D data-flow scene unavailable; using the lightweight canvas.", error);
      fallbackCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
      canvas.replaceWith(fallbackCanvas);
    }
  }

  try {
    new DataFlowScene(fallbackCanvas);
  } catch {
    const toggle = document.querySelector<HTMLButtonElement>("#flow-toggle");
    const label = toggle?.querySelector<HTMLElement>("[data-flow-label]");
    if (!toggle) return;
    let paused = false;
    toggle.addEventListener("click", () => {
      paused = !paused;
      const action = paused ? "Resume motion" : "Pause motion";
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.setAttribute("aria-label", action);
      toggle.setAttribute("title", action);
      if (label) label.textContent = action;
      document.body.classList.toggle("motion-paused", paused);
      window.dispatchEvent(new CustomEvent("motionstatechange", { detail: { paused } }));
    });
  }
}

function setupTrustBloom() {
  const canvas = document.querySelector<HTMLCanvasElement>("#trust-bloom");
  const section = document.querySelector<HTMLElement>("[data-bloom-section]");
  const stage = document.querySelector<HTMLElement>("[data-bloom-stage]");
  if (!canvas || !section || !stage) return;
  try {
    new TrustBloomScene(canvas, section, stage);
  } catch {
    canvas.remove();
  }
}

setupHeader();
setupMenu();
setupRevealMotion();
setupActiveNavigation();
setupCounters();
setupMotionSections();
setupPortraitReveal();
setupScrollMonitor();
setupExperienceSpotlight();
setupContactActions();
setupBackToTop();
setupTiltSurfaces();
setupCapabilitySpotlight();
setupDataFlow();
setupTrustBloom();
