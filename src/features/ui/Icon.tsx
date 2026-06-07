// One small, consistent line-icon set (stroke = currentColor) so the whole app
// uses proper icons instead of a mix of unicode glyphs and emoji.

import type { JSX } from 'react';

export type IconName =
  | 'dashboard'
  | 'user'
  | 'users'
  | 'code'
  | 'report'
  | 'briefcase'
  | 'live'
  | 'check'
  | 'shield'
  | 'bolt'
  | 'chart'
  | 'calendar'
  | 'gauge'
  | 'sparkle';

const PATHS: Record<IconName, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
      <path d="M16 5.3a3 3 0 010 5.4" />
      <path d="M18.5 19.5c0-2.2-1-3.8-2.7-4.5" />
    </>
  ),
  code: (
    <>
      <path d="M8.5 8.5L5 12l3.5 3.5" />
      <path d="M15.5 8.5L19 12l-3.5 3.5" />
      <path d="M13 6l-2 12" />
    </>
  ),
  report: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5.5A2.5 2.5 0 0110.5 3h3A2.5 2.5 0 0116 5.5V7" />
      <path d="M3 12h18" />
    </>
  ),
  live: (
    <>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M6.5 6.5a8 8 0 000 11" />
      <path d="M17.5 6.5a8 8 0 010 11" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.8 2.8L16 9" />
    </>
  ),
  shield: <path d="M12 3l7 3v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3z" />,
  bolt: <path d="M13 3L5.5 13H11l-1 8 8.5-11H13l1-7z" />,
  chart: (
    <>
      <path d="M3 21h18" />
      <rect x="5" y="11" width="3.2" height="7" rx="0.8" />
      <rect x="10.4" y="6" width="3.2" height="12" rx="0.8" />
      <rect x="15.8" y="14" width="3.2" height="4" rx="0.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 13a8 8 0 0116 0" />
      <path d="M12 13l3.5-2.5" />
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  sparkle: <path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3z" />,
};

export default function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}
