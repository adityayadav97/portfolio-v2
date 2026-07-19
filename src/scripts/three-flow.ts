import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  FogExp2,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

const COLORS = {
  void: 0x080b0a,
  panel: 0x111715,
  panelRaised: 0x17201d,
  paper: 0xf2f4f1,
  cobalt: 0x5475d6,
  cyan: 0x5dd6d1,
  phosphor: 0xb8d879,
  magenta: 0xd66bbf,
};

type Packet = {
  mesh: Mesh<BoxGeometry, MeshBasicMaterial>;
  offset: number;
  speed: number;
};

type Route = {
  curve: CatmullRomCurve3;
  packets: Packet[];
  depthMaterial: MeshBasicMaterial;
  glowMaterial: MeshBasicMaterial;
  railMaterial: MeshBasicMaterial;
  phase: number;
};

type PipelineNode = {
  group: Group;
  bodyMaterial: MeshStandardMaterial;
  edgeMaterial: LineBasicMaterial;
  accentMaterial: MeshBasicMaterial;
  status: Mesh<BoxGeometry, MeshBasicMaterial>;
  basePosition: Vector3;
  phase: number;
  active: boolean;
};

type SignalSweep = {
  group: Group;
  curve: CatmullRomCurve3;
  coreMaterial: MeshBasicMaterial;
  haloMaterial: MeshBasicMaterial;
  light: PointLight;
};

type AnimatedLabel = {
  sprite: Sprite;
  material: SpriteMaterial;
  baseScale: Vector3;
  baseY: number;
  phase: number;
};

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
const wrapProgress = (value: number) => ((value % 1) + 1) % 1;

export class ThreeDataFlowScene {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(36, 1, 0.1, 100);
  private stage = new Group();
  private rings = new Group();
  private shards = new Group();
  private routes: Route[] = [];
  private nodes: PipelineNode[] = [];
  private animatedLabels: AnimatedLabel[] = [];
  private signalSweep?: SignalSweep;
  private particleField?: Points<BufferGeometry, PointsMaterial>;
  private trustLight = new PointLight(COLORS.phosphor, 13, 8, 2);
  private readonly railAxis = new Vector3(1, 0, 0);
  private frame = 0;
  private width = 1;
  private height = 1;
  private sceneInset = 0;
  private sceneWidth = 1;
  private visible = true;
  private pageVisible = !document.hidden;
  private reducedMotion = reducedMotionQuery.matches;
  private userPaused = false;
  private startTime = performance.now();
  private pausedElapsed = 0;
  private lastMetricUpdate = 0;
  private lastRenderedAt = 0;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private toggle = document.querySelector<HTMLButtonElement>("#flow-toggle");
  private label = document.querySelector<HTMLElement>("[data-flow-label]");
  private throughput = document.querySelector<HTMLElement>("[data-flow-throughput]");

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(COLORS.void, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.scene.fog = new FogExp2(COLORS.void, 0.035);
    this.scene.add(this.stage);
    this.buildScene();
    this.bind();
    this.resize();
    this.render(performance.now());
    this.updateLoop();
  }

