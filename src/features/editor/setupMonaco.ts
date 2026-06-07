'use client';

// Self-host Monaco from the locally-bundled `monaco-editor` package instead of
// fetching it from a CDN (cdn.jsdelivr.net) at runtime. The CDN can be blocked by
// browser extensions (ad/privacy blockers), corporate networks, or offline use,
// which leaves the editor blank. Loading Monaco from our own bundle makes the
// editor render reliably everywhere.
//
// This module has side effects on import and touches `window`/`self`, so it MUST
// only be imported from client-only code (components rendered with
// `dynamic(..., { ssr: false })`), never from a server-rendered module.

import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Wire Monaco's web workers via Turbopack-compatible `new URL(...)`. Workers power
// language intelligence (diagnostics / IntelliSense); syntax highlighting still
// works even if a worker fails to load, so this is best-effort.
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
        { type: 'module' },
      );
    }
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

// Point @monaco-editor/react at our bundled instance (skips the CDN entirely).
loader.config({ monaco });
