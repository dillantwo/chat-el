import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type Cube = { x: number; y: number; z: number; color: string };
export type Mode = "build" | "inspect";
export type Tool = "place" | "erase" | "paint" | "rotateView";
export type ContainerSize = { w: number; h: number; d: number };

export const PALETTE = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#06b6d4",
  "#f97316", "#0ea5e9",
  "#ec4899", "#84cc16", "#dc2626", "#14b8a6", "#fb923c", "#facc15",
  "#475569", "#94a3b8",
];

const keyOf = (x: number, y: number, z: number) => `${x},${y},${z}`;

export function isWithinContainerBounds(
  x: number,
  y: number,
  z: number,
  size: ContainerSize
) {
  return x >= 0 && x < size.w && y >= 0 && y < size.h && z >= 0 && z < size.d;
}

// Use a plain object as a dictionary instead of Map<>. Immer works on plain
// objects out of the box; supporting Map/Set would require `enableMapSet()`.
export type CubeDict = Record<string, Cube>;

interface CubeState {
  mode: Mode;
  tool: Tool;
  color: string;
  cubes: CubeDict;
  history: string[];
  showLabels: boolean;
  showContainer: boolean;
  xray: boolean;
  containerSize: ContainerSize;
  rotateNonce: number;
  rotateDir: 0 | 1 | -1;
  viewYaw: number;
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];

  setMode: (m: Mode) => void;
  setTool: (t: Tool) => void;
  setColor: (c: string) => void;
  setContainerSize: (size: ContainerSize) => void;
  toggleLabels: () => void;
  toggleContainer: () => void;
  toggleXray: () => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  setViewYaw: (y: number) => void;
  setCamera: (pos: [number, number, number], target: [number, number, number]) => void;

  addCube: (x: number, y: number, z: number) => boolean;
  removeCube: (x: number, y: number, z: number) => boolean;
  paintCube: (x: number, y: number, z: number) => boolean;
  clearAll: () => void;
  undo: () => void;
}

export const useCubeStore = create<CubeState>()(
  immer((set, get) => {
    const snapshot = () => {
      const arr = Object.values(get().cubes);
      set((s) => {
        s.history.push(JSON.stringify(arr));
        if (s.history.length > 50) s.history.shift();
      });
    };

    return {
      mode: "build",
      tool: "place",
      color: PALETTE[0],
      cubes: { [keyOf(0, 0, 0)]: { x: 0, y: 0, z: 0, color: PALETTE[0] } },
      history: [],
      showLabels: true,
      showContainer: false,
      xray: false,
      containerSize: { w: 2, h: 2, d: 2 },
      rotateNonce: 0,
      rotateDir: 0,
      viewYaw: Math.PI / 4, // matches initial camera at (14,14,14)
      cameraPos: [14, 14, 14],
      cameraTarget: [0, 0, 0],

      setMode: (m) => set((s) => { s.mode = m; }),
      setTool: (t) => set((s) => { s.tool = t; }),
      setColor: (c) => set((s) => { s.color = c; }),
      setContainerSize: (size) => set((s) => { s.containerSize = size; }),
      toggleLabels: () => set((s) => { s.showLabels = !s.showLabels; }),
      toggleContainer: () => set((s) => { s.showContainer = !s.showContainer; }),
      toggleXray: () => set((s) => { s.xray = !s.xray; }),
      rotateLeft: () => set((s) => { s.rotateDir = -1; s.rotateNonce++; }),
      rotateRight: () => set((s) => { s.rotateDir = 1; s.rotateNonce++; }),
      setViewYaw: (y) => set((s) => { s.viewYaw = y; }),
      setCamera: (pos, target) => set((s) => { s.cameraPos = pos; s.cameraTarget = target; }),

      addCube: (x, y, z) => {
        const k = keyOf(x, y, z);
        if (get().cubes[k]) return false;
        if (x < -10 || x >= 10 || z < -10 || z >= 10 || y < 0 || y > 30) return false;
        if (get().showContainer && !isWithinContainerBounds(x, y, z, get().containerSize)) return false;
        snapshot();
        const color = get().color;
        set((s) => { s.cubes[k] = { x, y, z, color }; });
        return true;
      },
      removeCube: (x, y, z) => {
        const k = keyOf(x, y, z);
        if (!get().cubes[k]) return false;
        snapshot();
        set((s) => { delete s.cubes[k]; });
        return true;
      },
      paintCube: (x, y, z) => {
        const k = keyOf(x, y, z);
        if (!get().cubes[k]) return false;
        snapshot();
        const color = get().color;
        set((s) => {
          const c = s.cubes[k];
          if (c) c.color = color;
        });
        return true;
      },
      clearAll: () => {
        if (Object.keys(get().cubes).length === 0) return;
        snapshot();
        set((s) => { s.cubes = {}; });
      },
      undo: () => {
        const prev = get().history[get().history.length - 1];
        if (!prev) return;
        const arr: Cube[] = JSON.parse(prev);
        set((s) => {
          s.history.pop();
          s.cubes = Object.fromEntries(arr.map((c) => [keyOf(c.x, c.y, c.z), c]));
        });
      },
    };
  })
);

