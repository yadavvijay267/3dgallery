// The 3D gallery room: walls, oak floor, brass frames, spotlights.
//
// Built with three.js primitives only — boxes for frames and benches,
// lathe-free turned parts are not needed here; the room is architecture.
// Photos arrive as textures loaded from the artifact's own blob URLs and
// are hung on fixed wall slots in upload order. Empty slots show a plain
// "upload" placeholder frame so the room never looks broken.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface GalleryPhoto {
  id: number;
  caption: string;
  url: string;
  aspect: number;
}

interface SlotDef {
  pos: [number, number, number];
  rotY: number;
}

interface FrameRecord {
  slot: number;
  group: THREE.Group;
  caption: string;
  photoMat: THREE.MeshStandardMaterial;
  plate: THREE.Mesh | null;
  plateTex: THREE.CanvasTexture | null;
}

const ROOM_W = 16;
const ROOM_D = 12;
const ROOM_H = 4.6;
const EYE = 1.6;
const FRAME_Y = 1.78;

function buildSlots(): SlotDef[] {
  const slots: SlotDef[] = [];
  // North wall (z = -D/2), facing +z.
  for (const x of [-6, -3, 0, 3, 6]) {
    slots.push({ pos: [x, FRAME_Y, -ROOM_D / 2 + 0.09], rotY: 0 });
  }
  // South wall (z = +D/2), facing -z.
  for (const x of [6, 3, 0, -3, -6]) {
    slots.push({ pos: [x, FRAME_Y, ROOM_D / 2 - 0.09], rotY: Math.PI });
  }
  // West wall (x = -W/2), facing +x.
  for (const z of [3.4, 0, -3.4]) {
    slots.push({ pos: [-ROOM_W / 2 + 0.09, FRAME_Y, z], rotY: Math.PI / 2 });
  }
  // East wall (x = +W/2), facing -x.
  for (const z of [-3.4, 0, 3.4]) {
    slots.push({ pos: [ROOM_W / 2 - 0.09, FRAME_Y, z], rotY: -Math.PI / 2 });
  }
  return slots;
}

export const SLOT_COUNT = buildSlots().length;

