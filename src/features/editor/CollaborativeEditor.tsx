'use client';

// The shared Monaco editor, kept in sync between both participants via
// Liveblocks' Yjs provider (current official integration) bound to Monaco with
// y-monaco. Remote cursors/selections render automatically via Yjs awareness.

import { useEffect, useRef, type RefObject } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import type { Awareness } from 'y-protocols/awareness';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { useRoom } from '@liveblocks/react';
import type { Role, SupportedLanguage } from '@/src/features/room/liveblocks.config';
import type { EditorApi } from './editorApi';

// A stable per-participant cursor colour, derived from the name so each person
// keeps the same colour without a server round-trip.
function colorFromName(name: string): string {
  const palette = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#0891b2'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

interface Props {
  language: SupportedLanguage;
  role: Role;
  name: string;
  /** Filled in once the editor mounts, so other panels can read/write code. */
  apiRef: RefObject<EditorApi | null>;
  /** Starter code seeded into an empty room (interviewer only). */
  initialCode: string;
}

export default function CollaborativeEditor({
  language,
  role,
  name,
  apiRef,
  initialCode,
}: Props) {
  // The Liveblocks room is stable for the provider's lifetime, so the onMount
  // closure can capture it directly.
  const room = useRoom();

  // Keep the binding so we can tear it down on unmount.
  const bindingRef = useRef<MonacoBinding | null>(null);

  const handleMount: OnMount = (editor) => {
    const model = editor.getModel();
    if (!model) return;

    // One Yjs document per room; the editor text lives under the "monaco" key.
    const yProvider = getYjsProviderForRoom(room);
    const yDoc = yProvider.getYDoc();
    const yText = yDoc.getText('monaco');

    // Bind Monaco <-> Yjs. Passing awareness enables live remote cursors.
    // The cast bridges two structurally-identical `Awareness` types that come
    // from different y-protocols copies (Liveblocks' vs y-monaco's); they are the
    // same object at runtime.
    bindingRef.current = new MonacoBinding(
      yText,
      model,
      new Set([editor]),
      yProvider.awareness as unknown as Awareness,
    );

    // Identify this cursor to the other participant.
    yProvider.awareness.setLocalStateField('user', {
      name,
      color: colorFromName(name),
    });

    // Expose an imperative API for the Run button and Problem panel.
    apiRef.current = {
      getCode: () => yText.toString(),
      loadCode: (code: string) => {
        // Replace the whole shared doc in one transaction; propagates to peers.
        Y.transact(yDoc, () => {
          yText.delete(0, yText.length);
          if (code) yText.insert(0, code);
        });
      },
    };

    // Seed starter code into a brand-new (empty) room. Only the interviewer seeds
    // so two clients can't race and double-insert the same text.
    const seedIfEmpty = () => {
      if (role === 'interviewer' && yText.length === 0 && initialCode) {
        yText.insert(0, initialCode);
      }
    };
    if (yProvider.synced) seedIfEmpty();
    else yProvider.once('synced', seedIfEmpty);
  };

  // Tear down the Yjs<->Monaco binding when the editor unmounts.
  useEffect(() => {
    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, []);

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      onMount={handleMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  );
}
