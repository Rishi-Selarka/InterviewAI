'use client';

import { useEffect, useState } from 'react';

interface InterviewerProfile {
  id: string;
  full_name: string;
  username: string;
  headline: string;
  bio: string;
  work_experience: string;
  linkedin_url: string;
  github_url: string;
  website_url: string;
  avatar_url: string;
}

export default function InterviewerProfileCard({
  interviewerId,
  onClose,
}: {
  interviewerId: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<InterviewerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // interviewerId is fixed for the modal's lifetime, so the effect runs once
    // and the initial state (loading=true, error=false) is already correct — no
    // synchronous setState needed here.
    let cancelled = false;

    fetch(`/api/profile/${interviewerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('non-ok response');
        return res.json() as Promise<InterviewerProfile>;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [interviewerId]);

  // Escape key closes the modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const initials = profile?.full_name?.trim()[0]?.toUpperCase() ?? '?';

  return (
    /* Full-screen overlay — clicking the backdrop closes the modal */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Card — stop propagation so inner clicks don't close */}
      <div
        className="card max-w-sm w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile"
          className="btn-ghost absolute top-3 right-3 p-1 rounded-md"
        >
          {/* X icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted">
            Loading…
          </div>
        ) : error || !profile ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted">
            Couldn&apos;t load profile.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {/* Role badge */}
            <span className="text-xs font-medium text-brandbright bg-brand/20 px-2.5 py-0.5 rounded-full tracking-wide uppercase">
              Interviewer
            </span>

            {/* Avatar */}
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-20 h-20 rounded-full object-cover border-2 border-line"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-brand flex items-center justify-center text-2xl font-bold text-brandbright border-2 border-line select-none">
                {initials}
              </div>
            )}

            {/* Name */}
            <h2 className="text-lg font-bold text-strong text-center leading-snug">
              {profile.full_name}
            </h2>

            {/* Username */}
            {profile.username && (
              <p className="text-sm text-muted -mt-1">@{profile.username}</p>
            )}

            {/* Headline */}
            {profile.headline && (
              <p className="text-sm text-fg text-center">{profile.headline}</p>
            )}

            {/* Bio */}
            {profile.bio && (
              <p className="text-sm text-muted text-center leading-relaxed border-t border-line pt-3 w-full">
                {profile.bio}
              </p>
            )}

            {/* Work experience */}
            {profile.work_experience && (
              <div className="w-full border-t border-line pt-3 text-left">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-faint">
                  Work experience
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-fg">
                  {profile.work_experience}
                </p>
              </div>
            )}

            {/* Links */}
            {(profile.linkedin_url || profile.github_url || profile.website_url) && (
              <div className="flex flex-wrap gap-2 justify-center pt-1">
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
                  >
                    {/* LinkedIn icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
                      <circle cx="4" cy="4" r="2" />
                    </svg>
                    LinkedIn
                  </a>
                )}

                {profile.github_url && (
                  <a
                    href={profile.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
                  >
                    {/* GitHub icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                    GitHub
                  </a>
                )}

                {profile.website_url && (
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center gap-1.5 text-xs px-3 py-1.5 rounded"
                  >
                    {/* Globe icon */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Website
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