function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#6e4a2c";
    g.fillRect(0, 0, 512, 512);
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      const y = (r * 512) / rows;
      const shade = 0.9 + ((r * 37) % 10) / 50;
      g.fillStyle = `rgb(${Math.round(110 * shade)},${Math.round(74 * shade)},${Math.round(44 * shade)})`;
      g.fillRect(0, y, 512, 512 / rows - 2);
      // plank seams and grain streaks
      g.fillStyle = "rgba(30,18,8,0.55)";
      g.fillRect(0, y + 512 / rows - 2, 512, 2);
      const joint = ((r * 197) % 512) + 60;
      g.fillRect(joint % 512, y, 2, 512 / rows - 2);
      g.strokeStyle = "rgba(46,28,12,0.25)";
      for (let i = 0; i < 7; i++) {
        const gy = y + 6 + ((r * 53 + i * 29) % 70);
        g.beginPath();
        g.moveTo(0, gy);
        g.bezierCurveTo(150, gy + 3, 340, gy - 3, 512, gy + 2);
        g.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 3);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function rugTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#43302a";
    g.fillRect(0, 0, 512, 384);
    g.strokeStyle = "#c9a35c";
    g.lineWidth = 6;
    g.strokeRect(18, 18, 476, 348);
    g.lineWidth = 2;
    g.strokeRect(36, 36, 440, 312);
    g.fillStyle = "rgba(201,163,92,0.5)";
    for (let x = 64; x < 480; x += 52) {
      for (let y = 64; y < 340; y += 52) {
        g.save();
        g.translate(x, y);
        g.rotate(Math.PI / 4);
        g.fillRect(-7, -7, 14, 14);
        g.restore();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function placeholderTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#2a332e";
    g.fillRect(0, 0, 512, 384);
    g.strokeStyle = "rgba(201,163,92,0.75)";
    g.lineWidth = 3;
    g.setLineDash([14, 10]);
    g.strokeRect(26, 26, 460, 332);
    g.setLineDash([]);
    g.fillStyle = "#cbbfa5";
    g.font = "600 44px Georgia, serif";
    g.textAlign = "center";
    g.fillText("+", 256, 178);
    g.font = "24px Georgia, serif";
    g.fillText("Photo upload karo", 256, 226);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function captionTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 72;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#ece5d8";
    g.fillRect(0, 0, 512, 72);
    g.fillStyle = "#2c2c28";
    g.font = "italic 27px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const shown = text.length > 44 ? `${text.slice(0, 43)}…` : text;
    g.fillText(shown, 256, 38);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function dotSprite(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,230,180,0.9)");
    grad.addColorStop(1, "rgba(255,230,180,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

const BRASS = new THREE.MeshStandardMaterial({
  color: 0x9a7a38,
  metalness: 0.85,
  roughness: 0.34,
});
const MAT_BOARD = new THREE.MeshStandardMaterial({
  color: 0xe9e2d2,
  roughness: 0.92,
  metalness: 0,
});
const DARK_WOOD = new THREE.MeshStandardMaterial({
  color: 0x3a2a1a,
  roughness: 0.72,
  metalness: 0,
});

function photoSize(aspect: number): { w: number; h: number } {
  const maxW = 1.95;
  const maxH = 1.5;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  return { w, h };
}

function buildFrame(photo: GalleryPhoto | null): {
  group: THREE.Group;
  photoMat: THREE.MeshStandardMaterial;
} {
  const { w, h } = photo
    ? photoSize(photo.aspect)
    : { w: 1.7, h: 1.275 };
  const group = new THREE.Group();
  const border = 0.09;
  const depth = 0.07;

  const matBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.22, h + 0.22),
    MAT_BOARD,
  );
  matBoard.position.z = 0.012;
  group.add(matBoard);

  const photoMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0,
  });
  const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), photoMat);
  photoMesh.position.z = 0.03;
  group.add(photoMesh);

  const horiz = new THREE.BoxGeometry(w + border * 2, border, depth);
  const vert = new THREE.BoxGeometry(border, h, depth);
  const top = new THREE.Mesh(horiz, BRASS);
  top.position.set(0, h / 2 + border / 2, depth / 2);
  const bottom = new THREE.Mesh(horiz, BRASS);
  bottom.position.set(0, -h / 2 - border / 2, depth / 2);
  const left = new THREE.Mesh(vert, BRASS);
  left.position.set(-w / 2 - border / 2, 0, depth / 2);
  const right = new THREE.Mesh(vert, BRASS);
  right.position.set(w / 2 + border / 2, 0, depth / 2);
  group.add(top, bottom, left, right);

  return { group, photoMat };
}

export interface GallerySceneCallbacks {
  onSelect: (id: number | null) => void;
  onUserGesture: () => void;
  onError?: (message: string) => void;
}