  private buildScene() {
    this.scene.add(new AmbientLight(0xdce7e2, 1.25));

    const keyLight = new DirectionalLight(COLORS.cyan, 4.2);
    keyLight.position.set(3, 7, 9);
    this.scene.add(keyLight);

    const fillLight = new DirectionalLight(COLORS.magenta, 1.35);
    fillLight.position.set(-4, -2.5, 5);
    this.scene.add(fillLight);

    const flowLight = new PointLight(COLORS.cobalt, 4.5, 9, 2);
    flowLight.position.set(2.5, 0.8, 2.2);
    this.scene.add(flowLight);

    this.trustLight.position.set(8.8, 0.2, 1.7);
    this.scene.add(this.trustLight);

    const backGrid = new GridHelper(22, 22, COLORS.cyan, 0x263532);
    backGrid.rotation.x = Math.PI / 2;
    backGrid.position.set(3.7, 0, -1.45);
    this.tuneGrid(backGrid, 0.16);
    this.stage.add(backGrid);

    const floorGrid = new GridHelper(26, 26, COLORS.cobalt, 0x24302c);
    floorGrid.position.set(3.7, -3.1, 0.8);
    this.tuneGrid(floorGrid, 0.2);
    this.stage.add(floorGrid);

    const sourceTop = new Vector3(0, 1.8, 0.15);
    const sourceMid = new Vector3(0, 0, 0.3);
    const sourceBottom = new Vector3(0, -1.8, 0.15);
    const ingest = new Vector3(2, 0, 0.45);
    const transform = new Vector3(3.75, 0, 0.55);
    const quality = new Vector3(5.5, 0, 0.7);
    const warehouse = new Vector3(7.35, 0, 0.95);

    this.addNode(sourceTop, "SRC 01", "ORDERS", false, COLORS.cyan);
    this.addNode(sourceMid, "SOURCE", "3 FEEDS", false, COLORS.cyan);
    this.addNode(sourceBottom, "SRC 03", "EVENTS", false, COLORS.magenta);
    this.addNode(ingest, "INGEST", "10.4K / MIN", false, COLORS.cobalt);
    this.addNode(transform, "TRANSFORM", "SPARK JOBS", false, COLORS.cyan);
    this.addNode(quality, "QUALITY", "15 / 15 PASS", false, COLORS.magenta);
    this.addNode(warehouse, "WAREHOUSE", "SLA HEALTHY", true, COLORS.phosphor);

    this.addRoute(
      [sourceTop, new Vector3(0.95, 1.76, 0.2), ingest],
      COLORS.cyan,
      2,
    );
    this.addRoute([sourceMid, ingest], COLORS.cobalt, 2);
    this.addRoute(
      [sourceBottom, new Vector3(0.95, -1.76, 0.2), ingest],
      COLORS.magenta,
      2,
    );
    this.addRoute([ingest, transform, quality, warehouse], COLORS.phosphor, 6);

    this.buildTrustRings(warehouse);
    this.buildParticles();
    this.buildShards();
  }

