/**
 * Seed script: populate initial toolbox configurations into MongoDB.
 *
 * Usage (inside Docker — the tools profile already supplies MONGODB_URI):
 *   docker compose run --rm tools npx tsx scripts/seed-toolbox.ts
 *
 * Usage (locally, reads MONGODB_URI from .env.local or .env):
 *   npx tsx scripts/seed-toolbox.ts
 *
 * Scope: the toolbox is the 數學科「AI 解題輔助」dashboard's tool list and nothing
 * else reads it, so only math tools belong here. (An "english" group holding a
 * Location and Direction entry used to live in this list, from a time when the
 * toolbox was meant as a cross-subject registry. Nothing ever consumed it —
 * English's Location and Direction is a topic, controlled per school in
 * 學校管理 — so it was removed rather than left to reappear on a fresh install.)
 *
 * Safe to re-run against a live database: it only fills in what is missing.
 * Anything an admin controls in 工具管理 is left exactly as they set it —
 * the group and tool on/off switches, the 開放範圍 (schoolScope / schools) and
 * the display names. Only fields that belong to the code (description, icon and
 * the colour classes) are refreshed, so editing them here still takes effect.
 * Nothing is ever deleted; a group dropped from this list stays in the database
 * until someone removes it deliberately.
 */

import mongoose from "mongoose";
import { requireMongoUri } from "./lib/load-env";
import { ToolboxConfig, type ITool } from "../models/ToolboxConfig";

const MONGODB_URI = requireMongoUri();

/** The seed owns presentation; the admin owns isActive / schoolScope / label. */
type SeedTool = Omit<ITool, "isActive" | "schoolScope" | "schools">;

interface SeedGroup {
  type: string;
  label: string;
  description: string;
  isActive: boolean;
  tools: SeedTool[];
}

const seedData: SeedGroup[] = [
  {
    type: "clock",
    label: "時鐘 Clock",
    description: "時鐘相關題目（24小時制、時間差等）",
    isActive: true,
    tools: [
      {
        key: "clock-24hrs",
        label: "24小時制",
        sub: "ClockApp1 (24hrs)",
        icon: "Clock",
        bg: "bg-blue-100",
        iconBg: "bg-blue-500",
        border: "border-blue-200",
        hover: "hover:bg-blue-200 hover:border-blue-300",
        text: "text-blue-700",
      },
      {
        key: "clock-time-difference",
        label: "時間差",
        sub: "ClockApp2 (TimeDifference)",
        icon: "Timer",
        bg: "bg-cyan-100",
        iconBg: "bg-cyan-500",
        border: "border-cyan-200",
        hover: "hover:bg-cyan-200 hover:border-cyan-300",
        text: "text-cyan-700",
      },
    ],
  },
  {
    type: "fraction-operations",
    label: "四則運算",
    description: "分數四則運算題目（分數加法、減法、乘法、除法、應用題等）",
    isActive: true,
    tools: [
      {
        key: "fraction-addition",
        label: "分數相加",
        sub: "FractionApp (Addition)",
        icon: "Plus",
        bg: "bg-teal-100",
        iconBg: "bg-teal-500",
        border: "border-teal-200",
        hover: "hover:bg-teal-200 hover:border-teal-300",
        text: "text-teal-700",
      },
      {
        key: "fraction-subtraction",
        label: "分數相減",
        sub: "FractionApp (Subtraction)",
        icon: "Minus",
        bg: "bg-rose-100",
        iconBg: "bg-rose-500",
        border: "border-rose-200",
        hover: "hover:bg-rose-200 hover:border-rose-300",
        text: "text-rose-700",
      },
      {
        key: "fraction-multiplication",
        label: "分數相乘",
        sub: "FractionApp (Multiplication)",
        icon: "X",
        bg: "bg-purple-100",
        iconBg: "bg-purple-500",
        border: "border-purple-200",
        hover: "hover:bg-purple-200 hover:border-purple-300",
        text: "text-purple-700",
      },
      {
        key: "fraction-division",
        label: "分數相除",
        sub: "FractionApp (Division)",
        icon: "Divide",
        bg: "bg-amber-100",
        iconBg: "bg-amber-500",
        border: "border-amber-200",
        hover: "hover:bg-amber-200 hover:border-amber-300",
        text: "text-amber-700",
      },
    ],
  },
  {
    type: "fraction-concept",
    label: "分數概念",
    description: "分數概念題目（分數比較、相等分數、整數與分數互換、整數的部分等）",
    isActive: true,
    tools: [
      {
        key: "fraction-comparison",
        label: "分數比較",
        sub: "FractionApp (Comparison)",
        icon: "ArrowUpDown",
        bg: "bg-cyan-100",
        iconBg: "bg-cyan-500",
        border: "border-cyan-200",
        hover: "hover:bg-cyan-200 hover:border-cyan-300",
        text: "text-cyan-700",
      },
      {
        key: "fraction-expanding-simplifying",
        label: "相等分數",
        sub: "FractionApp13 (Expanding & Simplifying)",
        icon: "ArrowLeftRight",
        bg: "bg-orange-100",
        iconBg: "bg-orange-500",
        border: "border-orange-200",
        hover: "hover:bg-orange-200 hover:border-orange-300",
        text: "text-orange-700",
      },
      {
        key: "fraction-converting",
        label: "整數與分數互換",
        sub: "FractionApp (Converting)",
        icon: "Repeat",
        bg: "bg-pink-100",
        iconBg: "bg-pink-500",
        border: "border-pink-200",
        hover: "hover:bg-pink-200 hover:border-pink-300",
        text: "text-pink-700",
      },
      {
        key: "fraction-integer",
        label: "整數的部分",
        sub: "FractionApp (Integer)",
        icon: "Grid3x3",
        bg: "bg-lime-100",
        iconBg: "bg-lime-500",
        border: "border-lime-200",
        hover: "hover:bg-lime-200 hover:border-lime-300",
        text: "text-lime-700",
      },
    ],
  },
  {
    type: "volume",
    label: "體積 Volume",
    description: "3D 體積學習：堆疊立方體、計算體積／表面積、觀察三視圖",
    isActive: true,
    tools: [
      {
        key: "volume-cubes",
        label: "體積探索",
        sub: "Volume Explorer (3D)",
        icon: "Box",
        bg: "bg-indigo-100",
        iconBg: "bg-indigo-500",
        border: "border-indigo-200",
        hover: "hover:bg-indigo-200 hover:border-indigo-300",
        text: "text-indigo-700",
      },
    ],
  },
  {
    type: "journey",
    label: "行程圖 Journey Graph",
    description: "行程圖相關題目：閱讀距離-時間圖，描述每段旅程、停留、折返、平行與相交路線",
    isActive: true,
    tools: [
      {
        key: "journey-graph",
        label: "行程圖",
        sub: "Journey Graph",
        icon: "ChartLine",
        bg: "bg-sky-100",
        iconBg: "bg-sky-500",
        border: "border-sky-200",
        hover: "hover:bg-sky-200 hover:border-sky-300",
        text: "text-sky-700",
      },
    ],
  },
];

