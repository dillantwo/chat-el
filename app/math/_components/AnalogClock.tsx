import { forwardRef, type PointerEvent as ReactPointerEvent } from "react";

export type ClockHand = "hour" | "minute";

type AnalogClockProps = {
  hourAngle: number;
  minuteAngle: number;
  hourColor: string;
  minuteColor: string;
  hourLength?: number;
  minuteLength?: number;
  hourStrokeWidth?: number;
  minuteStrokeWidth?: number;
  hourDotRadius?: number;
  minuteDotRadius?: number;
  showOuter24Numbers?: boolean;
  angleArcPath?: string;
  angleArcVisible?: boolean;
  onPointerStart?: (
    hand: ClockHand,
    event: ReactPointerEvent<SVGCircleElement>,
  ) => void;
  className?: string;
};

const CENTER = 200;
const OUTER_RADIUS = 190;

function svgCoord(value: number) {
  return Number(value.toFixed(3));
}

export const AnalogClock = forwardRef<SVGSVGElement, AnalogClockProps>(function AnalogClock(
  {
    hourAngle,
    minuteAngle,
    hourColor,
    minuteColor,
    hourLength = 80,
    minuteLength = 130,
    hourStrokeWidth = 10,
    minuteStrokeWidth = 6,
    hourDotRadius = 18,
    minuteDotRadius = 15,
    showOuter24Numbers = false,
    angleArcPath,
    angleArcVisible = false,
    onPointerStart,
    className,
  },
  ref,
) {
  return (
    <svg
      ref={ref}
      viewBox="-40 -40 480 480"
      className={className}
      style={{ touchAction: "none" }}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={OUTER_RADIUS}
        fill="none"
        stroke="#333"
        strokeWidth="3"
      />

      {Array.from({ length: 60 }, (_, index) => {
        const angle = (index * 6 * Math.PI) / 180;
        const isHourTick = index % 5 === 0;
        const innerRadius = isHourTick ? 175 : 182;
        return (
          <line
            key={`tick-${index}`}
            x1={svgCoord(CENTER + innerRadius * Math.sin(angle))}
            y1={svgCoord(CENTER - innerRadius * Math.cos(angle))}
            x2={svgCoord(CENTER + OUTER_RADIUS * Math.sin(angle))}
            y2={svgCoord(CENTER - OUTER_RADIUS * Math.cos(angle))}
            stroke={isHourTick ? "#333" : "#ccc"}
            strokeWidth={isHourTick ? 3 : 1.5}
          />
        );
      })}

      {Array.from({ length: 12 }, (_, index) => {
        const value12 = index === 0 ? 12 : index;
        const angle = (value12 * 30 * Math.PI) / 180;
        const x12 = svgCoord(CENTER + 145 * Math.sin(angle));
        const y12 = svgCoord(CENTER - 145 * Math.cos(angle));
        const value24 = value12 === 12 ? 24 : value12 + 12;
        const x24 = svgCoord(CENTER + 215 * Math.sin(angle));
        const y24 = svgCoord(CENTER - 215 * Math.cos(angle));

        return (
          <g key={`num-${value12}`}>
            <text
              x={x12}
              y={y12}
              fill="#333"
              fontSize="22"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {value12}
            </text>
            {showOuter24Numbers ? (
              <text
                x={x24}
                y={y24}
                fill="#888"
                fontSize="18"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {value24}
              </text>
            ) : null}
          </g>
        );
      })}

      {angleArcPath ? (
        <path
          d={angleArcPath}
          fill="rgba(255, 165, 0, 0.4)"
          style={{ opacity: angleArcVisible ? 1 : 0, transition: "opacity 0.3s" }}
        />
      ) : null}

      <line
        x1={CENTER}
        y1={CENTER}
        x2={CENTER}
        y2={CENTER - hourLength}
        stroke={hourColor}
        strokeWidth={hourStrokeWidth}
        strokeLinecap="round"
        transform={`rotate(${hourAngle} ${CENTER} ${CENTER})`}
      />
      <line
        x1={CENTER}
        y1={CENTER}
        x2={CENTER}
        y2={CENTER - minuteLength}
        stroke={minuteColor}
        strokeWidth={minuteStrokeWidth}
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} ${CENTER} ${CENTER})`}
      />

      <circle
        cx={CENTER}
        cy={CENTER - hourLength}
        r={hourDotRadius}
        fill={hourColor}
        style={{ cursor: "grab" }}
        transform={`rotate(${hourAngle} ${CENTER} ${CENTER})`}
        onPointerDown={(event) => onPointerStart?.("hour", event)}
      />
      <circle
        cx={CENTER}
        cy={CENTER - minuteLength}
        r={minuteDotRadius}
        fill={minuteColor}
        style={{ cursor: "grab" }}
        transform={`rotate(${minuteAngle} ${CENTER} ${CENTER})`}
        onPointerDown={(event) => onPointerStart?.("minute", event)}
      />

      <circle cx={CENTER} cy={CENTER} r="8" fill="#333" />
    </svg>
  );
});