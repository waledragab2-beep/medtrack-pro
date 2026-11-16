export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="120" fill="#0A0A0A" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#E10600" strokeWidth="30" strokeDasharray="700 300" strokeLinecap="round" transform="rotate(-90 256 256)" />
      <circle cx="256" cy="256" r="58" fill="#E10600" />
      <circle cx="256" cy="256" r="22" fill="#fff" />
    </svg>
  );
}

export function Logo({ light = false, size = 34 }: { light?: boolean; size?: number }) {
  return (
    <span className="logo" style={{ color: light ? '#fff' : 'var(--ink)' }} dir="ltr">
      <LogoMark size={size} />
      UYT
    </span>
  );
}
