'use client';

// ProfileForm — lets the authenticated user update their public profile fields.
// Role is intentionally excluded; it is managed separately by admins.

import { useState } from 'react';
import { createClient } from '@/src/features/auth/supabase/client';
import type { Profile } from '@/src/features/auth/profile';

interface Props {
  initial: Profile;
  email: string | null;
}

export default function ProfileForm({ initial, email }: Props) {
  const [full_name, setFullName] = useState(initial.full_name ?? '');
  const [username, setUsername] = useState(initial.username ?? '');
  const [headline, setHeadline] = useState(initial.headline ?? '');
  const [bio, setBio] = useState(initial.bio ?? '');
  const [linkedin_url, setLinkedinUrl] = useState(initial.linkedin_url ?? '');
  const [github_url, setGithubUrl] = useState(initial.github_url ?? '');
  const [website_url, setWebsiteUrl] = useState(initial.website_url ?? '');
  const [avatar_url, setAvatarUrl] = useState(initial.avatar_url ?? '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert(
      {
        id: initial.id,
        full_name,
        username,
        headline,
        bio,
        linkedin_url,
        github_url,
        website_url,
        avatar_url,
      },
      { onConflict: 'id' },
    );

    setSaving(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setSaved(true);
      // Auto-clear the success message after 3 s.
      setTimeout(() => setSaved(false), 3000);
    }
  }

  return (
    <form onSubmit={handleSave} className="card p-6">
      <h2 className="mb-5 text-base font-semibold text-strong">Edit profile</h2>

      {/* Full name + username — 2 columns on sm+ */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            className="input"
            type="text"
            value={full_name}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
          />
        </Field>

        <Field label="Username">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-faint">
              @
            </span>
            <input
              className="input pl-7"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="janesmith"
            />
          </div>
        </Field>
      </div>

      {/* Headline */}
      <div className="mt-4">
        <Field label="Headline">
          <input
            className="input"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Senior Engineer at Acme · hiring great devs"
          />
        </Field>
      </div>

      {/* Bio */}
      <div className="mt-4">
        <Field label="Bio">
          <textarea
            className="input min-h-[96px] resize-y"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few lines about yourself…"
            rows={3}
          />
        </Field>
      </div>

      {/* Divider */}
      <hr className="my-5 border-line" />

      {/* Social links — 3 columns on sm+ */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">
        Links
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="LinkedIn">
          <input
            className="input"
            type="url"
            value={linkedin_url}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://linkedin.com/in/you"
          />
        </Field>

        <Field label="GitHub">
          <input
            className="input"
            type="url"
            value={github_url}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/you"
          />
        </Field>

        <Field label="Website">
          <input
            className="input"
            type="url"
            value={website_url}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://yoursite.com"
          />
        </Field>
      </div>

      {/* Divider */}
      <hr className="my-5 border-line" />

      {/* Avatar URL */}
      <Field label="Avatar URL">
        <input
          className="input"
          type="url"
          value={avatar_url}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.jpg"
        />
      </Field>

      {/* Read-only email row */}
      {email && (
        <div className="mt-4">
          <Field label="Email (read-only)">
            <input
              className="input cursor-not-allowed opacity-50"
              type="email"
              value={email}
              readOnly
              disabled
            />
          </Field>
        </div>
      )}

      {/* Action row */}
      <div className="mt-6 flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              className="h-4 w-4 shrink-0"
              aria-hidden
            >
              <path
                d="M3 8l3.5 3.5L13 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Saved
          </span>
        )}

        {errorMsg && (
          <span className="text-sm text-red-400">{errorMsg}</span>
        )}
      </div>
    </form>
  );
}

// Tiny label wrapper to keep JSX tidy.
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