export class GalleryScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private slots = buildSlots();
  private frames = new Map<number, FrameRecord>();
  private placeholders = new Map<number, THREE.Group>();
  private placeholderTex: THREE.CanvasTexture;
  private raycaster = new THREE.Raycaster();
  private desiredPos = new THREE.Vector3(0, 2.4, 6.4);
  private desiredTarget = new THREE.Vector3(0, 1.35, 0);
  private overviewAngle = Math.PI * 0.25;
  private focusSlot: number | null = null;
  private mode: "overview" | "focus" | "free" = "overview";
  private auto = true;
  private userHold = false;
  private downPos: { x: number; y: number } | null = null;
  private clock = new THREE.Clock();
  private dust: THREE.Points | null = null;
  private dustBase: Float32Array | null = null;
  private raf = 0;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private container: HTMLElement;
  private callbacks: GallerySceneCallbacks;

  constructor(
    container: HTMLElement,
    callbacks: GallerySceneCallbacks,
    opts: { reducedMotion: boolean },
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.auto = !opts.reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
    this.camera.position.copy(this.desiredPos);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.background = new THREE.Color(0x0d100e);
    this.scene.fog = new THREE.Fog(0x0d100e, 14, 30);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.desiredTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 8.6;
    this.controls.minDistance = 0.6;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minPolarAngle = Math.PI * 0.18;
    this.controls.enablePan = true;
    this.controls.update();

    this.placeholderTex = placeholderTexture();
    this.buildRoom();
    this.buildLights();

    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", this.handlePointerDown);
    el.addEventListener("pointerup", this.handlePointerUp);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.tick();
  }

  // ---- room construction -------------------------------------------------

  private buildRoom() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x27312b,
      roughness: 0.96,
      metalness: 0,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x171d19,
      roughness: 0.85,
      metalness: 0,
    });

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      new THREE.MeshStandardMaterial({
        map: woodTexture(),
        roughness: 0.62,
        metalness: 0.05,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 5.4),
      new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.012;
    rug.receiveShadow = true;
    this.scene.add(rug);

    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM_W, ROOM_D),
      new THREE.MeshStandardMaterial({ color: 0x1a201c, roughness: 1 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = ROOM_H;
    this.scene.add(ceil);

    const mkWall = (
      w: number,
      pos: [number, number, number],
      rotY: number,
    ) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM_H), wallMat);
      wall.position.set(pos[0], ROOM_H / 2, pos[2]);
      wall.rotation.y = rotY;
      wall.receiveShadow = true;
      this.scene.add(wall);
    };
    mkWall(ROOM_W, [0, 0, -ROOM_D / 2], 0);
    mkWall(ROOM_W, [0, 0, ROOM_D / 2], Math.PI);
    mkWall(ROOM_D, [-ROOM_W / 2, 0, 0], Math.PI / 2);
    mkWall(ROOM_D, [ROOM_W / 2, 0, 0], -Math.PI / 2);

    // Skirting + crown trim on every wall.
    const trimGeos: Array<{
      len: number;
      pos: [number, number, number];
      rotY: number;
    }> = [
      { len: ROOM_W, pos: [0, 0, -ROOM_D / 2 + 0.03], rotY: 0 },
      { len: ROOM_W, pos: [0, 0, ROOM_D / 2 - 0.03], rotY: 0 },
      { len: ROOM_D, pos: [-ROOM_W / 2 + 0.03, 0, 0], rotY: Math.PI / 2 },
      { len: ROOM_D, pos: [ROOM_W / 2 - 0.03, 0, 0], rotY: Math.PI / 2 },
    ];
    for (const t of trimGeos) {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(t.len, 0.22, 0.05),
        trimMat,
      );
      skirt.position.set(t.pos[0], 0.11, t.pos[2]);
      skirt.rotation.y = t.rotY;
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(t.len, 0.18, 0.05),
        trimMat,
      );
      crown.position.set(t.pos[0], ROOM_H - 0.09, t.pos[2]);
      crown.rotation.y = t.rotY;
      this.scene.add(skirt, crown);
    }

    // Ceiling beams.
    for (const x of [-4, 0, 4]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.24, ROOM_D),
        DARK_WOOD,
      );
      beam.position.set(x, ROOM_H - 0.12, 0);
      this.scene.add(beam);
    }

    // Two benches in the middle of the hall.
    for (const bx of [-2.2, 2.2]) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.12, 0.62),
        DARK_WOOD,
      );
      seat.position.y = 0.46;
      seat.castShadow = true;
      bench.add(seat);
      for (const lx of [-1.0, 1.0]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.46, 0.5),
          BRASS,
        );
        leg.position.set(lx, 0.23, 0);
        bench.add(leg);
      }
      bench.position.set(bx, 0, 0);
      this.scene.add(bench);
    }

    // Corner plants.
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e4a2c,
      roughness: 0.9,
    });
    const potMat = new THREE.MeshStandardMaterial({
      color: 0x54402a,
      roughness: 0.8,
    });
    for (const [px, pz] of [
      [-ROOM_W / 2 + 0.85, -ROOM_D / 2 + 0.85],
      [ROOM_W / 2 - 0.85, ROOM_D / 2 - 0.85],
    ] as Array<[number, number]>) {
      const plant = new THREE.Group();
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.22, 0.5, 20),
        potMat,
      );
      pot.position.y = 0.25;
      pot.castShadow = true;
      plant.add(pot);
      const blobs: Array<[number, number, number, number]> = [
        [0, 1.05, 0, 0.42],
        [0.26, 0.85, 0.1, 0.3],
        [-0.24, 0.9, -0.08, 0.28],
        [0.05, 1.3, -0.14, 0.26],
      ];
      for (const [lx, ly, lz, r] of blobs) {
        const leaf = new THREE.Mesh(
          new THREE.IcosahedronGeometry(r, 1),
          leafMat,
        );
        leaf.position.set(lx, ly, lz);
        plant.add(leaf);
      }
      plant.position.set(px, 0, pz);
      this.scene.add(plant);
    }

    // Drifting dust motes in the light.
    const count = 130;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (ROOM_W - 2);
      positions[i * 3 + 1] = 0.4 + Math.random() * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (ROOM_D - 2);
    }
    this.dustBase = positions.slice();
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    const dustMat = new THREE.PointsMaterial({
      map: dotSprite(),
      size: 0.055,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffe2ae,
    });
    this.dust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dust);
  }

  private buildLights() {
    this.scene.add(new THREE.AmbientLight(0xffe8c4, 0.32));
    const hemi = new THREE.HemisphereLight(0xd8e2d0, 0x1c1710, 0.35);
    this.scene.add(hemi);

    // Central warm spot with shadows.
    const key = new THREE.SpotLight(0xffd9a0, 160, 22, Math.PI / 3.4, 0.55, 1.6);
    key.position.set(0, ROOM_H - 0.15, 0);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.scene.add(key, key.target);

    // Ceiling spots washing the two long walls.
    for (const [x, z, tx, tz] of [
      [-3, -3.4, -3, -ROOM_D / 2],
      [3, -3.4, 3, -ROOM_D / 2],
      [-3, 3.4, -3, ROOM_D / 2],
      [3, 3.4, 3, ROOM_D / 2],
    ] as Array<[number, number, number, number]>) {
      const spot = new THREE.SpotLight(0xffdca6, 55, 13, Math.PI / 4.6, 0.7, 1.5);
      spot.position.set(x, ROOM_H - 0.1, z);
      spot.target.position.set(tx, 1.6, tz);
      this.scene.add(spot, spot.target);
    }

    // Visible ceiling light panels (emissive) above the hall.
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: 0xffd9a0,
      emissiveIntensity: 1.6,
      roughness: 0.4,
    });
    for (const x of [-4, 0, 4]) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 0.55),
        panelMat,
      );
      panel.rotation.x = Math.PI / 2;
      panel.position.set(x, ROOM_H - 0.245, 0);
      this.scene.add(panel);
    }

    // Translucent light cones above each frame + a small brass fixture.
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffd9a0,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    for (const slot of this.slots) {
      const [sx, , sz] = slot.pos;
      const nx = Math.sin(slot.rotY);
      const nz = Math.cos(slot.rotY);
      const coneH = ROOM_H - 2.85;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, coneH, 24, 1, true),
        coneMat,
      );
      cone.position.set(
        sx - nx * 0.55,
        ROOM_H - coneH / 2 - 0.05,
        sz - nz * 0.55,
      );
      cone.renderOrder = 5;
      this.scene.add(cone);
      const fixture = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.06, 0.16, 12),
        BRASS,
      );
      fixture.position.set(sx - nx * 0.55, ROOM_H - 0.1, sz - nz * 0.55);
      this.scene.add(fixture);
    }
  }

  // ---- photos ------------------------------------------------------------

  setPhotos(photos: GalleryPhoto[]) {
    // Remove frames for photos that are gone or moved to another slot.
    for (const [id, rec] of Array.from(this.frames.entries())) {
      const idx = photos.findIndex((p) => p.id === id);
      if (idx === -1 || idx !== rec.slot) {
        this.removeFrame(id);
      }
    }
    photos.forEach((photo, i) => {
      const existing = this.frames.get(photo.id);
      if (!existing) {
        this.addFrame(photo, i);
      } else if (existing.caption !== photo.caption) {
        this.updatePlate(existing, photo);
      }
    });
    this.refreshPlaceholders(photos.length);
  }

  private addFrame(photo: GalleryPhoto, slotIdx: number) {
    const slot = this.slots[slotIdx];
    if (!slot) return;
    const { group, photoMat } = buildFrame(photo);
    group.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
    group.rotation.y = slot.rotY;
    group.traverse((obj) => {
      obj.userData.photoId = photo.id;
    });
    this.scene.add(group);

    const rec: FrameRecord = {
      slot: slotIdx,
      group,
      caption: photo.caption,
      photoMat,
      plate: null,
      plateTex: null,
    };
    this.frames.set(photo.id, rec);
    this.updatePlate(rec, photo);

    // Load the photo texture through the blob bytes. Two quirks drive
    // this shape: (1) the blob endpoint sends no CORS headers, so a
    // CORS-mode load (THREE.TextureLoader sets crossOrigin="anonymous")
    // fails and a plain cross-origin <img> would taint the texture —
    // fetching the bytes same-origin avoids both; (2) in some browsers
    // drawImage of a just-loaded <img> rasterizes only part of the
    // image, leaving the rest transparent — createImageBitmap resolves
    // only after a full decode, so drawing the bitmap is complete.
    const report = (what: string) => {
      this.callbacks.onError?.(`Photo texture load fail: ${what}`);
    };
    const drawToTexture = (
      src: CanvasImageSource,
      w: number,
      h: number,
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);
      const g = canvas.getContext("2d");
      if (!g) {
        report("2d context unavailable");
        return;
      }
      g.drawImage(src, 0, 0, canvas.width, canvas.height);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      photoMat.map = tex;
      photoMat.needsUpdate = true;
    };
    const applyTexture = (src: string, isFallback: boolean) => {
      const img = new Image();
      img.onload = () => {
        drawToTexture(img, img.naturalWidth || 4, img.naturalHeight || 3);
      };
      img.onerror = () => {
        if (!isFallback) {
          applyTexture(photo.url, true);
        } else {
          report(`image decode fail for ${photo.url}`);
        }
      };
      img.src = src;
    };
    fetch(photo.url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(async (blob) => {
        if (!blob.type.startsWith("image/")) {
          throw new Error(`unexpected type ${blob.type || "?"}`);
        }
        if (typeof createImageBitmap === "function") {
          const bmp = await createImageBitmap(blob);
          drawToTexture(bmp, bmp.width, bmp.height);
          bmp.close();
        } else {
          applyTexture(URL.createObjectURL(blob), false);
        }
      })
      .catch(() => {
        // Bitmap path unavailable or undecodable: fall back silently
        // to a plain image load; only a failure there is reported.
        applyTexture(photo.url, true);
      });
  }

  private updatePlate(rec: FrameRecord, photo: GalleryPhoto) {
    rec.caption = photo.caption;
    if (rec.plate) {
      rec.group.remove(rec.plate);
      rec.plate = null;
    }
    if (rec.plateTex) {
      rec.plateTex.dispose();
      rec.plateTex = null;
    }
    if (!photo.caption.trim()) return;
    const { h } = photoSize(photo.aspect);
    const tex = captionTexture(photo.caption);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.16),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    );
    plate.position.set(0, -h / 2 - 0.32, 0.02);
    plate.userData.photoId = photo.id;
    rec.group.add(plate);
    rec.plate = plate;
    rec.plateTex = tex;
  }

  private removeFrame(id: number) {
    const rec = this.frames.get(id);
    if (!rec) return;
    this.scene.remove(rec.group);
    if (rec.photoMat.map) rec.photoMat.map.dispose();
    rec.photoMat.dispose();
    if (rec.plateTex) rec.plateTex.dispose();
    rec.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    this.frames.delete(id);
  }

  private refreshPlaceholders(photoCount: number) {
    for (const [slotIdx, group] of Array.from(this.placeholders.entries())) {
      if (slotIdx < photoCount) {
        this.scene.remove(group);
        this.placeholders.delete(slotIdx);
      }
    }
    for (let i = photoCount; i < this.slots.length; i++) {
      if (this.placeholders.has(i)) continue;
      const slot = this.slots[i];
      if (!slot) continue;
      const { group, photoMat } = buildFrame(null);
      photoMat.map = this.placeholderTex;
      photoMat.needsUpdate = true;
      group.position.set(slot.pos[0], slot.pos[1], slot.pos[2]);
      group.rotation.y = slot.rotY;
      this.scene.add(group);
      this.placeholders.set(i, group);
    }
  }

  // ---- camera modes ------------------------------------------------------

  focusIndex(i: number | null) {
    if (i === null) {
      this.focusSlot = null;
      this.mode = "overview";
      return;
    }
    this.focusSlot = i;
    this.mode = "focus";
  }

  setAutoRotate(on: boolean) {
    this.auto = on;
  }

  private handlePointerDown = (e: PointerEvent) => {
    this.userHold = true;
    this.downPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.userHold = false;
    const down = this.downPos;
    this.downPos = null;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 8) {
      if (this.mode !== "free") {
        this.mode = "free";
        this.focusSlot = null;
        this.callbacks.onUserGesture();
      }
      return;
    }
    // Tap: raycast for a frame.
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(
      Array.from(this.frames.values()).map((r) => r.group),
      true,
    );
    const first = hits[0];
    if (first) {
      let obj: THREE.Object3D | null = first.object;
      while (obj && typeof obj.userData.photoId !== "number") {
        obj = obj.parent;
      }
      if (obj && typeof obj.userData.photoId === "number") {
        this.callbacks.onSelect(obj.userData.photoId);
      }
    }
  };

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    try {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const t = this.clock.elapsedTime;

      if (this.mode === "focus" && this.focusSlot !== null) {
        const slot = this.slots[this.focusSlot];
        if (slot) {
          const nx = Math.sin(slot.rotY);
          const nz = Math.cos(slot.rotY);
          // Step back far enough that the whole frame fits, even on a
          // narrow portrait phone screen.
          const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
          const aspect = this.camera.aspect > 0 ? this.camera.aspect : 1;
          const dist = Math.min(
            6.4,
            Math.max(2.6, 1.32 / (tanV * aspect), 1.22 / tanV),
          );
          this.desiredPos.set(
            slot.pos[0] + nx * dist,
            EYE + 0.08,
            slot.pos[2] + nz * dist,
          );
          this.desiredTarget.set(slot.pos[0], slot.pos[1], slot.pos[2]);
        }
      } else if (this.mode === "overview") {
        if (this.auto) this.overviewAngle += dt * 0.055;
        const r = 7.4;
        this.desiredPos.set(
          Math.sin(this.overviewAngle) * r,
          2.5,
          Math.cos(this.overviewAngle) * r,
        );
        this.desiredTarget.set(0, 1.3, 0);
      }

      if (!this.userHold && this.mode !== "free") {
        const k = 1 - Math.exp(-3.0 * dt);
        this.camera.position.lerp(this.desiredPos, k);
        this.controls.target.lerp(this.desiredTarget, k);
      }

      if (this.dust && this.dustBase) {
        const attr = this.dust.geometry.getAttribute("position");
        const arr = attr.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
          const bx = this.dustBase[i] ?? 0;
          const by = this.dustBase[i + 1] ?? 0;
          const bz = this.dustBase[i + 2] ?? 0;
          arr[i] = bx + Math.sin(t * 0.12 + i) * 0.25;
          arr[i + 1] = by + Math.sin(t * 0.09 + i * 1.7) * 0.18;
          arr[i + 2] = bz + Math.cos(t * 0.1 + i * 0.6) * 0.25;
        }
        attr.needsUpdate = true;
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    } catch {
      // The next frame is already scheduled above; a single bad frame
      // must not blank the gallery.
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.handlePointerDown);
    el.removeEventListener("pointerup", this.handlePointerUp);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
      }
    });
    this.renderer.dispose();
    el.remove();
  }
}
