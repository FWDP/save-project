export function Icon({
  name,
  size = 20,
}: {
  name:
    | "overview"
    | "transactions"
    | "reports"
    | "workspace"
    | "plus"
    | "arrow"
    | "check"
    | "wallet";
  size?: number;
}) {
  const paths = {
    overview: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    transactions: (
      <>
        <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V4m0 16h17M9 16v-4m5 4V8m5 8V5" />
      </>
    ),
    workspace: (
      <>
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M9 7V3h6v4M8 11h1m6 0h1m-8 4h1m6 0h1" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    wallet: (
      <>
        <path d="M20 8V5H5a2 2 0 0 0 0 4h15v11H5a2 2 0 0 1-2-2V7" />
        <path d="M20 12h-5v5h5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol" aria-hidden>
        <svg viewBox="0 0 28 28" fill="none">
          <path
            d="M20 6H10a4 4 0 0 0 0 8h8a4 4 0 0 1 0 8H8"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path d="M18 3v6M10 19v6" stroke="currentColor" strokeWidth="2" />
        </svg>
      </span>
      SAVE<span className="brand-dot">.</span>
    </span>
  );
}
