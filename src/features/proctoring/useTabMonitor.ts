'use client';

// useTabMonitor — detects when the candidate leaves the interview tab or window.
//
// Listens to two independent browser signals:
//   • document 'visibilitychange' — catches minimising, switching to another tab
//     in the same window, or an OS app covering the browser.
//   • window 'blur' / 'focus' — catches alt-tab, new-window opens, and cases
//     where the browser hides the tab without firing visibilitychange first.
//
// A single "tab switch" is counted ONCE per transition into hidden/blurred. A
// debounce guard (SWITCH_DEBOUNCE_MS) collapses rapid re-fires (e.g. some
// browsers fire both visibilitychange AND blur within microseconds for the same
// event, or the system fires blur/focus pairs during a screen-lock) so that one
// user action maps to exactly one increment.
//
// The hook only tracks mutable state via refs; the caller supplies an `onUpdate`
// callback that is invoked synchronously on every meaningful change. This keeps
// the hook side-effect-free and easy to unit-test.

import { useEffect, useRef } from 'react';

const SWITCH_DEBOUNCE_MS = 300;

export interface TabMonitorState {
  tabHidden: boolean;
  tabSwitchCount: number;
}

type OnUpdate = (state: TabMonitorState) => void;

/**
 * Attach tab/window-focus listeners and call `onUpdate` whenever the candidate
 * leaves or returns to the interview tab.
 *
 * The caller is responsible for initialising the mutable counter; this hook
 * only increments it and forwards the new value.
 */
export function useTabMonitor(onUpdate: OnUpdate): void {
  // Keep a ref to the latest callback so listeners don't go stale. Update it in
  // an effect (not during render) so we never write a ref while rendering.
  const onUpdateRef = useRef<OnUpdate>(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  // Mutable state in refs so the event listeners share a single copy without
  // React re-render churn.
  const tabHiddenRef = useRef(false);
  const tabSwitchCountRef = useRef(0);
  const lastSwitchRef = useRef<number>(0); // ms timestamp of last increment

  useEffect(() => {
    // Helper: push the current state to the caller.
    const emit = () => {
      onUpdateRef.current({
        tabHidden: tabHiddenRef.current,
        tabSwitchCount: tabSwitchCountRef.current,
      });
    };

    // Helper: register a "left the tab" event. Debounced so that a single user
    // action which triggers both visibilitychange AND blur only counts once.
    const registerLeave = () => {
      const now = performance.now();
      const isNewSwitch = now - lastSwitchRef.current > SWITCH_DEBOUNCE_MS;

      if (!tabHiddenRef.current || isNewSwitch) {
        // Only increment when we're actually transitioning TO hidden, or when
        // enough time has passed that this is a genuinely new leave event.
        if (isNewSwitch) {
          tabSwitchCountRef.current += 1;
          lastSwitchRef.current = now;
        }
        tabHiddenRef.current = true;
        emit();
      }
    };

    // Helper: register a "returned to tab" event.
    const registerReturn = () => {
      if (tabHiddenRef.current) {
        tabHiddenRef.current = false;
        emit();
      }
    };

    // Signal 1: Page Visibility API.
    const onVisibilityChange = () => {
      if (document.hidden) {
        registerLeave();
      } else {
        registerReturn();
      }
    };

    // Signal 2: Window focus / blur (catches alt-tab, new-window, etc.).
    const onBlur = () => registerLeave();
    const onFocus = () => registerReturn();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    // If the page is already hidden when the hook mounts (unusual, but possible
    // if the tab was opened in background), mark it immediately.
    if (document.hidden) {
      registerLeave();
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
}
