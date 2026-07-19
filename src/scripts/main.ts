const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const lightweightMotionQuery = window.matchMedia("(max-width: 920px), (pointer: coarse)");
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
    if (!href?.startsWith("#")) {
      close(true);
      return;
    }
    close();
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
    if (window.innerWidth > 920 && button.getAttribute("aria-expanded") === "true") {
      close(true);
    }
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
  let lightweightMotion = lightweightMotionQuery.matches;

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

  if (reducedMotion || lightweightMotion) applyReducedMotionState();

  if ("IntersectionObserver" in window && !lightweightMotion) {
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
    if (userPaused || reducedMotion || lightweightMotion) {
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
    if (queued || lightweightMotion) return;
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
  lightweightMotionQuery.addEventListener("change", (event) => {
    lightweightMotion = event.matches;
    if (lightweightMotion) applyReducedMotionState();
    requestUpdate();
  });
  update();
}

function setupPortraitReveal() {
  const portrait = document.querySelector<HTMLElement>("[data-portrait]");
  if (!portrait) return;

  portrait.querySelector<HTMLElement>(".portrait-scan")?.remove();

  let userPaused = false;
  let reducedMotion = reducedMotionQuery.matches;
  let nearby = true;
  let queued = false;

  if ("IntersectionObserver" in window) {
    const proximityObserver = new IntersectionObserver(
      ([entry]) => {
        nearby = Boolean(entry?.isIntersecting);
        if (nearby) requestUpdate();
      },
      { rootMargin: "100% 0px 100% 0px", threshold: 0 },
    );
    proximityObserver.observe(portrait);
  }

  const apply = (focusInput: number) => {
    const colorFocus = smoothstep(clamp(focusInput));
    const grayscale = 1 - colorFocus;
    portrait.style.setProperty("--portrait-gray", grayscale.toFixed(3));
    portrait.style.setProperty(
      "--portrait-saturation",
      (0.86 + colorFocus * 0.32).toFixed(3),
    );
    portrait.style.setProperty("--portrait-contrast", (1.1 - colorFocus * 0.04).toFixed(3));
    portrait.style.setProperty("--portrait-frame-x", `${(colorFocus * 8).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-frame-y", `${(colorFocus * 8).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-line-x", `${(colorFocus * -6).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-line-y", `${(colorFocus * -6).toFixed(2)}px`);
    portrait.style.setProperty("--portrait-focus", colorFocus.toFixed(3));
    portrait.style.setProperty("--portrait-scale", (1 + colorFocus * 0.035).toFixed(3));
    portrait.dataset.portraitFocus = colorFocus.toFixed(3);
  };

  const update = () => {
    if (!nearby) {
      queued = false;
      return;
    }
    if (reducedMotion) {
      portrait.dataset.portraitPhase = "center";
      apply(1);
      queued = false;
      return;
    }
    if (userPaused) {
      queued = false;
      return;
    }

    const bounds = portrait.getBoundingClientRect();
    const viewport = window.innerHeight;
    const portraitCenter = bounds.top + bounds.height * 0.5;
    const viewportCenter = viewport * 0.5;
    const centerDelta = portraitCenter - viewportCenter;
    const focusRange = Math.max(viewport * 0.58, bounds.height * 0.9, 1);
    const colorFocus = 1 - clamp(Math.abs(centerDelta) / focusRange);
    const centerThreshold = focusRange * 0.08;
    portrait.dataset.portraitPhase =
      Math.abs(centerDelta) <= centerThreshold
        ? "center"
        : centerDelta > 0
          ? "approach"
          : "depart";
    portrait.classList.toggle(
      "is-portrait-active",
      colorFocus > 0.3 && bounds.bottom > 0 && bounds.top < viewport,
    );
    apply(colorFocus);
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

type CursorEcho = {
  element: HTMLSpanElement;
  x: number;
  y: number;
  born: number;
  active: boolean;
};

function setupPrecisionCursor() {
  let unmount: (() => void) | null = null;
  let userPaused = false;

  const mount = () => {
    const controller = new AbortController();
    const style = document.createElement("style");
    style.dataset.precisionCursorStyle = "";
    style.textContent = `
      body.has-custom-cursor,
      body.has-custom-cursor * { cursor: none !important; }
      .cursor-system {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        overflow: hidden;
        pointer-events: none !important;
        opacity: 0;
        contain: strict;
      }
      .cursor-dot,
      .cursor-ring,
      .cursor-echo {
        position: absolute;
        top: 0;
        left: 0;
        display: block;
        border-radius: 50%;
        pointer-events: none !important;
        will-change: transform, opacity;
      }
      .cursor-dot {
        width: 7px;
        height: 7px;
        background: #f2f4f1;
        box-shadow: 0 0 0 2px rgba(8, 11, 10, 0.42), 0 0 12px rgba(93, 214, 209, 0.78);
      }
      .cursor-ring {
        width: 30px;
        height: 30px;
        border: 1px solid rgba(93, 214, 209, 0.86);
        background: radial-gradient(circle, rgba(93, 214, 209, 0.08), transparent 64%);
        box-shadow: inset 0 0 0 1px rgba(8, 11, 10, 0.28), 0 0 18px rgba(64, 95, 174, 0.24);
      }
      .cursor-echo {
        width: 14px;
        height: 14px;
        border: 1px solid rgba(93, 214, 209, 0.7);
        opacity: 0;
      }
      .cursor-system.is-interactive .cursor-ring {
        border-color: rgba(184, 216, 121, 0.96);
        background: radial-gradient(circle, rgba(184, 216, 121, 0.12), transparent 66%);
      }
      .cursor-system.is-canvas .cursor-ring {
        border-color: rgba(93, 214, 209, 1);
        box-shadow: inset 0 0 0 1px rgba(64, 95, 174, 0.34), 0 0 22px rgba(93, 214, 209, 0.34);
      }
    `;

    const root = document.createElement("div");
    root.className = "cursor-system";
    root.setAttribute("aria-hidden", "true");

    const ring = document.createElement("span");
    ring.className = "cursor-ring";
    const point = document.createElement("span");
    point.className = "cursor-dot";
    const echoes: CursorEcho[] = Array.from({ length: 5 }, () => {
      const element = document.createElement("span");
      element.className = "cursor-echo";
      root.append(element);
      return { element, x: 0, y: 0, born: 0, active: false };
    });
    root.append(ring, point);
    document.head.append(style);
    document.body.append(root);
    document.body.classList.add("has-custom-cursor");

    let targetX = 0;
    let targetY = 0;
    let ringX = 0;
    let ringY = 0;
    let ringScale = 1;
    let pointScale = 1;
    let visible = false;
    let pressed = false;
    let overInteractive = false;
    let overCanvas = false;
    let echoIndex = 0;
    let lastEchoTime = 0;
    let lastEchoX = 0;
    let lastEchoY = 0;
    let frame = 0;

    const transformAt = (x: number, y: number, scale: number) =>
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate3d(-50%, -50%, 0) scale(${scale.toFixed(3)})`;

    const requestFrame = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const render = (time: number) => {
      frame = 0;
      ringX += (targetX - ringX) * 0.2;
      ringY += (targetY - ringY) * 0.2;
      const targetRingScale = (overCanvas ? 2 : overInteractive ? 1.58 : 1) * (pressed ? 0.78 : 1);
      const targetPointScale = pressed ? 1.65 : overCanvas ? 1.16 : 1;
      ringScale += (targetRingScale - ringScale) * 0.22;
      pointScale += (targetPointScale - pointScale) * 0.28;

      root.style.opacity = visible ? "1" : "0";
      ring.style.transform = transformAt(ringX, ringY, ringScale);
      point.style.transform = transformAt(targetX, targetY, pointScale);
      ring.style.opacity = visible ? "0.94" : "0";
      point.style.opacity = visible ? "1" : "0";

      let hasActiveEcho = false;
      echoes.forEach((echo) => {
        if (!echo.active) return;
        const life = clamp((time - echo.born) / 280);
        if (life >= 1) {
          echo.active = false;
          echo.element.style.opacity = "0";
          return;
        }
        hasActiveEcho = true;
        echo.element.style.opacity = (0.34 * (1 - life) ** 2).toFixed(3);
        echo.element.style.transform = transformAt(echo.x, echo.y, 0.55 + life * 1.35);
      });

      const unsettled =
        Math.abs(targetX - ringX) > 0.08 ||
        Math.abs(targetY - ringY) > 0.08 ||
        Math.abs(targetRingScale - ringScale) > 0.004 ||
        Math.abs(targetPointScale - pointScale) > 0.004;
      if (hasActiveEcho || unsettled) requestFrame();
    };

    const setContext = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      overInteractive = Boolean(
        target?.closest(
          'a, button, input, select, textarea, summary, [role="button"], [data-tilt-surface]',
        ),
      );
      overCanvas = document
        .elementsFromPoint(event.clientX, event.clientY)
        .some((element) => element instanceof HTMLCanvasElement);
      root.classList.toggle("is-interactive", overInteractive || overCanvas);
      root.classList.toggle("is-canvas", overCanvas);
    };

    const addEcho = (time: number) => {
      const distance = Math.hypot(targetX - lastEchoX, targetY - lastEchoY);
      if (time - lastEchoTime < 42 || distance < 9) return;
      const echo = echoes[echoIndex];
      echoIndex = (echoIndex + 1) % echoes.length;
      echo.x = ringX;
      echo.y = ringY;
      echo.born = time;
      echo.active = true;
      lastEchoTime = time;
      lastEchoX = targetX;
      lastEchoY = targetY;
    };

    const show = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      const firstMove = !visible;
      targetX = event.clientX;
      targetY = event.clientY;
      if (firstMove) {
        ringX = targetX;
        ringY = targetY;
        lastEchoX = targetX;
        lastEchoY = targetY;
      } else {
        addEcho(performance.now());
      }
      visible = true;
      setContext(event);
      requestFrame();
    };

    const hide = () => {
      visible = false;
      pressed = false;
      root.classList.remove("is-pressed", "is-interactive", "is-canvas");
      requestFrame();
    };

    document.addEventListener("pointermove", show, { passive: true, signal: controller.signal });
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (event.pointerType && event.pointerType !== "mouse") return;
        pressed = true;
        root.classList.add("is-pressed");
        requestFrame();
      },
      { passive: true, signal: controller.signal },
    );
    document.addEventListener(
      "pointerup",
      () => {
        pressed = false;
        root.classList.remove("is-pressed");
        requestFrame();
      },
      { passive: true, signal: controller.signal },
    );
    document.addEventListener(
      "pointerout",
      (event) => {
        if (!event.relatedTarget) hide();
      },
      { passive: true, signal: controller.signal },
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hide();
    }, { signal: controller.signal });
    window.addEventListener("blur", hide, { signal: controller.signal });

    return () => {
      controller.abort();
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      document.body.classList.remove("has-custom-cursor");
      root.remove();
      style.remove();
    };
  };

  const sync = () => {
    const enabled = finePointerQuery.matches && !reducedMotionQuery.matches && !userPaused;
    if (enabled && !unmount) unmount = mount();
    if (!enabled && unmount) {
      unmount();
      unmount = null;
    }
  };

  finePointerQuery.addEventListener("change", sync);
  reducedMotionQuery.addEventListener("change", sync);
  window.addEventListener("motionstatechange", (event) => {
    userPaused = Boolean((event as CustomEvent<{ paused: boolean }>).detail?.paused);
    sync();
  });
  window.addEventListener("pagehide", () => {
    unmount?.();
    unmount = null;
  });
  window.addEventListener("pageshow", sync);
  sync();
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

  if (window.innerWidth <= 1100 && contact && "IntersectionObserver" in window) {
    const contactObserver = new IntersectionObserver(
      ([entry]) => document.body.classList.toggle("at-contact", Boolean(entry?.isIntersecting)),
      { rootMargin: "-38% 0px -20% 0px", threshold: 0 },
    );
    contactObserver.observe(contact);
    return;
  }

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

  if (lightweightMotionQuery.matches && "IntersectionObserver" in window) {
    rows[0].classList.add("is-experience-active");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          rows.forEach((row) => row.classList.toggle("is-experience-active", row === entry.target));
        });
      },
      { rootMargin: "-38% 0px -38% 0px", threshold: 0 },
    );
    rows.forEach((row) => observer.observe(row));
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
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        // Continue to the selection-based fallback for restricted browsers.
      }
    }

    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    helper.style.pointerEvents = "none";
    document.body.append(helper);
    helper.select();
    const legacyCopy = (document as unknown as { execCommand?: (command: string) => boolean })
      .execCommand;
    const copied = legacyCopy ? legacyCopy.call(document, "copy") : false;
    helper.remove();
    return copied;
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
  private lastRender = 0;
  private controller = new AbortController();
  private resizeObserver: ResizeObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;

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
    const { signal } = this.controller;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);

    this.visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        this.visible = Boolean(entry?.isIntersecting);
        this.updateLoop();
      },
      { threshold: 0.02 },
    );
    this.visibilityObserver.observe(this.canvas);

    document.addEventListener("visibilitychange", () => {
      this.pageVisible = !document.hidden;
      this.updateLoop();
    }, { signal });

    reducedMotionQuery.addEventListener("change", (event) => {
      this.reducedMotion = event.matches;
      this.draw(performance.now());
      this.updateLoop();
    }, { signal });

    if (finePointerQuery.matches) {
      this.canvas.parentElement?.addEventListener("pointermove", (event) => {
        const bounds = this.canvas.getBoundingClientRect();
        this.pointer.targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 14;
        this.pointer.targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
      }, { signal });

      this.canvas.parentElement?.addEventListener("pointerleave", () => {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
      }, { signal });
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
    }, { signal });
  }

  public destroy() {
    if (this.frame) window.cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.controller.abort();
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
    const frameInterval = window.innerWidth <= 700 ? 1000 / 30 : 1000 / 45;
    if (this.lastRender && time - this.lastRender < frameInterval) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
      return;
    }
    this.lastRender = time;
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
  private lastRender = 0;
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
      if (!this.visible || scrollQueued || this.userPaused || this.reducedMotion) return;
      scrollQueued = true;
      window.requestAnimationFrame(() => {
        this.updateProgress();
        if (!this.frame) this.draw(performance.now());
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
      if (event.matches) {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
        this.pointer.x = 0;
        this.pointer.y = 0;
      }
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
        if (this.reducedMotion) return;
        const bounds = this.stage.getBoundingClientRect();
        this.pointer.targetX = clamp(
          ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2,
          -1,
          1,
        );
        this.pointer.targetY = clamp(
          ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2,
          -1,
          1,
        );
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
    const frameInterval = lightweightMotionQuery.matches ? 1000 / 30 : 1000 / 45;
    if (this.lastRender && time - this.lastRender < frameInterval) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
      return;
    }
    this.lastRender = time;
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.07;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.07;
    this.draw(time);
    if (this.shouldAnimate()) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private drawGrid(offsetX: number, offsetY: number) {
    const context = this.context;
    context.save();
    context.translate(offsetX, offsetY);
    context.strokeStyle = "rgba(93, 214, 209, 0.075)";
    context.lineWidth = 1;
    const step = this.width < 380 ? 28 : 34;
    for (let x = -step + 0.5; x < this.width + step; x += step) {
      context.beginPath();
      context.moveTo(x, -step);
      context.lineTo(x, this.height + step);
      context.stroke();
    }
    for (let y = -step + 0.5; y < this.height + step; y += step) {
      context.beginPath();
      context.moveTo(-step, y);
      context.lineTo(this.width + step, y);
      context.stroke();
    }

    const vanishingX = this.width * 0.5;
    const vanishingY = this.height * 0.47;
    context.strokeStyle = "rgba(64, 95, 174, 0.09)";
    for (let index = -4; index <= 4; index += 1) {
      context.beginPath();
      context.moveTo(vanishingX, vanishingY);
      context.lineTo(vanishingX + index * this.width * 0.21, this.height + step);
      context.stroke();
    }
    context.restore();
  }

  private drawDepthPlane(
    radius: number,
    depth: number,
    rotation: number,
    stroke: string,
    fill: string,
    parallaxX: number,
    parallaxY: number,
  ) {
    const context = this.context;
    const chamfer = radius * 0.22;
    context.save();
    context.translate(parallaxX * depth * 10, parallaxY * depth * 8);
    context.rotate(rotation);
    context.scale(1, 0.58 + depth * 0.08);
    context.beginPath();
    context.moveTo(-radius + chamfer, -radius);
    context.lineTo(radius - chamfer, -radius);
    context.lineTo(radius, -radius + chamfer);
    context.lineTo(radius, radius - chamfer);
    context.lineTo(radius - chamfer, radius);
    context.lineTo(-radius + chamfer, radius);
    context.lineTo(-radius, radius - chamfer);
    context.lineTo(-radius, -radius + chamfer);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
    context.restore();
  }

  private drawOrbit(
    radius: number,
    yScale: number,
    rotation: number,
    color: string,
    alpha: number,
    dashed = false,
  ) {
    const context = this.context;
    context.save();
    context.rotate(rotation);
    context.scale(1, yScale);
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.lineWidth = 1;
    context.setLineDash(dashed ? [2, 7] : []);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();
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
    const parallaxX = this.reducedMotion ? 0 : this.pointer.x;
    const parallaxY = this.reducedMotion ? 0 : this.pointer.y;
    const centerX = this.width / 2 + parallaxX * minSize * 0.018;
    const centerY = this.height / 2 - minSize * 0.035 + parallaxY * minSize * 0.014;
    const outerRadius = minSize * (0.2 + open * 0.225);
    const cyan = "#5dd6d1";
    const cobalt = visualPalette.blue;
    const phosphor = visualPalette.live;
    const colors = [cyan, cobalt, phosphor];

    context.clearRect(0, 0, this.width, this.height);
    context.fillStyle = visualPalette.void;
    context.fillRect(0, 0, this.width, this.height);
    const ambientGlow = context.createRadialGradient(
      centerX,
      centerY,
      minSize * 0.04,
      centerX,
      centerY,
      minSize * 0.62,
    );
    ambientGlow.addColorStop(0, "rgba(64, 95, 174, 0.18)");
    ambientGlow.addColorStop(0.48, "rgba(93, 214, 209, 0.055)");
    ambientGlow.addColorStop(1, "rgba(8, 11, 10, 0)");
    context.fillStyle = ambientGlow;
    context.fillRect(0, 0, this.width, this.height);
    this.drawGrid(parallaxX * 5, parallaxY * 4);

    context.save();
    context.translate(centerX, centerY);

    const planeColors = [
      ["rgba(64, 95, 174, 0.34)", "rgba(64, 95, 174, 0.025)"],
      ["rgba(93, 214, 209, 0.3)", "rgba(93, 214, 209, 0.022)"],
      ["rgba(184, 216, 121, 0.26)", "rgba(184, 216, 121, 0.018)"],
    ] as const;
    for (let layer = 0; layer < planeColors.length; layer += 1) {
      const depth = (layer + 1) / planeColors.length;
      this.drawDepthPlane(
        outerRadius * (0.48 + layer * 0.2),
        depth,
        elapsed * (0.014 + layer * 0.006) + layer * 0.26 + parallaxX * 0.05,
        planeColors[layer][0],
        planeColors[layer][1],
        parallaxX,
        parallaxY,
      );
    }

    this.drawOrbit(outerRadius * 1.02, 0.58, elapsed * 0.026 + parallaxX * 0.08, cyan, 0.34, true);
    this.drawOrbit(
      outerRadius * 0.82,
      0.72,
      -elapsed * 0.038 + 1.04 + parallaxY * 0.06,
      cobalt,
      0.5,
    );
    this.drawOrbit(
      outerRadius * 0.62,
      0.88,
      elapsed * 0.052 - 0.72,
      phosphor,
      0.44,
      true,
    );

    context.save();
    context.rotate(elapsed * 0.045 + open * 0.18 + parallaxX * 0.035);
    context.scale(1, 0.88);

    const outerPetals = 12;
    for (let index = 0; index < outerPetals; index += 1) {
      const angle = (Math.PI * 2 * index) / outerPetals;
      const alternating = index % 2 === 0 ? 1 : 0.84;
      this.drawPetal(
        angle,
        outerRadius * alternating,
        minSize * (0.035 + open * 0.022),
        colors[index % colors.length],
        0.08 + open * 0.07,
      );
    }
    context.restore();

    context.save();
    context.rotate(-elapsed * 0.09 - 0.2 - parallaxY * 0.04);
    context.scale(1, 0.94);
    const innerPetals = 8;
    for (let index = 0; index < innerPetals; index += 1) {
      const angle = (Math.PI * 2 * index) / innerPetals + Math.PI / innerPetals;
      this.drawPetal(
        angle,
        outerRadius * 0.58,
        minSize * (0.028 + open * 0.018),
        colors[(index + 1) % colors.length],
        0.16 + open * 0.1,
      );
    }
    context.restore();

    context.globalAlpha = 0.32 + open * 0.26;
    context.strokeStyle = "rgba(242, 244, 241, 0.82)";
    context.lineWidth = 1;
    context.setLineDash([2, 7]);
    [0.52, 0.78, 1].forEach((ratio) => {
      context.beginPath();
      context.ellipse(0, 0, outerRadius * ratio, outerRadius * ratio * 0.72, 0, 0, Math.PI * 2);
      context.stroke();
    });
    context.setLineDash([]);

    const packetCount = this.width < 380 ? 14 : 20;
    context.globalCompositeOperation = "lighter";
    for (let index = 0; index < packetCount; index += 1) {
      const layer = index % 3;
      const radius = outerRadius * (0.54 + layer * 0.22) * open;
      const yScale = 0.58 + layer * 0.14;
      const direction = layer === 1 ? -1 : 1;
      const angle =
        direction * elapsed * (0.24 + layer * 0.045) +
        (Math.PI * 2 * index) / packetCount +
        layer * 0.42;
      const x = Math.cos(angle) * radius + parallaxX * layer * 2.2;
      const y = Math.sin(angle) * radius * yScale + parallaxY * layer * 1.8;
      const tailAngle = angle - direction * 0.075;
      const tailX = Math.cos(tailAngle) * radius + parallaxX * layer * 2.2;
      const tailY = Math.sin(tailAngle) * radius * yScale + parallaxY * layer * 1.8;
      context.globalAlpha = 0.28 + layer * 0.12;
      context.strokeStyle = colors[index % colors.length];
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.stroke();
      const size = index % 5 === 0 ? 5.5 : 3.5;
      context.globalAlpha = 0.9;
      context.fillStyle = colors[index % colors.length];
      context.fillRect(x - size / 2, y - size / 2, size, size);
    }

    const radialPackets = this.width < 380 ? 6 : 9;
    for (let index = 0; index < radialPackets; index += 1) {
      const angle = (Math.PI * 2 * index) / radialPackets + 0.2;
      const travel = this.reducedMotion
        ? 0.58
        : (elapsed * (0.1 + (index % 3) * 0.018) + index / radialPackets) % 1;
      const radius = outerRadius * (0.94 - travel * 0.68) * open;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.82;
      context.globalAlpha = 0.3 + travel * 0.55;
      context.fillStyle = colors[(index + 1) % colors.length];
      context.save();
      context.translate(x, y);
      context.rotate(angle + Math.PI / 4);
      context.fillRect(-2.5, -2.5, 5, 5);
      context.restore();
    }
    context.globalCompositeOperation = "source-over";

    const pulse = this.reducedMotion ? 1 : 0.94 + Math.sin(elapsed * 1.8) * 0.06;
    const halo = context.createRadialGradient(0, 0, 4, 0, 0, minSize * 0.2);
    halo.addColorStop(0, "rgba(93, 214, 209, 0.28)");
    halo.addColorStop(0.5, "rgba(64, 95, 174, 0.12)");
    halo.addColorStop(1, "rgba(8, 11, 10, 0)");
    context.globalAlpha = open;
    context.fillStyle = halo;
    context.beginPath();
    context.arc(0, 0, minSize * 0.2 * pulse, 0, Math.PI * 2);
    context.fill();

    const coreSize = minSize * 0.245;
    const coreLayers = [
      { offset: 10, fill: "rgba(64, 95, 174, 0.34)", stroke: cobalt },
      { offset: 5, fill: "rgba(93, 214, 209, 0.16)", stroke: cyan },
      { offset: 0, fill: "rgba(8, 11, 10, 0.96)", stroke: phosphor },
    ];
    coreLayers.forEach((layer, index) => {
      const inset = index * 7;
      context.globalAlpha = 0.78 + index * 0.1;
      context.fillStyle = layer.fill;
      context.strokeStyle = layer.stroke;
      context.lineWidth = 1;
      context.fillRect(
        -coreSize / 2 + inset + layer.offset,
        -coreSize / 2 + inset + layer.offset * 0.68,
        coreSize - inset * 2,
        coreSize - inset * 2,
      );
      context.strokeRect(
        -coreSize / 2 + inset + layer.offset,
        -coreSize / 2 + inset + layer.offset * 0.68,
        coreSize - inset * 2,
        coreSize - inset * 2,
      );
    });

    context.globalAlpha = 0.76;
    context.strokeStyle = cyan;
    context.lineWidth = 1;
    const bracket = coreSize * 0.72;
    const corner = 10;
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].forEach(([xDirection, yDirection]) => {
      const x = (bracket / 2) * xDirection;
      const y = (bracket / 2) * yDirection;
      context.beginPath();
      context.moveTo(x - corner * xDirection, y);
      context.lineTo(x, y);
      context.lineTo(x, y - corner * yDirection);
      context.stroke();
    });
    context.restore();

    context.save();
    context.fillStyle = "rgba(242, 244, 241, 0.62)";
    context.font = "11px IBM Plex Mono, monospace";
    context.fillText("TRUST CORE / 03D", 14, 22);
    context.textAlign = "right";
    context.fillStyle = phosphor;
    context.fillText(`${Math.round(open * 100)}% SYNC`, this.width - 14, 22);
    context.restore();
  }
}

async function setupDataFlow() {
  const canvas = document.querySelector<HTMLCanvasElement>("#data-flow");
  if (!canvas) return;
  const connection = (
    navigator as Navigator & {
      connection?: { effectiveType?: string; saveData?: boolean };
      deviceMemory?: number;
    }
  ).connection;
  const constrainedConnection =
    connection?.saveData || connection?.effectiveType?.includes("2g");
  let fallbackScene: DataFlowScene;
  try {
    fallbackScene = new DataFlowScene(canvas);
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
    return;
  }

  const capableNavigator = navigator as Navigator & { deviceMemory?: number };
  const lowCapability =
    (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4) ||
    Boolean(capableNavigator.deviceMemory && capableNavigator.deviceMemory < 4);
  if (
    reducedMotionQuery.matches ||
    window.innerWidth <= 1180 ||
    constrainedConnection ||
    lowCapability
  ) {
    return;
  }

  const hero = canvas.closest<HTMLElement>(".hero");
  let upgraded = false;
  let armTimer = 0;
  let idleTimer = 0;

  const isHeroVisible = () => {
    const bounds = hero?.getBoundingClientRect();
    return Boolean(bounds && bounds.bottom > 0 && bounds.top < window.innerHeight);
  };

  const cleanupUpgradeTriggers = () => {
    window.removeEventListener("pointermove", queueUpgrade);
    window.removeEventListener("keydown", queueUpgrade);
    window.clearTimeout(armTimer);
    window.clearTimeout(idleTimer);
  };

  const upgrade = async () => {
    if (upgraded || !isHeroVisible()) return;
    upgraded = true;
    cleanupUpgradeTriggers();

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    await new Promise<void>((resolve) => {
      if (idleWindow.requestIdleCallback) {
        idleWindow.requestIdleCallback(resolve, { timeout: 1200 });
        return;
      }
      window.setTimeout(resolve, 240);
    });

    const upgradeCanvas = canvas.cloneNode(false) as HTMLCanvasElement;
    upgradeCanvas.id = "data-flow-3d";
    upgradeCanvas.className = "data-flow-3d";
    upgradeCanvas.setAttribute("aria-hidden", "true");
    canvas.after(upgradeCanvas);

    try {
      const { ThreeDataFlowScene } = await import("./three-flow");
      new ThreeDataFlowScene(upgradeCanvas);
      window.requestAnimationFrame(() => {
        upgradeCanvas.classList.add("is-ready");
        canvas.classList.add("is-fallback-hidden");
      });
      window.setTimeout(() => {
        fallbackScene.destroy();
        canvas.remove();
      }, 760);
    } catch (error) {
      upgraded = false;
      upgradeCanvas.remove();
      console.warn("3D data-flow scene unavailable; using the lightweight canvas.", error);
    }
  };

  function queueUpgrade() {
    void upgrade();
  }

  armTimer = window.setTimeout(() => {
    window.addEventListener("pointermove", queueUpgrade, { passive: true });
    window.addEventListener("keydown", queueUpgrade);
  }, 2500);
  idleTimer = window.setTimeout(queueUpgrade, 12000);
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
setupPrecisionCursor();
setupScrollMonitor();
setupExperienceSpotlight();
setupContactActions();
setupBackToTop();
setupTiltSurfaces();
setupCapabilitySpotlight();
setupDataFlow();
setupTrustBloom();