  private tuneGrid(grid: GridHelper, opacity: number) {
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = false;
    });
  }

  private addNode(
    position: Vector3,
    title: string,
    meta: string,
    active: boolean,
    accent: number,
  ) {
    const group = new Group();
    group.position.copy(position);

    const bodyMaterial = new MeshStandardMaterial({
      color: active ? COLORS.phosphor : COLORS.panelRaised,
      emissive: active ? COLORS.phosphor : accent,
      emissiveIntensity: active ? 0.28 : 0.08,
      metalness: 0.28,
      roughness: 0.64,
    });
    const body = new Mesh(new BoxGeometry(1.88, 0.9, 0.5), bodyMaterial);
    group.add(body);

    const edges = new LineSegments(
      new EdgesGeometry(body.geometry),
      new LineBasicMaterial({
        color: active ? COLORS.phosphor : accent,
        transparent: true,
        opacity: active ? 0.95 : 0.72,
      }),
    );
    const edgeMaterial = edges.material as LineBasicMaterial;
    edges.scale.setScalar(1.01);
    group.add(edges);

    const depthFrame = new LineSegments(
      new EdgesGeometry(new BoxGeometry(1.96, 0.96, 0.52)),
      new LineBasicMaterial({
        color: accent,
        transparent: true,
        opacity: active ? 0.34 : 0.2,
      }),
    );
    depthFrame.position.set(0.08, -0.06, -0.14);
    group.add(depthFrame);

    const accentMaterial = new MeshBasicMaterial({
      color: active ? COLORS.void : accent,
      transparent: true,
      opacity: active ? 0.68 : 0.5,
    });
    const accentRail = new Mesh(new BoxGeometry(1.34, 0.018, 0.035), accentMaterial);
    accentRail.position.set(0.1, 0.36, 0.29);
    group.add(accentRail);

    const status = new Mesh(
      new BoxGeometry(0.1, 0.1, 0.08),
      new MeshBasicMaterial({ color: active ? COLORS.void : accent }),
    );
    status.position.set(-0.75, 0.29, 0.3);
    group.add(status);

    const label = this.makeLabel(title, meta, active);
    label.position.set(0.05, -0.02, 0.31);
    group.add(label);
    this.animatedLabels.push({
      sprite: label,
      material: label.material,
      baseScale: label.scale.clone(),
      baseY: label.position.y,
      phase: this.animatedLabels.length * 0.72,
    });

    if (active) {
      const halo = new LineSegments(
        new EdgesGeometry(new BoxGeometry(2.05, 1.08, 0.64)),
        new LineBasicMaterial({
          color: COLORS.phosphor,
          transparent: true,
          opacity: 0.28,
        }),
      );
      group.add(halo);
    }

    this.stage.add(group);
    this.nodes.push({
      group,
      bodyMaterial,
      edgeMaterial,
      accentMaterial,
      status,
      basePosition: position.clone(),
      phase: this.nodes.length * 0.82,
      active,
    });
  }

  private makeLabel(title: string, meta: string, active: boolean) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 768;
    labelCanvas.height = 240;
    const context = labelCanvas.getContext("2d");
    if (!context) throw new Error("Unable to create node label texture");

    context.clearRect(0, 0, labelCanvas.width, labelCanvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = active ? "#101513" : "#f2f4f1";
    context.shadowColor = active ? "rgba(16,21,19,.18)" : "rgba(93,214,209,.7)";
    context.shadowBlur = active ? 2 : 10;
    context.font = "700 78px IBM Plex Mono, monospace";
    context.fillText(title, 384, 78);
    context.shadowBlur = 0;
    context.fillStyle = active ? "rgba(16,21,19,.78)" : "rgba(220,231,226,.9)";
    context.font = "600 44px IBM Plex Mono, monospace";
    context.fillText(meta, 384, 166);

    const texture = new CanvasTexture(labelCanvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const sprite = new Sprite(
      new SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    sprite.scale.set(2.12, 1, 1);
    sprite.renderOrder = 20;
    return sprite;
  }

  private addRoute(points: Vector3[], color: number, packetCount: number) {
    const curve = new CatmullRomCurve3(points, false, "centripetal");
    const depthCurve = new CatmullRomCurve3(
      points.map((point) => point.clone().add(new Vector3(0.04, -0.035, -0.18))),
      false,
      "centripetal",
    );
    const depthMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const depthRail = new Mesh(
      new TubeGeometry(depthCurve, 48, 0.035, 6, false),
      depthMaterial,
    );
    this.stage.add(depthRail);

    const glowGeometry = new TubeGeometry(curve, 48, 0.072, 6, false);
    const glowMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    });
    const glow = new Mesh(
      glowGeometry,
      glowMaterial,
    );
    this.stage.add(glow);

    const railMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.74,
    });
    const rail = new Mesh(
      new TubeGeometry(curve, 48, 0.022, 6, false),
      railMaterial,
    );
    this.stage.add(rail);

    const packets: Packet[] = [];
    for (let index = 0; index < packetCount; index += 1) {
      const packet = new Mesh(
        new BoxGeometry(index % 3 === 0 ? 0.14 : 0.1, 0.1, 0.1),
        new MeshBasicMaterial({ color }),
      );
      packet.renderOrder = 12;
      packets.push({
        mesh: packet,
        offset: index / packetCount,
        speed: 0.075 + (index % 3) * 0.012,
      });
      this.stage.add(packet);
    }
    this.routes.push({
      curve,
      packets,
      depthMaterial,
      glowMaterial,
      railMaterial,
      phase: this.routes.length * 1.17,
    });

    if (packetCount >= 6) this.buildSignalSweep(curve, color);
  }

  private buildSignalSweep(curve: CatmullRomCurve3, color: number) {
    const group = new Group();
    const haloMaterial = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    const halo = new Mesh(new BoxGeometry(0.62, 0.16, 0.16), haloMaterial);
    group.add(halo);

    const coreMaterial = new MeshBasicMaterial({
      color: COLORS.paper,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const core = new Mesh(new BoxGeometry(0.34, 0.045, 0.045), coreMaterial);
    group.add(core);

    const light = new PointLight(color, 3.2, 2.8, 2);
    group.add(light);
    group.renderOrder = 14;
    this.stage.add(group);
    this.signalSweep = { group, curve, coreMaterial, haloMaterial, light };
  }

  private buildTrustRings(center: Vector3) {
    this.rings.position.copy(center);
    [1.05, 1.34, 1.64].forEach((radius, index) => {
      const ring = new Mesh(
        new TorusGeometry(radius, index === 1 ? 0.025 : 0.018, 8, 72),
        new MeshBasicMaterial({
          color: index === 1 ? COLORS.cyan : index === 2 ? COLORS.magenta : COLORS.phosphor,
          transparent: true,
          opacity: 0.34 - index * 0.06,
        }),
      );
      ring.rotation.set(index * 0.52, index * 0.66, index * 0.4);
      this.rings.add(ring);
    });
    this.stage.add(this.rings);
  }

  private buildParticles() {
    const positions: number[] = [];
    const count = 72;
    for (let index = 0; index < count; index += 1) {
      positions.push(
        -1.2 + ((index * 1.71) % 10.2),
        -3.5 + ((index * 2.37) % 7),
        -1.9 + ((index * 0.83) % 3.2),
      );
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const particles = new Points(
      geometry,
      new PointsMaterial({
        color: COLORS.cyan,
        size: 0.045,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    );
    particles.name = "data-particles";
    this.particleField = particles;
    this.stage.add(particles);
  }

  private buildShards() {
    const accents = [COLORS.cyan, COLORS.cobalt, COLORS.magenta, COLORS.phosphor];
    for (let index = 0; index < 10; index += 1) {
      const shard = new Mesh(
        new OctahedronGeometry(index % 3 === 0 ? 0.12 : 0.075),
        new MeshBasicMaterial({
          color: accents[index % accents.length],
          transparent: true,
          opacity: 0.48,
          wireframe: index % 2 === 0,
        }),
      );
      shard.position.set(
        -0.8 + ((index * 1.41) % 9.2),
        -2.8 + ((index * 1.83) % 5.6),
        -0.6 + ((index * 0.57) % 2),
      );
      this.shards.add(shard);
    }
    this.stage.add(this.shards);
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
      this.render(performance.now());
      this.updateLoop();
    });

    if (finePointerQuery.matches) {
      this.canvas.parentElement?.addEventListener("pointermove", (event) => {
        const bounds = this.canvas.getBoundingClientRect();
        this.pointer.targetX = (event.clientX - bounds.left) / bounds.width - 0.5;
        this.pointer.targetY = (event.clientY - bounds.top) / bounds.height - 0.5;
      });
      this.canvas.parentElement?.addEventListener("pointerleave", () => {
        this.pointer.targetX = 0;
        this.pointer.targetY = 0;
      });
    }

    this.toggle?.addEventListener("click", () => this.toggleMotion());
  }

  private toggleMotion() {
    const now = performance.now();
    this.userPaused = !this.userPaused;
    if (this.userPaused) {
      this.pausedElapsed = (now - this.startTime) / 1000;
      this.updateThroughput(this.pausedElapsed);
    } else {
      this.startTime = now - this.pausedElapsed * 1000;
    }
    this.lastMetricUpdate = now;
    const action = this.userPaused ? "Resume motion" : "Pause motion";
    this.toggle?.setAttribute("aria-pressed", String(this.userPaused));
    this.toggle?.setAttribute("title", action);
    this.toggle?.setAttribute("aria-label", action);
    if (this.label) this.label.textContent = action;
    document.body.classList.toggle("motion-paused", this.userPaused);
    window.dispatchEvent(
      new CustomEvent("motionstatechange", { detail: { paused: this.userPaused } }),
    );
    this.render(now);
    this.updateLoop();
  }

  private resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, bounds.width);
    this.height = Math.max(1, bounds.height);
    const compactDesktop = this.width < 1380;
    const insetRatio = compactDesktop ? 0.6 : 0.58;
    this.sceneInset = Math.round(this.width * insetRatio);
    this.sceneWidth = Math.max(1, this.width - this.sceneInset);
    this.canvas.dataset.sceneZone = "right";
    this.canvas.dataset.sceneStart = String(this.sceneInset);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setViewport(this.sceneInset, 0, this.sceneWidth, this.height);
    this.renderer.setScissor(this.sceneInset, 0, this.sceneWidth, this.height);
    this.renderer.setScissorTest(true);
    this.camera.aspect = this.sceneWidth / this.height;
    this.camera.position.set(3.75, 4.1, compactDesktop ? 19.5 : 18.5);
    this.camera.lookAt(3.72, -0.12, 0);
    this.camera.updateProjectionMatrix();
    this.stage.scale.setScalar(compactDesktop ? 0.84 : 0.9);
    this.stage.position.set(0, -0.28, 0);
    this.render(performance.now());
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
    const mobileFrameBudget = this.width <= 700 ? 1000 / 30 : 0;
    if (!mobileFrameBudget || time - this.lastRenderedAt >= mobileFrameBudget) {
      this.render(time);
      this.lastRenderedAt = time;
    }
    if (this.shouldAnimate()) {
      this.frame = window.requestAnimationFrame((nextTime) => this.tick(nextTime));
    }
  }

  private render(time: number) {
    const elapsed = this.reducedMotion
      ? 4.2
      : this.userPaused
        ? this.pausedElapsed
        : (time - this.startTime) / 1000;
    this.pointer.x += (this.pointer.targetX - this.pointer.x) * 0.055;
    this.pointer.y += (this.pointer.targetY - this.pointer.y) * 0.055;

    const hero = this.canvas.closest<HTMLElement>(".hero");
    const scrollProgress = Math.min(1, window.scrollY / Math.max(hero?.offsetHeight ?? 1, 1));
    this.stage.rotation.y = this.pointer.x * 0.095 + Math.sin(elapsed * 0.16) * 0.012;
    this.stage.rotation.x = this.pointer.y * -0.065;
    this.stage.position.z = scrollProgress * -1.1;
    this.rings.rotation.x = elapsed * 0.11;
    this.rings.rotation.y = elapsed * -0.08;
    this.shards.rotation.z = elapsed * 0.018;
    if (this.particleField) {
      this.particleField.position.x = this.reducedMotion ? 0 : Math.sin(elapsed * 0.18) * 0.08;
      this.particleField.position.y = this.reducedMotion ? 0 : Math.cos(elapsed * 0.15) * 0.045;
    }

    this.nodes.forEach(
      (
        {
          group,
          bodyMaterial,
          edgeMaterial,
          accentMaterial,
          status,
          basePosition,
          phase,
          active,
        },
      ) => {
        const lift = this.reducedMotion ? 0 : Math.sin(elapsed * 0.62 + phase);
        const depth = this.reducedMotion ? 0 : Math.cos(elapsed * 0.48 + phase) * 0.032;
        const activity = this.reducedMotion
          ? 0.64
          : 0.5 + Math.sin(elapsed * 1.08 + phase) * 0.5;
        group.position.set(
          basePosition.x,
          basePosition.y + lift * 0.026,
          basePosition.z + depth,
        );
        group.rotation.x = this.reducedMotion ? 0 : lift * 0.005;
        group.rotation.y = this.reducedMotion
          ? 0
          : Math.sin(elapsed * 0.44 + phase) * 0.012;
        bodyMaterial.emissiveIntensity = active
          ? 0.24 + activity * 0.14
          : 0.055 + activity * 0.055;
        edgeMaterial.opacity = active
          ? 0.82 + activity * 0.16
          : 0.58 + activity * 0.16;
        accentMaterial.opacity = active
          ? 0.58 + activity * 0.18
          : 0.36 + activity * 0.22;
        status.scale.setScalar(0.86 + activity * 0.26);
      },
    );

    this.animatedLabels.forEach(
      ({ sprite, material, baseScale, baseY, phase }, index) => {
        const revealProgress = this.reducedMotion
          ? 1
          : Math.min(1, Math.max(0, (elapsed - index * 0.11) / 0.72));
        const reveal = 1 - (1 - revealProgress) ** 3;
        const pulse = this.reducedMotion ? 1 : 1 + Math.sin(elapsed * 1.65 + phase) * 0.04;
        sprite.scale.set(
          baseScale.x * reveal * pulse,
          baseScale.y * reveal * (2 - pulse),
          1,
        );
        sprite.position.y =
          baseY + (this.reducedMotion ? 0 : Math.sin(elapsed * 1.25 + phase) * 0.035);
        material.opacity = this.reducedMotion
          ? 1
          : 0.9 + Math.sin(elapsed * 1.65 + phase) * 0.1;
      },
    );

    this.routes.forEach(
      ({ curve, packets, depthMaterial, glowMaterial, railMaterial, phase }) => {
        const activity = this.reducedMotion
          ? 0.64
          : 0.5 + Math.sin(elapsed * 1.12 - phase) * 0.5;
        depthMaterial.opacity = 0.12 + activity * 0.1;
        glowMaterial.opacity = 0.045 + activity * 0.07;
        railMaterial.opacity = 0.64 + activity * 0.2;
        packets.forEach(({ mesh, offset, speed }, packetIndex) => {
          const progress = wrapProgress(elapsed * speed + offset);
          const point = curve.getPointAt(progress);
          mesh.position.copy(point);
          const tangent = curve.getTangentAt(Math.min(progress + 0.002, 1));
          mesh.rotation.z = Math.atan2(tangent.y, tangent.x);
          mesh.scale.setScalar(0.88 + Math.sin(elapsed * 2 + packetIndex) * 0.12);
        });
      },
    );

    if (this.signalSweep) {
      const { group, curve, coreMaterial, haloMaterial, light } = this.signalSweep;
      const progress = this.reducedMotion ? 0.72 : wrapProgress(elapsed * 0.105);
      const point = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(Math.min(progress + 0.002, 1)).normalize();
      const pulse = this.reducedMotion ? 0.72 : 0.5 + Math.sin(elapsed * 3.2) * 0.5;
      const arrival = Math.max(0, 1 - Math.abs(progress - 0.965) / 0.075);
      group.position.copy(point);
      group.quaternion.setFromUnitVectors(this.railAxis, tangent);
      group.scale.set(0.92 + pulse * 0.14, 0.84 + pulse * 0.22, 0.84 + pulse * 0.22);
      coreMaterial.opacity = 0.8 + pulse * 0.2;
      haloMaterial.opacity = 0.055 + pulse * 0.11;
      light.intensity = 2.2 + pulse * 2.2;
      this.trustLight.intensity = 12.5 + arrival * 6.5;
      this.rings.scale.setScalar(
        this.reducedMotion ? 1 : 1 + Math.sin(elapsed * 0.9) * 0.012 + arrival * 0.065,
      );
    }

    if (this.throughput && time - this.lastMetricUpdate > 220) {
      this.updateThroughput(elapsed);
      this.lastMetricUpdate = time;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
