type IconName =
  | "overview"
  | "memory"
  | "tasks"
  | "agents"
  | "activity"
  | "privacy"
  | "settings"
  | "scan"
  | "pin"
  | "check"
  | "search"
  | "plus"
  | "copy"
  | "conflict"
  | "sun"
  | "moon"
  | "spark"
  | "folder"
  | "live"
  | "key"
  | "export"
  | "logout"
  | "brain"
  | "stamp"
  | "split";

const PATHS: Record<IconName, string> = {
  overview:
    "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z",
  memory:
    "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 4h10M7 12h6",
  tasks:
    "M8 6h12M8 12h12M8 18h8M4 6h.01M4 12h.01M4 18h.01",
  agents:
    "M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.2 3.5-5 7-5s6.2 1.8 7 5",
  activity:
    "M4 12h3l2.5-6 3 12 2.5-6H20",
  privacy:
    "M12 3 5 6.5v5c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5v-5L12 3z",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6",
  scan: "M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 8h8v8H8z",
  pin: "M12 3v10M8 8h8M12 13l-4 8M12 13l4 8",
  check: "M5 12.5 9.5 17 19 7",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
  plus: "M12 5v14M5 12h14",
  copy: "M8 8h10v12H8zM6 16H5V4h11v1",
  conflict: "M12 3 4 18h16L12 3zM12 9v4M12 16h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M16 4.5A8.5 8.5 0 1 0 19.5 16 6.5 6.5 0 0 1 16 4.5z",
  spark: "M12 3v4M12 17v4M5 12H3M21 12h-2M7 7 5.5 5.5M18.5 18.5 17 17M7 17l-1.5 1.5M18.5 5.5 17 7",
  folder: "M3 7h6l2 2h10v10H3z",
  live: "M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0",
  key: "M8 14a4 4 0 1 0 3.6 2.2L20 8V5h-3l-1.5 1.5L14 5l-2.2 2.2",
  export: "M12 4v10M8 8l4-4 4 4M5 16v3h14v-3",
  logout: "M10 5H6v14h4M14 16l4-4-4-4M10 12h8",
  brain: "M8.5 7.5A3.5 3.5 0 0 1 15 6a3.2 3.2 0 0 1 4 3.1c1.4.4 2.5 1.7 2.5 3.4 0 1.4-.8 2.6-2 3.2V18a2 2 0 0 1-2 2h-3v-6M8.5 7.5A3.5 3.5 0 0 0 5 10.8C3.7 11.3 3 12.6 3 14.1c0 1.5.9 2.8 2.2 3.3V18a2 2 0 0 0 2 2h3v-6",
  stamp: "M7 14h10l1 6H6l1-6zM9 14V9a3 3 0 0 1 6 0v5",
  split: "M12 3v18M5 8l7 4 7-4M5 16l7-4 7 4",
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {name === "live" ? (
        <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      ) : (
        <path d={PATHS[name]} />
      )}
    </svg>
  );
}
