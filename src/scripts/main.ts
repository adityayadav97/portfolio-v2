const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

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

  const close = (restoreFocus = false) => {
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open navigation");
    button.setAttribute("title", "Open navigation");
    navigation.hidden = true;
    document.body.classList.remove("menu-open");
    if (restoreFocus) button.focus();
  };

  const open = () => {
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-label", "Close navigation");
    button.setAttribute("title", "Close navigation");
    navigation.hidden = false;
    document.body.classList.add("menu-open");
    navigation.querySelector<HTMLAnchorElement>("a")?.focus();
  };

  button.addEventListener("click", () => {
    if (button.getAttribute("aria-expanded") === "true") close();
    else open();
  });

  navigation.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      close(true);
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
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".desktop-nav a"));
  const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
  if (!links.length || !sections.length || !("IntersectionObserver" in window)) return;

  const linkBySection = new Map(
    links.map((link) => [link.getAttribute("href")?.slice(1), link] as const),
  );

  const activate = (sectionName: string) => {
    links.forEach((link) => link.classList.remove("is-active"));
    linkBySection.get(sectionName)?.classList.add("is-active");
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
      this.userPaused = !this.userPaused;
      this.toggle?.setAttribute("aria-pressed", String(this.userPaused));
      this.toggle?.setAttribute("title", this.userPaused ? "Resume data flow" : "Pause data flow");
      if (this.label) this.label.textContent = this.userPaused ? "Run flow" : "Pause flow";
      if (!this.userPaused) this.startTime = performance.now();
      this.draw(performance.now());
      this.updateLoop();
    });
  }

  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw(performance.now());
  }

  private shouldAnimate() {
    return this.visible && this.pageVisible && !this.userPaused && !this.reducedMotion;
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
      const value = 10.4 + Math.sin((time - this.startTime) / 950) * 0.6;
      this.throughput.textContent = `${value.toFixed(1)}k/min`;
      this.lastMetricUpdate = time;
    }

    if (this.shouldAnimate()) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private getRoutes(): Point[][] {
    const compact = this.width < 700;
    const shiftX = this.pointer.x;
    const shiftY = this.pointer.y;

    if (compact) {
      const y = this.height * 0.78 + shiftY;
      const points = [0.08, 0.28, 0.49, 0.7, 0.91].map((ratio, index) => ({
        x: this.width * ratio + shiftX * (index / 5),
        y,
      }));
      return [points];
    }

    const sourceX = this.width * 0.54;
    const centerY = this.height * 0.5 + shiftY;
    const shared = [
      { x: this.width * 0.67 + shiftX * 0.3, y: centerY },
      { x: this.width * 0.77 + shiftX * 0.55, y: centerY },
      { x: this.width * 0.86 + shiftX * 0.75, y: centerY },
      { x: this.width * 0.95 + shiftX, y: centerY },
    ];
    return [0.29, 0.5, 0.71].map((ratio) => [
      { x: sourceX, y: this.height * ratio + shiftY * 0.25 },
      ...shared,
    ]);
  }

  private pointOnRoute(route: Point[], progress: number): Point {
    const lengths = route.slice(1).map((point, index) => {
      const previous = route[index];
      return Math.hypot(point.x - previous.x, point.y - previous.y);
    });
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let remaining = progress * total;

    for (let index = 0; index < lengths.length; index += 1) {
      if (remaining <= lengths[index]) {
        const start = route[index];
        const end = route[index + 1];
        const ratio = remaining / lengths[index];
        return {
          x: start.x + (end.x - start.x) * ratio,
          y: start.y + (end.y - start.y) * ratio,
        };
      }
      remaining -= lengths[index];
    }

    return route[route.length - 1];
  }

  private drawGrid() {
    const context = this.context;
    context.save();
    context.strokeStyle = "rgba(243, 241, 232, 0.055)";
    context.lineWidth = 1;
    const step = this.width < 700 ? 32 : 48;

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

  private drawNode(point: Point, label: string, active = false) {
    const context = this.context;
    const compact = this.width < 700;
    const nodeWidth = compact ? 42 : 74;
    const nodeHeight = compact ? 24 : 34;
    context.save();
    context.fillStyle = active ? "#c8ff3d" : "#111514";
    context.strokeStyle = active ? "#c8ff3d" : "rgba(243, 241, 232, 0.34)";
    context.lineWidth = 1;
    context.fillRect(point.x - nodeWidth / 2, point.y - nodeHeight / 2, nodeWidth, nodeHeight);
    context.strokeRect(point.x - nodeWidth / 2, point.y - nodeHeight / 2, nodeWidth, nodeHeight);
    context.fillStyle = active ? "#111413" : "#d8d7d0";
    context.font = `${compact ? 7 : 9}px IBM Plex Mono, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, point.x, point.y + 0.5);
    context.restore();
  }

  private draw(time: number) {
    if (!this.width || !this.height) return;
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.drawGrid();

    const routes = this.getRoutes();
    const compact = this.width < 700;
    const labels = compact
      ? ["RAW", "INGEST", "MODEL", "CHECK", "SERVE"]
      : ["SOURCE", "INGEST", "TRANSFORM", "QUALITY", "WAREHOUSE"];

    context.save();
    context.strokeStyle = "rgba(243, 241, 232, 0.24)";
    context.lineWidth = 1;
    routes.forEach((route) => {
      context.beginPath();
      context.moveTo(route[0].x, route[0].y);
      route.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
    context.restore();

    const primaryRoute = routes[Math.floor(routes.length / 2)];
    primaryRoute.forEach((point, index) => this.drawNode(point, labels[index], index === labels.length - 1));

    if (routes.length > 1) {
      routes.forEach((route, index) => {
        if (index !== Math.floor(routes.length / 2)) this.drawNode(route[0], `SRC 0${index + 1}`);
      });
    }

    const elapsed = this.reducedMotion || this.userPaused ? 0.62 : (time - this.startTime) / 1000;
    const colors = ["#ff5a36", "#c8ff3d", "#315cff", "#f3f1e8"];
    const packetCount = compact ? 6 : 16;

    for (let index = 0; index < packetCount; index += 1) {
      const route = routes[index % routes.length];
      const progress = (elapsed * (0.13 + (index % 4) * 0.012) + index / packetCount) % 1;
      const point = this.pointOnRoute(route, progress);
      context.fillStyle = colors[index % colors.length];
      const size = index % 5 === 0 ? 6 : 4;
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }

    if (!compact) {
      context.save();
      context.fillStyle = "rgba(243, 241, 232, 0.46)";
      context.font = "9px IBM Plex Mono, monospace";
      context.textAlign = "right";
      context.fillText("LIVE DATA PLANE / HEALTHY", this.width - 56, this.height - 76);
      context.fillStyle = "#c8ff3d";
      context.fillRect(this.width - 48, this.height - 82, 8, 8);
      context.restore();
    }
  }
}

function setupDataFlow() {
  const canvas = document.querySelector<HTMLCanvasElement>("#data-flow");
  if (!canvas) return;
  try {
    new DataFlowScene(canvas);
  } catch {
    document.querySelector<HTMLButtonElement>("#flow-toggle")?.remove();
  }
}

setupHeader();
setupMenu();
setupRevealMotion();
setupActiveNavigation();
setupDataFlow();
