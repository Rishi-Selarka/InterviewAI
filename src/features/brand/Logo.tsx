// The IntelliInterview brand mark + wordmark, used across the app. The mark is a
// violet gradient badge with a stylized terminal/brackets glyph.

import Link from 'next/link';

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl bg-brand text-onbrand ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2">
        <path
          d="M5 8l3.5 4L5 16"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M12.5 16.5H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-tight ${className}`}>
      <span className="text-strong">Intelli</span>
      <span className="brand-gradient-text">Interview</span>
    </span>
  );
}

export default function Logo({
  href = '/',
  markClassName,
  textClassName = 'text-lg',
}: {
  href?: string | null;
  markClassName?: string;
  textClassName?: string;
}) {
  const inner = (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark className={markClassName} />
      <Wordmark className={textClassName} />
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
