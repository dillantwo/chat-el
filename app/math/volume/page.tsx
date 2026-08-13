"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  PALETTE,
  colorCounts,
  computeBoundingBox,
  computeEnclosedVolume,
  computePoolVolume,
  computeSurfaceArea,
  isWithinContainerBounds,
  projectColorViews,
  projectViews,
  useCubeStore,
  type ContainerSize,
  type Tool,
} from "./store";

// R3F must be client-only — Canvas relies on browser APIs.
const VolumeScene = dynamic(
  () => import("./VolumeScene").then((m) => m.VolumeScene),
  { ssr: false }
);

const TOOL_BUTTONS: Array<{ key: Tool | "xray" | "container"; icon: string; label: string }> = [
  { key: "place", icon: "📦", label: "放置方塊" },
  { key: "erase", icon: "⬜", label: "刪除方塊" },
  { key: "paint", icon: "🎨", label: "上色 / 改色" },
  { key: "xray", icon: "👁️", label: "透視模式" },
  { key: "rotateView", icon: "🔄", label: "旋轉視圖" },
  { key: "container", icon: "🗃️", label: "顯示容器" },
];

const CONTAINER_PRESETS: Array<{ value: string; label: string; size: ContainerSize }> = [
  { value: "2x2x2", label: "2 × 2 × 2", size: { w: 2, h: 2, d: 2 } },
  { value: "3x2x2", label: "3 × 2 × 2", size: { w: 3, h: 2, d: 2 } },
  { value: "4x3x2", label: "4 × 3 × 2", size: { w: 4, h: 3, d: 2 } },
  { value: "4x3x3", label: "4 × 3 × 3", size: { w: 4, h: 3, d: 3 } },
];

function presetValueFor(size: ContainerSize) {
  return `${size.w}x${size.h}x${size.d}`;
}

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
};

