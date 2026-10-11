// The Faden logo from the design: a thread (lime) between two points.
// Decoration only: the link or heading around it carries the text.
export function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden className="shrink-0">
      <rect width="36" height="36" rx="11" fill="#111315" />
      <path
        d="M9.5 25.5C9.5 15 26.5 21 26.5 10.5"
        fill="none"
        stroke="var(--highlight)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="25.5" r="3.2" fill="#ffffff" />
      <circle cx="26.5" cy="10.5" r="3.2" fill="#ffffff" />
      <circle cx="18" cy="18" r="2" fill="var(--highlight)" />
    </svg>
  );
}
