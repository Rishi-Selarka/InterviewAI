'use client';

// Single, simple auth page. Continue with Google (recommended) or email +
// password. There is no separate signup page: a new email/password just creates
// the account and logs in (email confirmation is off), an existing one logs in.

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/src/features/auth/supabase/client';
import { safeNext } from '@/src/features/auth/safeNext';
import GoogleButton from '@/src/features/auth/GoogleButton';
import Logo from '@/src/features/brand/Logo';
import ThemeToggle from '@/src/features/ui/ThemeToggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    // Create-or-sign-in in one step (no separate signup page).
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: email.split('@')[0] } },
    });

    if (signUpError) {
      if (/already registered|already exists/i.test(signUpError.message)) {
        // Existing account — just log in.
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          setBusy(false);
          return;
        }
      } else {
        setError(signUpError.message);
        setBusy(false);
        return;
      }
    } else if (!data.session) {
      // Email confirmation is enabled on this project.
      setNotice(`Account created. Check ${email} to confirm, then log in.`);
      setBusy(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo href="/" textClassName="text-xl" markClassName="h-9 w-9" />
        </div>
        <div className="card p-7 shadow-2xl shadow-black/40">
          <h1 className="text-2xl font-bold tracking-tight text-strong">Welcome</h1>
          <p className="mb-6 mt-1 text-sm text-muted">Log in to IntelliInterview.</p>

          <GoogleButton next={next} />

          <div className="my-4 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" /> or email <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />

            {error && (
              <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>
            )}
            {notice && (
              <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{notice}</p>
            )}

            <button type="submit" disabled={busy} className="btn-primary mt-1 w-full">
              {busy ? 'Please wait…' : 'Continue'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-faint">
          New here? Just continue above — your account is created automatically.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
