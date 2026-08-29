import type { SVGProps } from "react";
import { useId } from "react";

type Mood = "idle" | "think" | "alert" | "wave";

export function Memo({
  mood = "idle",
  size = 96,
  title = "Memo",
  className,
  ...props
}: SVGProps<SVGSVGElement> & { mood?: Mood; size?: number; title?: string }) {
  const skin = `m${useId().replace(/:/g, "")}`;
  const mouth =
    mood === "alert"
      ? "M20 34.2c3.2-2.4 8.8-2.4 12 0"
      : mood === "wave"
        ? "M20 32.6c3.6 3.2 8.8 3.2 12.4 0"
        : "M22 33.4h8";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={["memo", `memo-${mood}`, className].filter(Boolean).join(" ")}
      {...props}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={skin} x1="12" y1="8" x2="40" y2="44">
          <stop offset="0%" stopColor="var(--memo-hi)" />
          <stop offset="100%" stopColor="var(--memo-lo)" />
        </linearGradient>
      </defs>
      <path
        className="memo-clip"
        d="M25.2 3.2c0-1.4 1.1-2.5 2.6-2.5 1.8 0 2.8 1.2 2.8 2.9v7.2"
        fill="none"
        stroke="var(--ion)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M27.8 1.2c1.1 0 1.7.7 1.7 1.6v2.2"
        fill="none"
        stroke="var(--ion)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="8" y="9.5" width="32" height="34" rx="11" fill={`url(#${skin})`} />
      <path d="M32.4 9.5h7.6v7.8L32.4 9.5z" fill="var(--filament)" />
      <circle className="memo-eye" cx="18.2" cy="25.2" r="2.15" fill="var(--void)" />
      <circle className="memo-eye" cx="29.6" cy="25.2" r="2.15" fill="var(--void)" />
      <circle cx="18.9" cy="24.5" r="0.55" fill="var(--memo-hi)" />
      <circle cx="30.3" cy="24.5" r="0.55" fill="var(--memo-hi)" />
      {mood === "think" ? (
        <g className="memo-thought">
          <circle cx="39.2" cy="16.2" r="1.35" fill="var(--ion)" />
          <circle cx="42.4" cy="12.4" r="0.9" fill="var(--filament)" />
        </g>
      ) : null}
      {mood === "alert" ? (
        <circle cx="24" cy="14.4" r="1.5" fill="var(--filament)" />
      ) : null}
      <path d={mouth} fill="none" stroke="var(--void)" strokeWidth="1.7" strokeLinecap="round" />
      <ellipse cx="16.4" cy="29.6" rx="2.1" ry="1.15" fill="var(--filament)" opacity="0.28" />
      <ellipse cx="31.4" cy="29.6" rx="2.1" ry="1.15" fill="var(--filament)" opacity="0.28" />
    </svg>
  );
}