// ===== Pure helpers =====
export function computeSurfaceArea(cubes: Iterable<Cube>): number {
  const set = new Set<string>();
  for (const c of cubes) set.add(keyOf(c.x, c.y, c.z));
  const dirs: Array<[number, number, number]> = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];
  let exposed = 0;
  for (const c of cubes) {
    for (const [dx, dy, dz] of dirs) {
      if (!set.has(keyOf(c.x + dx, c.y + dy, c.z + dz))) exposed++;
    }
  }
  return exposed;
}

export function projectViews(cubes: Iterable<Cube>) {
  const top = new Set<string>();
  const front = new Set<string>();
  const side = new Set<string>();
  for (const c of cubes) {
    top.add(`${c.x},${c.z}`);
    front.add(`${c.x},${c.y}`);
    side.add(`${c.z},${c.y}`);
  }
  return { top: top.size, front: front.size, side: side.size };
}

/**
 * 2D color projections for the inspect-mode views. For each face of the
 * bounding box we pick the cube nearest the viewer (max value along the
 * projection axis) so the colour you see matches what the camera would.
 *
 * Returned grids are indexed [row][col] where row 0 is the TOP of the image
 * (so we can render them directly with CSS grid). Empty cells are `null`.
 *
 * `yaw` (radians) snaps to the nearest 90° step and rotates the cubes around
 * the Y axis before projecting, so the Front/Right views follow the camera.
 */
export function projectColorViews(cubes: Iterable<Cube>, yaw = 0) {
  // Snap yaw to nearest 90° (4 cardinal orientations).
  const steps = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const rotated: Cube[] = [];
  for (const c of cubes) {
    let { x, z } = c;
    for (let i = 0; i < steps; i++) {
      // Rotate -90° around Y so the camera's current "front" maps to +Z.
      const nx = z;
      const nz = -x;
      x = nx; z = nz;
    }
    rotated.push({ x, y: c.y, z, color: c.color });
  }

  const bb = computeBoundingBox(rotated);
  const W = Math.max(1, bb.width);
  const H = Math.max(1, bb.height);
  const D = Math.max(1, bb.depth);

  const front: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const frontDepth: number[][] = Array.from({ length: H }, () => Array(W).fill(-Infinity));
  const right: (string | null)[][] = Array.from({ length: H }, () => Array(D).fill(null));
  const rightDepth: number[][] = Array.from({ length: H }, () => Array(D).fill(-Infinity));
  const top: (string | null)[][] = Array.from({ length: D }, () => Array(W).fill(null));
  const topDepth: number[][] = Array.from({ length: D }, () => Array(W).fill(-Infinity));

  for (const c of rotated) {
    const cx = c.x - bb.minX;
    const cy = c.y - bb.minY;
    const cz = c.z - bb.minZ;
    const fr = H - 1 - cy;
    if (c.z > frontDepth[fr][cx]) { frontDepth[fr][cx] = c.z; front[fr][cx] = c.color; }
    const rcol = D - 1 - cz;
    if (c.x > rightDepth[fr][rcol]) { rightDepth[fr][rcol] = c.x; right[fr][rcol] = c.color; }
    const trow = D - 1 - cz;
    if (c.y > topDepth[trow][cx]) { topDepth[trow][cx] = c.y; top[trow][cx] = c.color; }
  }
  return { front, right, top, width: W, height: H, depth: D };
}

/** Counts of cubes by color, sorted descending. */
export function colorCounts(cubes: Iterable<Cube>): Array<{ color: string; count: number }> {
  const m = new Map<string, number>();
  for (const c of cubes) m.set(c.color, (m.get(c.color) ?? 0) + 1);
  return Array.from(m.entries())
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count);
}

/** Axis-aligned bounding box of a cube collection (inclusive cell coords). */
export function computeBoundingBox(cubes: Iterable<Cube>) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let count = 0;
  for (const c of cubes) {
    count++;
    if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y; if (c.y > maxY) maxY = c.y;
    if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z;
  }
  if (count === 0) {
    return { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0,
             width: 0, height: 0, depth: 0, bboxVolume: 0 };
  }
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const depth = maxZ - minZ + 1;
  return { minX, minY, minZ, maxX, maxY, maxZ,
           width, height, depth, bboxVolume: width * height * depth };
}

