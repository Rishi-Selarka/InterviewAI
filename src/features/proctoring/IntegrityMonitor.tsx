'use client';

// Interviewer-only compact live "integrity" readout, driven by the candidate's
// broadcast proctoring state. Non-punitive: it's a signal, never a verdict.

import { useCandidateProctoring } from './useCandidateProctoring';

export default function IntegrityMonitor() {
  const p = useCandidateProctoring();

  const flags = [
    p.tabHidden && { label: 'Switched tab / window', tone: 'rose' as const },
    p.multipleFaces && { label: 'Multiple faces in frame', tone: 'rose' as const },
    p.noFace && { label: 'No face visible', tone: 'amber' as const },
    p.lookingAway && { label: 'Looking away', tone: 'amber' as const },
  ].filter(Boolean) as { label: string; tone: 'rose' | 'amber' }[];

  const clean = flags.length === 0;

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Integrity monitor
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            clean ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${clean ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {clean ? 'Focused' : 'Anomaly'}
        </span>
      </div>

      {flags.length > 0 && (
        <ul className="mb-2 space-y-1">
          {flags.map((f) => (
            <li
              key={f.label}
              className={`flex items-center gap-2 text-xs ${
                f.tone === 'rose' ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${f.tone === 'rose' ? 'bg-rose-400' : 'bg-amber-400'}`} />
              {f.label}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-4 text-[11px] text-faint">
        <span>Tab switches: <span className="text-zinc-300">{p.tabSwitchCount}</span></span>
        <span>Look-aways: <span className="text-zinc-300">{p.lookAwayCount}</span></span>
      </div>
    </div>
  );
}