export default function VolumeExplorerPage() {
  const mode = useCubeStore((s) => s.mode);
  const tool = useCubeStore((s) => s.tool);
  const color = useCubeStore((s) => s.color);
  const xray = useCubeStore((s) => s.xray);
  const showContainer = useCubeStore((s) => s.showContainer);
  const containerSize = useCubeStore((s) => s.containerSize);
  const cubes = useCubeStore((s) => s.cubes);

  const setMode = useCubeStore((s) => s.setMode);
  const setTool = useCubeStore((s) => s.setTool);
  const setColor = useCubeStore((s) => s.setColor);
  const setContainerSize = useCubeStore((s) => s.setContainerSize);
  const toggleContainer = useCubeStore((s) => s.toggleContainer);
  const toggleXray = useCubeStore((s) => s.toggleXray);
  const rotateLeft = useCubeStore((s) => s.rotateLeft);
  const rotateRight = useCubeStore((s) => s.rotateRight);
  const clearAll = useCubeStore((s) => s.clearAll);
  const undo = useCubeStore((s) => s.undo);

  const cubeArr = useMemo(() => Object.values(cubes), [cubes]);
  const count = cubeArr.length;
  const bbox = useMemo(() => computeBoundingBox(cubeArr), [cubeArr]);
  const area = useMemo(() => computeSurfaceArea(cubeArr), [cubeArr]);
  const views = useMemo(() => projectViews(cubeArr), [cubeArr]);
  const enclosed = useMemo(() => computeEnclosedVolume(cubeArr), [cubeArr]);
  const pool = useMemo(() => computePoolVolume(cubeArr), [cubeArr]);
  const containerVolume = containerSize.w * containerSize.h * containerSize.d;
  const filledCount = useMemo(
    () => cubeArr.filter((cube) => isWithinContainerBounds(cube.x, cube.y, cube.z, containerSize)).length,
    [cubeArr, containerSize]
  );
  const remainingCount = Math.max(containerVolume - filledCount, 0);
  const extraCount = Math.max(count - filledCount, 0);
  const containerTaskComplete = showContainer && containerVolume > 0 && remainingCount === 0;
  const [measurementUnit, setMeasurementUnit] = useState("m");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  function requestConfirmation(config: ConfirmDialogState) {
    setConfirmDialog(config);
  }

  function closeConfirmation() {
    setConfirmDialog(null);
  }

  function confirmAndClose() {
    if (!confirmDialog) return;
    const action = confirmDialog.onConfirm;
    setConfirmDialog(null);
    action();
  }

  function handleContainerSizeChange(value: string) {
    const preset = CONTAINER_PRESETS.find((item) => item.value === value);
    if (!preset) return;

    const applySizeChange = () => {
      clearAll();
      setContainerSize(preset.size);
      setMode("build");
      setTool("place");
      if (!showContainer) toggleContainer();
    };

    if (count > 0) {
      requestConfirmation({
        title: "切換容器尺寸",
        message: "這會重新開始目前的容器任務，已放置的方塊會被清除。要繼續嗎？",
        confirmLabel: "重新開始",
        cancelLabel: "先不要",
        onConfirm: applySizeChange,
      });
      return;
    }

    applySizeChange();
  }

  // Push state up to the dashboard (when embedded in iframe) so the AI tutor
  // chatbot can reason about the student's current construction.
  useEffect(() => {
    try {
      window.parent?.postMessage(
        {
          type: "volume-app:state",
          payload: {
            tool: "volume-cubes",
            cubeCount: count,
            volume: count,
            surfaceArea: area,
            enclosedVolume: enclosed,
            poolVolume: pool,
            views,
            cubes: cubeArr.map((c) => ({ x: c.x, y: c.y, z: c.z, color: c.color })),
            mode,
            tool_active: tool,
          },
        },
        "*"
      );
    } catch {}
  }, [count, area, enclosed, pool, views, cubeArr, mode, tool]);

  const isInteractionTool = (k: string): k is Tool =>
    k === "place" || k === "erase" || k === "paint" || k === "rotateView";

  function handleToolClick(k: typeof TOOL_BUTTONS[number]["key"]) {
    if (k === "xray") return toggleXray();
    if (k === "container") return toggleContainer();
    setTool(k);
  }

  function isToolActive(k: string) {
    if (k === "xray") return xray;
    if (k === "container") return showContainer;
    return tool === k;
  }

  return (
    <div className="grid h-full grid-rows-[40px_1fr] bg-white text-[#080808]">
      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-[#d8d8d8] bg-white">
        {([
          { id: "build", label: "手動構建" },
          { id: "inspect", label: "觀察模式" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`text-sm font-semibold leading-10 select-none transition-colors border-b-2 ${
              mode === t.id
                ? "text-[#146ef5] border-[#146ef5]"
                : "text-[#6b7280] border-transparent hover:text-[#080808]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="grid min-h-0 grid-cols-[180px_1fr_200px]">
        {/* LEFT: tools */}
        <aside className="overflow-y-auto border-r border-[#d8d8d8] bg-white p-3">
          <SectionTitle>{mode === "build" ? "手動構建" : "觀察模式"}</SectionTitle>

          <SectionTitle>Tools</SectionTitle>
          <div className="grid grid-cols-3 gap-1.5">
            {TOOL_BUTTONS.map((b) => (
              <button
                key={b.key}
                onClick={() => handleToolClick(b.key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-[11px] transition-colors ${
                  isToolActive(b.key)
                    ? "border-[#146ef5] bg-[#146ef5]/10 text-[#146ef5]"
                    : "border-[#d8d8d8] bg-white text-[#080808] hover:border-[#b9d3fb] hover:bg-[#f3f6fb]"
                }`}
              >
                <span className="text-base leading-none">{b.icon}</span>
                <span>{b.label}</span>
              </button>
            ))}
          </div>

          {showContainer && (
            <>
              <SectionTitle>容器任務</SectionTitle>
              <label className="mb-1 block text-[11px] font-medium text-[#6b7280]">容器尺寸</label>
              <select
                value={presetValueFor(containerSize)}
                onChange={(e) => handleContainerSizeChange(e.target.value)}
                className="mb-1.5 w-full rounded-md border border-[#d8d8d8] bg-white px-2.5 py-2 text-xs text-[#080808] outline-none transition-colors focus:border-[#146ef5]"
              >
                {CONTAINER_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <p className="mb-1.5 rounded-md border border-[#d8d8d8] bg-[#f8fafc] px-2.5 py-2 text-[11px] leading-relaxed text-[#6b7280]">
                切換尺寸會重新開始任務。請把容器內每一格都填滿。
              </p>
            </>
          )}

          <SectionTitle>Colors</SectionTitle>
          <div className="grid grid-cols-8 gap-1">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                onClick={() => setColor(hex)}
                style={{ background: hex }}
                className={`aspect-square w-full rounded ${
                  color === hex ? "scale-105 ring-2 ring-[#146ef5]" : "ring-2 ring-transparent"
                }`}
                aria-label={`color ${hex}`}
              />
            ))}
          </div>

          <SectionTitle>View</SectionTitle>
          <ActionButton onClick={rotateLeft}>⟲ 向左旋轉</ActionButton>
          <ActionButton onClick={rotateRight}>⟳ 向右旋轉</ActionButton>

          <SectionTitle>Workspace</SectionTitle>
          <ActionButton
            onClick={() => {
              if (!count) {
                clearAll();
                return;
              }
              requestConfirmation({
                title: "清除全部方塊",
                message: "目前的作品會被清空，但你之後還是可以用復原拿回上一步。確定要清除嗎？",
                confirmLabel: "清除全部",
                cancelLabel: "保留作品",
                tone: "danger",
                onConfirm: clearAll,
              });
            }}
          >
            🗑 清除全部
          </ActionButton>
          <ActionButton onClick={undo}>↩ 復原</ActionButton>
        </aside>

        {/* CENTER: 3D canvas (build) or inspection panels (inspect) */}
        <div className="relative min-w-0 bg-white">
          {mode === "build" ? (
            <>
              <VolumeScene />
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-[#d8d8d8] bg-white/90 px-2.5 py-1.5 text-[11px] text-[#6b7280] backdrop-blur-sm">
                點擊網格放置方塊 · 拖曳右鍵旋轉視角
              </div>
            </>
          ) : (
            <InspectPanels />
          )}
        </div>

        {/* RIGHT: stats */}
        <aside className="overflow-y-auto border-l border-[#d8d8d8] bg-white p-3">
          <MeasureInfoPanel
            bbox={bbox}
            cubeCount={count}
            area={area}
            pool={pool}
            filledCount={filledCount}
            remainingCount={remainingCount}
            extraCount={extraCount}
            containerVolume={containerVolume}
            measurementUnit={measurementUnit}
            onMeasurementUnitChange={setMeasurementUnit}
            showContainer={showContainer}
            containerTaskComplete={containerTaskComplete}
          />

          <Card title="三視圖投影">
            <Stat label="頂視圖（俯視）" value={views.top} />
            <Stat label="前視圖" value={views.front} />
            <Stat label="側視圖" value={views.side} />
          </Card>

          <Card title="提示">
            <p className="text-[11px] leading-relaxed text-[#6b7280]">
              {mode === "build"
                ? "選擇「放置方塊」工具，點擊網格或既有方塊的面來疊加；選「刪除方塊」可移除；「上色」可變更顏色。"
                : "觀察模式：拖曳視角檢視整體形狀，右側面板會顯示體積、表面積與三視圖。"}
            </p>
          </Card>
        </aside>
      </div>

      <FriendlyConfirmDialog
        dialog={confirmDialog}
        onCancel={closeConfirmation}
        onConfirm={confirmAndClose}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1.5 text-[11px] font-bold uppercase tracking-[0.8px] text-[#6b7280] first:mt-0">
      {children}
    </div>
  );
}

function ActionButton({
  onClick, children,
}: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mb-1.5 flex w-full items-center gap-1.5 rounded-md border border-[#d8d8d8] bg-white px-2.5 py-2 text-xs text-[#080808] transition-colors hover:bg-[#f3f6fb]"
    >
      {children}
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 rounded-lg border border-[#d8d8d8] bg-white p-3">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.6px] text-[#6b7280]">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="my-1 flex justify-between text-[13px]">
      <span className="text-[#6b7280]">{label}</span>
      <span className="font-bold text-[#146ef5]">{value}</span>
    </div>
  );
}

function MeasureInfoPanel({
  bbox,
  cubeCount,
  area,
  pool,
  filledCount,
  remainingCount,
  extraCount,
  containerVolume,
  measurementUnit,
  onMeasurementUnitChange,
  showContainer,
  containerTaskComplete,
}: {
  bbox: ReturnType<typeof computeBoundingBox>;
  cubeCount: number;
  area: number;
  pool: number;
  filledCount: number;
  remainingCount: number;
  extraCount: number;
  containerVolume: number;
  measurementUnit: string;
  onMeasurementUnitChange: (value: string) => void;
  showContainer: boolean;
  containerTaskComplete: boolean;
}) {
  const areaUnit = `${measurementUnit}²`;
  const volumeUnit = `${measurementUnit}³`;

  return (
    <div className="mb-2.5 rounded-lg border border-[#d8d8d8] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-[0.2px] text-[#146ef5]">度量資訊</h3>
      </div>

      <div className="mb-1 text-[11px] text-[#6b7280]">度量單位</div>
      <select
        value={measurementUnit}
        onChange={(e) => onMeasurementUnitChange(e.target.value)}
        className="mb-2.5 w-full rounded-md border border-[#d8d8d8] bg-white px-2.5 py-2 text-xs text-[#080808] outline-none transition-colors focus:border-[#146ef5]"
      >
        <option value="m">m</option>
        <option value="cm">cm</option>
      </select>

      <MeasureLine label={`X: ${bbox.width} ${measurementUnit}`} />
      <MeasureLine label={`Y: ${bbox.height} ${measurementUnit}`} />
      <MeasureLine label={`Z: ${bbox.depth} ${measurementUnit}`} />
      <MeasureLine label={`V: ${cubeCount} ${volumeUnit}`} />
      <MeasureLine label={`正方體個數: ${cubeCount}`} />
      <MeasureLine label={`表面積: ${area} ${areaUnit}`} />
      <MeasureLine label={`包圍的空間: ${pool} ${volumeUnit}`} />

      <div className="mt-2.5 border-t border-[#e5ecf5] pt-2 text-[11px] font-bold text-[#146ef5]">
        容器任務
      </div>
      {showContainer ? (
        <>
          <MeasureLine label={`目標體積: ${containerVolume} ${volumeUnit}`} />
          <MeasureLine label={`已填: ${filledCount}`} />
          <MeasureLine label={`未填: ${remainingCount}`} />
          <MeasureLine label={`額外: ${extraCount}`} />
          <div className="pt-1 text-[11px] font-bold text-[#146ef5]">
            <span className="mr-1">任務狀態:</span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                containerTaskComplete
                  ? "bg-[#ecfdf3] text-[#15803d]"
                  : "bg-[#fff7ed] text-[#ea580c]"
              }`}
            >
              {containerTaskComplete ? "完成" : "進行中"}
            </span>
          </div>
        </>
      ) : (
        <div className="pt-1 text-[11px] text-[#6b7280]">先點擊「顯示容器」開始容器任務。</div>
      )}
    </div>
  );
}

function MeasureLine({ label }: { label: string }) {
  return <div className="py-0.5 text-[11px] font-bold text-[#146ef5]">{label}</div>;
}

function FriendlyConfirmDialog({
  dialog,
  onCancel,
  onConfirm,
}: {
  dialog: ConfirmDialogState | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!dialog) return null;

  const confirmClassName = dialog.tone === "danger"
    ? "bg-[#ef4444] text-white hover:bg-[#dc2626]"
    : "bg-[#146ef5] text-white hover:bg-[#0f5bd6]";

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#080808]/28 px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="volume-confirm-title"
        className="w-full max-w-[420px] rounded-2xl border border-[#dbe6f6] bg-white p-5 shadow-[0_24px_80px_rgba(20,110,245,0.16)]"
      >
        <div className="mb-3 inline-flex rounded-full bg-[#eef5ff] px-3 py-1 text-[10px] font-bold tracking-[1px] text-[#146ef5]">
          小提醒
        </div>
        <h2 id="volume-confirm-title" className="text-lg font-bold text-[#080808]">
          {dialog.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#5f6b7a]">
          {dialog.message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#d8d8d8] bg-white px-4 py-2 text-sm font-semibold text-[#5f6b7a] transition-colors hover:bg-[#f8fafc]"
          >
            {dialog.cancelLabel ?? "取消"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${confirmClassName}`}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InspectPanels() {
  const cubes = useCubeStore((s) => s.cubes);
  const viewYaw = useCubeStore((s) => s.viewYaw);
  const cubeArr = useMemo(() => Object.values(cubes), [cubes]);
  const projections = useMemo(() => projectColorViews(cubeArr, viewYaw), [cubeArr, viewYaw]);
  const colors = useMemo(() => colorCounts(cubeArr), [cubeArr]);
  const area = useMemo(() => computeSurfaceArea(cubeArr), [cubeArr]);
  const [explode, setExplode] = useState(0.2);

  const empty = cubeArr.length === 0;

  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-px bg-[#e5ecf5] [grid-template-rows:minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)]">
      {/* Top: Explode 3D view */}
      <div className="relative col-span-2 min-h-0 bg-white">
        <PanelHeader icon="💥" label="Explode View">
          <div className="flex items-center gap-2 text-[11px] text-[#6b7280]">
            <span>分離</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={explode}
              onChange={(e) => setExplode(parseFloat(e.target.value))}
              className="h-1 w-24 cursor-pointer accent-[#146ef5]"
            />
            <span className="w-7 text-right tabular-nums text-[#080808]">{explode.toFixed(2)}</span>
          </div>
        </PanelHeader>
        <div className="absolute left-2 top-9 z-10 rounded-md border border-[#d8d8d8] bg-white/95 px-2 py-1 text-[10px] leading-tight">
          <div className="text-base font-bold text-[#146ef5]">{area}</div>
          <div className="text-[#6b7280]">External Faces</div>
        </div>
        <div className="absolute inset-x-0 bottom-0 top-8">
          <VolumeScene explode={explode} showGround={false} interactive={false} />
        </div>
      </div>

      {/* Bottom-left: Front projection */}
      <ProjectionPanel
        icon="📐"
        label="Front"
        sublabel="前視圖"
        grid={projections.front}
        empty={empty}
      />

      {/* Bottom-right: Right projection */}
      <ProjectionPanel
        icon="📐"
        label="Right"
        sublabel="側視圖"
        grid={projections.right}
        empty={empty}
      />

      {/* Top projection */}
      <ProjectionPanel
        icon="📐"
        label="Top"
        sublabel="頂視圖"
        grid={projections.top}
        empty={empty}
      />

      {/* Material breakdown */}
      <div className="flex min-h-0 flex-col bg-white">
        <PanelHeader icon="🎨" label="Material" />
        <div className="flex-1 overflow-auto p-3">
          {empty ? (
            <p className="text-[12px] text-[#6b7280]">尚未放置任何方塊。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {colors.map(({ color, count }) => (
                <div
                  key={color}
                  className="flex items-center gap-2 rounded-md border border-[#d8d8d8] bg-[#f8fafc] px-2 py-1.5"
                >
                  <span
                    className="h-4 w-4 rounded-sm ring-1 ring-black/10"
                    style={{ background: color }}
                  />
                  <span className="text-[12px] font-semibold tabular-nums text-[#080808]">
                    × {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PanelHeader({
  icon, label, children,
}: { icon: string; label: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between border-b border-[#e5ecf5] bg-[#f3f6fb] px-3">
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#146ef5]">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ProjectionPanel({
  icon, label, sublabel, grid, empty,
}: {
  icon: string;
  label: string;
  sublabel: string;
  grid: (string | null)[][];
  empty: boolean;
}) {
  const cols = grid[0]?.length ?? 0;
  return (
    <div className="flex min-h-0 flex-col bg-white">
      <PanelHeader icon={icon} label={label}>
        <span className="text-[10px] uppercase tracking-[1px] text-[#6b7280]">{sublabel}</span>
      </PanelHeader>
      <div className="flex flex-1 items-center justify-center overflow-auto p-3">
        {empty || cols === 0 ? (
          <p className="text-[11px] text-[#ababab]">{label}</p>
        ) : (
          <div
            className="grid gap-[2px]"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 28px))`,
              gridAutoRows: "28px",
            }}
          >
            {grid.flatMap((row, ri) =>
              row.map((cell, ci) =>
                cell ? (
                  <div
                    key={`${ri}-${ci}`}
                    className="rounded-[3px] ring-1 ring-black/10"
                    style={{ background: cell }}
                  />
                ) : (
                  <div key={`${ri}-${ci}`} className="rounded-[3px] bg-transparent" />
                )
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