/**
 * Number of empty cells fully enclosed by solid cubes — i.e. empty cells
 * inside the bounding box that cannot reach the outside via 6-connected
 * flood fill. Useful for "圍起來的體積" questions.
 */
export function computeEnclosedVolume(cubes: Iterable<Cube>): number {
  const arr = Array.from(cubes);
  if (arr.length === 0) return 0;
  const bb = computeBoundingBox(arr);
  // Pad bbox by 1 so the outside layer is the flood-fill seed region.
  const x0 = bb.minX - 1, y0 = bb.minY - 1, z0 = bb.minZ - 1;
  const x1 = bb.maxX + 1, y1 = bb.maxY + 1, z1 = bb.maxZ + 1;
  const solid = new Set<string>();
  for (const c of arr) solid.add(keyOf(c.x, c.y, c.z));

  const visited = new Set<string>();
  const stack: Array<[number, number, number]> = [[x0, y0, z0]];
  const dirs: Array<[number, number, number]> = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
  ];
  while (stack.length) {
    const [x, y, z] = stack.pop()!;
    if (x < x0 || x > x1 || y < y0 || y > y1 || z < z0 || z > z1) continue;
    const k = keyOf(x, y, z);
    if (visited.has(k) || solid.has(k)) continue;
    visited.add(k);
    for (const [dx, dy, dz] of dirs) stack.push([x + dx, y + dy, z + dz]);
  }
  // Empty cells inside bbox that were NOT reached from outside are enclosed.
  let enclosed = 0;
  for (let x = bb.minX; x <= bb.maxX; x++) {
    for (let y = bb.minY; y <= bb.maxY; y++) {
      for (let z = bb.minZ; z <= bb.maxZ; z++) {
        const k = keyOf(x, y, z);
        if (!solid.has(k) && !visited.has(k)) enclosed++;
      }
    }
  }
  return enclosed;
}

/**
 * Pool / "trapped water" volume: treats the y=0 plane (the grid floor) as a
 * solid ground and asks how many unit cubes of water the construction can
 * hold from above. This matches the student intuition that a roofless ring
 * of cubes is a pool. Implemented as the classic Trapping Rain Water II
 * algorithm on the (x, z) heightmap, with a 1-cell padded border at h=0.
 */
export function computePoolVolume(cubes: Iterable<Cube>): number {
  const arr = Array.from(cubes);
  if (arr.length === 0) return 0;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of arr) {
    if (c.x < minX) minX = c.x; if (c.x > maxX) maxX = c.x;
    if (c.z < minZ) minZ = c.z; if (c.z > maxZ) maxZ = c.z;
  }
  // Pad by 1 so the rim around the build is open ground (height 0) that
  // water can spill onto.
  const x0 = minX - 1, x1 = maxX + 1, z0 = minZ - 1, z1 = maxZ + 1;
  const W = x1 - x0 + 1;
  const D = z1 - z0 + 1;
  const top = new Array<number>(W * D).fill(0);
  const idx = (x: number, z: number) => (x - x0) * D + (z - z0);
  // Heightmap: highest y of any cube in column (x, z), plus 1 (cube top face).
  // Cubes below y=0 are ignored — the floor is solid ground.
  for (const c of arr) {
    if (c.y < 0) continue;
    const i = idx(c.x, c.z);
    if (c.y + 1 > top[i]) top[i] = c.y + 1;
  }

  // Min-heap of (column index, current water level), seeded with the border.
  type Node = { i: number; level: number };
  const heap: Node[] = [];
  const visited = new Uint8Array(W * D);
  const push = (n: Node) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].level <= heap[i].level) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = (): Node => {
    const root = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      while (true) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < heap.length && heap[l].level < heap[s].level) s = l;
        if (r < heap.length && heap[r].level < heap[s].level) s = r;
        if (s === i) break;
        [heap[s], heap[i]] = [heap[i], heap[s]];
        i = s;
      }
    }
    return root;
  };

  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) {
        const i = idx(x, z);
        visited[i] = 1;
        push({ i, level: top[i] });
      }
    }
  }

  let water = 0;
  const dirs2: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (heap.length) {
    const { i, level } = pop();
    const x = Math.floor(i / D) + x0;
    const z = (i % D) + z0;
    for (const [dx, dz] of dirs2) {
      const nx = x + dx, nz = z + dz;
      if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
      const ni = idx(nx, nz);
      if (visited[ni]) continue;
      visited[ni] = 1;
      const h = top[ni];
      const newLevel = Math.max(level, h);
      if (newLevel > h) water += newLevel - h;
      push({ i: ni, level: newLevel });
    }
  }
  return water;
}
