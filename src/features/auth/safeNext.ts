// Sanitise a `?next=` redirect target so it can only ever point at an internal
// path. This prevents an open-redirect (e.g. ?next=https://evil.com) being used
// for phishing after login/signup.

export function safeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  // Must be a root-relative path ("/foo"). Reject protocol-relative ("//evil.com")
  // and absolute URLs ("https://…", "javascript:…").
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
