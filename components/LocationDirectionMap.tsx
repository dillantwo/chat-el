"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { basePath } from "@/lib/utils";

/**
 * Interactive "Location and Direction" map.
 *
 * This is the TypeScript/React port of the old
 * `public/english/preview-location-direction.html` iframe. A sprite is moved
 * around a map image with the arrow keys or the on-screen touch controls.
 *
 * The touch controls sit at the bottom centre of the stage and the map is sized
 * to the space above them, so nothing overlaps or gets clipped.
 */

type Direction = "up" | "down" | "left" | "right";

const FACING: Record<Direction, string> = {
  up: `${basePath}/english/facingNorth.png`,
  down: `${basePath}/english/facingSouth.png`,
  left: `${basePath}/english/facingWest.png`,
  right: `${basePath}/english/facingEast.png`,
};

// Each task has its own map image.
const DEFAULT_MAP_SRC = `${basePath}/english/map org.png`;
const MAP_SRC_BY_TASK: Record<number, string> = {
  1: `${basePath}/english/task 1 map.png`,
  2: `${basePath}/english/task 2 map.png`,
  3: `${basePath}/english/task 3 map.png`,
  4: `${basePath}/english/task 4 map.png`,
};

function mapSrcFor(task: number | null) {
  return (task != null && MAP_SRC_BY_TASK[task]) || DEFAULT_MAP_SRC;
}

// Where the sprite starts for each task, as a percentage of the map image,
// plus the direction it initially faces (see START_BY_TASK below).
const DEFAULT_START: { x: number; y: number; facing: Direction } = { x: 50, y: 50, facing: "up" };
const START_BY_TASK: Record<number, { x: number; y: number; facing: Direction }> = {
  // Task 1 starts inside the book shop box (West Street, east side, middle row),
  // facing the street; the student walks south to the train station.
  1: { x: 40, y: 63, facing: "left" },
  // Task 2 starts inside the post office box (bottom-left) facing east.
  2: { x: 15, y: 86, facing: "right" },
  // Task 3 starts inside the church box (West Street, west side, middle-north)
  // facing the street; the student crosses to North Street to reach the bank.
  3: { x: 15, y: 50, facing: "right" },
  // Task 4 starts inside the fire station box (North Street, north side, east
  // end) facing the street; the student walks west along North Street, crosses
  // over, comes back east and goes down East Street to the clinic.
  4: { x: 87, y: 13, facing: "down" },
};

function startFor(task: number | null) {
  return (task != null && START_BY_TASK[task]) || DEFAULT_START;
}

// Stage layout: the map fills the space up top, the control pad sits at the
// bottom centre.
const STAGE_PADDING = 12;
const STAGE_GAP = 12;
const MAP_MAX_WIDTH = 900;
/** Used until the map image reports its real dimensions. */
const DEFAULT_MAP_RATIO = 3 / 2;
/** Width of the control pad under the map. */
const CONTROLS_WIDTH = 190;
/** Lifts the control pad off the bottom edge of the stage. */
const CONTROLS_BOTTOM_OFFSET = 40;

type LocationDirectionMapProps = {
  /** The active task id, or null when no task is selected yet. */
  task: number | null;
  /**
   * Task 5 only: the data URL of the map the student uploaded. When set, it is
   * used as the map image instead of a built-in map so the sprite/controls are
   * composed on top of the student's own drawing.
   */
  customMapSrc?: string | null;
  /**
   * Task 5 only: called with the file the student picked in the upload area so
   * the parent can turn it into the map and forward it to the chatbot.
   */
  onUploadMap?: (file: File) => void;
};

