'use client';

// Solo coding pad. The editor self-hosts Monaco (no CDN), which touches browser
// globals at import time, so we load the whole pad client-only (ssr: false).

import dynamic from 'next/dynamic';

const CodingPad = dynamic(() => import('./CodingPad'), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-muted">
      Loading coding pad…
    </div>
  ),
});

export default function InterviewPage() {
  return <CodingPad />;
}
