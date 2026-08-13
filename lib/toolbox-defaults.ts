import type { ITool, SchoolScope } from "@/models/ToolboxConfig";

export interface ToolboxConfigDefault {
  type: string;
  label: string;
  description: string;
  isActive: boolean;
  /** Built-ins are open to every school until an admin narrows them. */
  schoolScope: SchoolScope;
  schools: never[];
  tools: ITool[];
}

/**
 * Built-in toolbox groups that the app can fall back to when the corresponding
 * document is missing from the database. The journey group in particular was
 * historically not seeded on every environment, so the public toolbox endpoint
 * always surfaced it via this fallback. The admin endpoint uses the same
 * definition so the group still gets a visibility toggle (and is persisted to
 * the DB the first time an admin toggles it).
 */
export const journeyFallbackConfig: ToolboxConfigDefault = {
  type: "journey",
  label: "行程圖 Journey Graph",
  description: "行程圖相關題目：閱讀距離-時間圖，描述每段旅程、停留、折返、平行與相交路線",
  isActive: true,
  schoolScope: "all",
  schools: [],
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
      isActive: true,
      schoolScope: "all",
      schools: [],
    },
  ],
};

/** Fallback configs keyed by type, for endpoints that need to self-heal. */
export const TOOLBOX_DEFAULTS: Record<string, ToolboxConfigDefault> = {
  journey: journeyFallbackConfig,
};