export default function LocationDirectionMap({
  task,
  customMapSrc,
  onUploadMap,
}: LocationDirectionMapProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLImageElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);

  // Task 5 shows the student's own uploaded map. Before they upload one we show
  // an upload dropzone instead of a built-in map.
  const isTask5 = task === 5;
  const resolvedMapSrc = isTask5 ? customMapSrc ?? null : mapSrcFor(task);

  const handlePickFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onUploadMap) onUploadMap(file);
      // Allow re-selecting the same file later.
      event.target.value = "";
    },
    [onUploadMap],
  );

  // Sprite position as a percentage of the map (matches the original 5%..95%).
  const [spriteX, setSpriteX] = useState(() => startFor(task).x);
  const [spriteY, setSpriteY] = useState(() => startFor(task).y);
  const [facing, setFacing] = useState<Direction>(() => startFor(task).facing);

  // Reset the sprite to the task's starting box whenever the task changes.
  useEffect(() => {
    const start = startFor(task);
    setSpriteX(start.x);
    setSpriteY(start.y);
    setFacing(start.facing);
  }, [task]);

  // The map is laid out at an explicit pixel size we compute ourselves so it
  // always fits the space left over by the controls underneath it. Keeping the
  // wrapper exactly the size of the image is what keeps the percentage-based
  // sprite position aligned with the map.
  const [mapBox, setMapBox] = useState<{ width: number; height: number } | null>(null);

  const move = useCallback((direction: Direction) => {
    setFacing(direction);
    switch (direction) {
      case "up":
        setSpriteY((y) => Math.max(5, y - 5));
        break;
      case "down":
        setSpriteY((y) => Math.min(95, y + 5));
        break;
      case "left":
        setSpriteX((x) => Math.max(5, x - 5));
        break;
      case "right":
        setSpriteX((x) => Math.min(95, x + 5));
        break;
    }
  }, []);

  // Fit the map into the stage minus whatever the rows above/below it take up
  // (the control pad, and on Task 5 the "Change map" button).
  const updateSizes = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const availableWidth = stage.clientWidth - STAGE_PADDING * 2;
    const topBarHeight = topBarRef.current?.offsetHeight ?? 0;
    const rowsHeight = (controlsRef.current?.offsetHeight ?? 0) + topBarHeight;
    // One gap between the map and the controls, plus another above the map when
    // the Task 5 "Change map" row is present.
    const gaps = STAGE_GAP * (topBarHeight ? 2 : 1);
    const availableHeight =
      stage.clientHeight -
      STAGE_PADDING * 2 -
      rowsHeight -
      gaps -
      CONTROLS_BOTTOM_OFFSET;
    if (availableWidth <= 0 || availableHeight <= 0) return;

    const img = mapRef.current;
    const ratio =
      img && img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : DEFAULT_MAP_RATIO;

    let width = Math.min(availableWidth, MAP_MAX_WIDTH);
    let height = width / ratio;
    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }
    setMapBox((previous) =>
      previous && Math.abs(previous.width - width) < 0.5 && Math.abs(previous.height - height) < 0.5
        ? previous
        : { width, height },
    );
  }, []);

  useLayoutEffect(() => {
    updateSizes();
  }, [updateSizes, task, resolvedMapSrc]);

  // A ResizeObserver (not just window resize) so toggling the chat panel or
  // dragging the split also re-fits the map.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateSizes());
    observer.observe(stage);
    return () => observer.disconnect();
  }, [updateSizes]);

  useEffect(() => {
    window.addEventListener("resize", updateSizes);
    return () => window.removeEventListener("resize", updateSizes);
  }, [updateSizes]);

  const spriteWidth = (mapBox?.width ?? 0) / 22;

  // Keyboard controls, scoped to the stage so it doesn't hijack the page.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const direction = map[event.key];
      if (direction) {
        event.preventDefault();
        move(direction);
      }
    },
    [move],
  );

  // A 3-column grid pinned to the bottom centre of the stage. Its width is
  // capped so the pad keeps its shape no matter how wide the map gets.
  const controls = (
    <div
      ref={controlsRef}
      style={{
        flex: "0 0 auto",
        width: "100%",
        maxWidth: CONTROLS_WIDTH,
        marginBottom: CONTROLS_BOTTOM_OFFSET,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "10%",
        alignItems: "center",
        justifyItems: "center",
      }}
    >
      <ControlButton label="↑" onPress={() => move("up")} style={{ gridColumn: 2, gridRow: 1 }} />
      <ControlButton label="←" onPress={() => move("left")} style={{ gridColumn: 1, gridRow: 2 }} />
      <ControlButton label="↓" onPress={() => move("down")} style={{ gridColumn: 2, gridRow: 2 }} />
      <ControlButton label="→" onPress={() => move("right")} style={{ gridColumn: 3, gridRow: 2 }} />
    </div>
  );

  return (
    <div
      ref={stageRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={() => stageRef.current?.focus()}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: STAGE_GAP,
        padding: STAGE_PADDING,
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        backgroundColor: "#f0f0f0",
        userSelect: "none",
        outline: "none",
      }}
    >
      {/* Hidden input reused by both the empty dropzone and the "change" button. */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        onChange={handlePickFile}
        style={{ display: "none" }}
      />

      {isTask5 && !resolvedMapSrc ? (
        // Task 5, no map yet: prompt the student to upload their own map image.
        <button
          type="button"
          onClick={() => uploadInputRef.current?.click()}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            width: "72%",
            maxWidth: 640,
            aspectRatio: "3 / 2",
            padding: 24,
            border: "3px dashed #9cc3f5",
            borderRadius: 16,
            backgroundColor: "#f5f9ff",
            color: "#2f6fd0",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span style={{ fontSize: "clamp(15px, 1.6vw, 20px)", fontWeight: 700 }}>
            Upload your own map
          </span>
          <span style={{ fontSize: "clamp(12px, 1.2vw, 15px)", fontWeight: 500, opacity: 0.8 }}>
            Click here to upload the picture.
          </span>
        </button>
      ) : (
        <>
          {/* The map takes all the leftover space and is centred in it, which
              leaves the control pad pinned to the bottom centre of the stage. */}
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: STAGE_GAP,
              width: "100%",
            }}
          >
            {/* Task 5 re-upload sits ABOVE the map, outside the image, so it
                never covers part of the student's own drawing. */}
            {isTask5 && (
              <div
                ref={topBarRef}
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  justifyContent: "flex-end",
                  width: mapBox ? mapBox.width : "100%",
                }}
              >
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  style={{
                    padding: "6px 12px",
                    fontSize: "clamp(11px, 1.1vw, 14px)",
                    fontWeight: 600,
                    color: "#2f6fd0",
                    backgroundColor: "#ffffff",
                    border: "1px solid #9cc3f5",
                    borderRadius: 8,
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  Change map
                </button>
              </div>
            )}

            <div
              style={{
                position: "relative",
                flex: "0 0 auto",
                width: mapBox?.width ?? "100%",
                height: mapBox?.height,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={mapRef}
                src={resolvedMapSrc ?? mapSrcFor(task)}
                alt={isTask5 ? "Your uploaded map" : "Map of a specific location"}
                onLoad={updateSizes}
                style={{ width: "100%", height: "100%", display: "block" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: `${spriteY}%`,
                  left: `${spriteX}%`,
                  transform: "translate(-50%, -50%)",
                  width: spriteWidth,
                  height: spriteWidth * 2,
                  backgroundImage: `url('${FACING[facing]}')`,
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  zIndex: 10,
                }}
              />
            </div>
          </div>

          {controls}
        </>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      onTouchStart={(e) => {
        e.preventDefault();
        onPress();
      }}
      style={{
        // Fill the grid cell and stay square; this makes the size adapt to the
        // side column (and therefore the screen) without ever overflowing.
        width: "100%",
        aspectRatio: "1 / 1",
        // Clamp keeps the glyph readable on small screens and big on iPad.
        fontSize: "clamp(14px, 1.8vw, 26px)",
        backgroundColor: "rgba(76, 175, 80, 0.9)",
        border: "2px solid rgba(255, 255, 255, 0.8)",
        borderRadius: 8,
        color: "white",
        fontWeight: "bold",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
