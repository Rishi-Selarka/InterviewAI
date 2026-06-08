'use client';

// Interviewer-only, headless. Persists the candidate's look-away count to the DB
// periodically and on page-hide, so the final number survives even if the tab is
// closed without a clean end. The actual end + recording + transcript flow now
// lives in the top-bar "End interview" action (see RoomLayout).

import { useEffect, useRef } from 'react';
import { useCandidateProctoring } from './useCandidateProctoring';

const PERSIST_INTERVAL_MS = 15000;

export default function InterviewerControls({ interviewId }: { interviewId: string }) {
  const { lookAwayCount } = useCandidateProctoring();

  const countRef = useRef(0);
  useEffect(() => {
    countRef.current = lookAwayCount;
  }, [lookAwayCount]);

  // Periodically persist the look-away count.
  useEffect(() => {
    const id = window.setInterval(() => {
      fetch('/api/proctoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, lookAwayCount: countRef.current }),
        keepalive: true,
      }).catch(() => {});
    }, PERSIST_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [interviewId]);

  // Persist once more when the page is hidden/closed.
  useEffect(() => {
    const flush = () => {
      const payload = JSON.stringify({ interviewId, lookAwayCount: countRef.current });
      navigator.sendBeacon?.('/api/proctoring', new Blob([payload], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [interviewId]);

  return null;
}