/** Fields the code owns. Copied onto existing tools so edits here land. */
function applyPresentation(tool: ITool, seed: SeedTool): boolean {
  let changed = false;
  const fields = ["sub", "icon", "bg", "iconBg", "border", "hover", "text"] as const;

  for (const field of fields) {
    if (tool[field] !== seed[field]) {
      tool[field] = seed[field];
      changed = true;
    }
  }

  return changed;
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  let created = 0;
  let toolsAdded = 0;
  let refreshed = 0;
  let untouched = 0;

  for (const def of seedData) {
    const existing = await ToolboxConfig.findOne({ type: def.type });

    if (!existing) {
      await ToolboxConfig.create(def);
      created++;
      console.log(`+ created "${def.type}" (${def.label}) with ${def.tools.length} tool(s)`);
      continue;
    }

    const notes: string[] = [];

    if (existing.description !== def.description) {
      existing.description = def.description;
      notes.push("description");
    }

    // Add tools introduced since this group was first seeded. A new tool starts
    // live, but inherits the group's 開放範圍 rather than defaulting to "all":
    // in a group narrowed to a pilot school, a deploy that quietly widened
    // access to everyone would be the wrong surprise.
    const known = new Set(existing.tools.map((t: ITool) => t.key));
    for (const tool of def.tools) {
      if (known.has(tool.key)) continue;
      const schoolScope = existing.schoolScope ?? "all";
      const schools = schoolScope === "selected" ? [...(existing.schools ?? [])] : [];
      existing.tools.push({ ...tool, isActive: true, schoolScope, schools });
      toolsAdded++;
      notes.push(
        `+tool ${tool.key} (${schoolScope === "all" ? "全部學校" : `${schools.length} 間學校，沿用群組`})`,
      );
    }

    let presentationChanged = false;
    for (const tool of existing.tools) {
      const seedTool = def.tools.find((t) => t.key === tool.key);
      if (seedTool && applyPresentation(tool, seedTool)) presentationChanged = true;
    }
    if (presentationChanged) notes.push("icons/colours");

    if (notes.length === 0) {
      untouched++;
      console.log(`= "${def.type}" already up to date, left untouched`);
      continue;
    }

    existing.markModified("tools");
    await existing.save();
    refreshed++;
    console.log(`~ "${def.type}" updated: ${notes.join(", ")}`);
  }

  const all = await ToolboxConfig.find()
    .select({ type: 1, tools: 1 })
    .lean<{ type: string; tools?: { key: string }[] }[]>();

  const extra = all.filter((c) => !seedData.some((d) => d.type === c.type));
  if (extra.length) {
    console.log(
      `\nNote: ${extra.length} group(s) in the database are not in this seed and were left alone: ` +
        extra.map((e) => e.type).join(", "),
    );
  }

  // A tool key must live in exactly one group: access checks resolve a key with
  // a single lookup, so a key in two groups would resolve arbitrarily and the
  // 開放範圍 set on the group an admin can see might not be the one enforced.
  const groupsByKey = new Map<string, string[]>();
  for (const group of all) {
    for (const tool of group.tools ?? []) {
      groupsByKey.set(tool.key, [...(groupsByKey.get(tool.key) ?? []), group.type]);
    }
  }
  const duplicates = [...groupsByKey.entries()].filter(([, types]) => types.length > 1);
  if (duplicates.length) {
    console.warn(
      `\nWARNING: ${duplicates.length} tool key(s) appear in more than one group. ` +
        "Access checks resolve a key to one group, so scope and on/off settings may " +
        "not behave as the admin expects. Remove the duplicate from the stale group:",
    );
    for (const [key, types] of duplicates) {
      console.warn(`  ${key}: ${types.join(", ")}`);
    }
  }

  console.log(
    `\nSeed complete: ${created} group(s) created, ${toolsAdded} tool(s) added, ` +
      `${refreshed} group(s) refreshed, ${untouched} unchanged.\n` +
      "Existing on/off switches, 開放範圍 and display names were preserved.",
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
