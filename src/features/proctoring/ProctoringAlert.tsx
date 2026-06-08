'use client';

// Interviewer-only PROMINENT integrity alert. Unlike the small IntegrityMonitor
// readout, this is a loud, can't-miss banner that slides in whenever the
// candidate triggers an anomaly (or disconnects), so cheating signals are
// impossible to overlook. Still non-punitive — it informs, never blocks.

import { useCandidateStatus } from './useCandidateProctoring';

type Severity = 'high' | 'medium' | 'info';

interface Flag {
  icon: string;
  title: string;
  detail: string;
  severity: Severity;
}

export default function ProctoringAlert() {
  const { connected, name, proctoring: p } = useCandidateStatus();
  const who = name || 'The candidate';

  const flags: Flag[] = [];

  if (!connected) {
    flags.push({
      icon: '🔌',
      title: 'Candidate not in the room',
      detail: `${who} is not currently connected (left or hasn't joined yet).`,
      severity: 'info',
    });
  } else {
    if (p.tabHidden) {
      flags.push({
        icon: '🚩',
        title: 'Left the interview tab',
        detail: `${who} switched to another tab or window (${p.tabSwitchCount} time${p.tabSwitchCount === 1 ? '' : 's'} total).`,
        severity: 'high',
      });
    }
    if (p.multipleFaces) {
      flags.push({
        icon: '🚩',
        title: 'Multiple faces detected',
        detail: 'More than one person is visible in the candidate’s camera.',
        severity: 'high',
      });
    }
    if (p.noFace) {
      flags.push({
        icon: '⚠️',
        title: 'No face visible',
        detail: 'The candidate’s camera is on but no face is detected.',
        severity: 'medium',
      });
    }
    if (p.lookingAway) {
      flags.push({
        icon: '👀',
        title: 'Looking away',
        detail: 'The candidate appears to be looking away from the screen.',
        severity: 'medium',
      });
    }
  }

  if (flags.length === 0) return null;

  // Pick the loudest severity present to colour the whole banner.
  const top: Severity = flags.some((f) => f.severity === 'high')
    ? 'high'
    : flags.some((f) => f.severity === 'medium')
      ? 'medium'
      : 'info';

  const tone =
    top === 'high'
      ? 'border-rose-500/60 bg-rose-500/15 text-rose-100'
      : top === 'medium'
        ? 'border-amber-500/60 bg-amber-500/15 text-amber-100'
        : 'border-zinc-500/50 bg-zinc-500/15 text-zinc-200';

  const dot =
    top === 'high' ? 'bg-rose-400' : top === 'medium' ? 'bg-amber-400' : 'bg-zinc-400';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 border-b px-4 py-2.5 ${tone}`}
    >
      <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
        {top !== 'info' && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dot}`} />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold uppercase tracking-wide">
            {top === 'high' ? 'Integrity alert' : top === 'medium' ? 'Attention' : 'Candidate status'}
          </span>
          {flags.length > 1 && (
            <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold">
              {flags.length} active
            </span>
          )}
        </div>
        <ul className="mt-1 space-y-0.5">
          {flags.map((f) => (
            <li key={f.title} className="text-xs leading-snug">
              <span className="mr-1">{f.icon}</span>
              <span className="font-semibold">{f.title}.</span>{' '}
              <span className="opacity-90">{f.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
