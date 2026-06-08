// Landing page. Marketing hero + feature grid, styled to match the product
// mockups. Visitors sign in to host (interviewer) or join (candidate) a room.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/src/features/brand/Logo';
import GuestStart from '@/src/features/landing/GuestStart';
import Icon, { type IconName } from '@/src/features/ui/Icon';
import ThemeToggle from '@/src/features/ui/ThemeToggle';
import { getSessionProfile } from '@/src/features/auth/profile';

export default async function Home() {
  // The landing page is for first-time / logged-out visitors only. A signed-in
  // user who hits "/" goes straight to their dashboard — the splash is just the
  // entry point to authenticate, not a screen they should keep seeing.
  const session = await getSessionProfile();
  if (session) redirect('/dashboard');

  return (
    <div className="flex flex-1 flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-line/60 bg-ink/70 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <Logo href="/" />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#features" className="transition-colors hover:text-strong">Features</a>
            <Link href="/interview" className="transition-colors hover:text-strong">Coding Pad</Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {session ? (
              <Link href="/dashboard" className="btn-primary px-4 py-2">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="btn-primary px-4 py-2">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line2 bg-surface px-3 py-1 text-xs font-medium text-brandbright">
            ● Smart Interviews, Smarter Hiring
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-strong sm:text-5xl">
            The Intelligent Way to{' '}
            <span className="brand-gradient-text">Conduct Coding Interviews</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
            A live technical-interview room with a shared, runnable code editor,
            video, assistive proctoring, and structured scoring — built to make
            evaluation fair, transparent, and reproducible.
          </p>

          <div className="mt-8 max-w-md">
            <GuestStart />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HeroPill icon="shield" title="Secure Execution" subtitle="Sandboxed & safe" />
            <HeroPill icon="bolt" title="Real-time Sync" subtitle="Live shared editor" />
            <HeroPill icon="gauge" title="Fair Scoring" subtitle="Rubric + AI judge" />
          </div>
        </div>

        {/* Code preview card */}
        <div className="card overflow-hidden shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 border-b border-line bg-ink2 px-4 py-2.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <span className="ml-3 text-xs text-faint">solution.py — live room</span>
            <span className="ml-auto rounded-md bg-gradient-to-r from-brand2 to-brand px-2.5 py-1 text-[11px] font-semibold text-onbrand">
              ▶ Run
            </span>
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed">
<code><span className="text-faint"># Optimize: first duplicate — make it O(n)</span>{'\n'}
<span className="text-brandbright">def</span> <span className="text-sky-300">first_duplicate</span>(arr):{'\n'}
{'    '}seen = <span className="text-emerald-300">set</span>(){'\n'}
{'    '}<span className="text-brandbright">for</span> x <span className="text-brandbright">in</span> arr:{'\n'}
{'        '}<span className="text-brandbright">if</span> x <span className="text-brandbright">in</span> seen:{'\n'}
{'            '}<span className="text-brandbright">return</span> x{'\n'}
{'        '}seen.add(x){'\n'}
{'    '}<span className="text-brandbright">return</span> -<span className="text-amber-300">1</span>{'\n'}
{'\n'}
<span className="text-sky-300">print</span>(first_duplicate([<span className="text-amber-300">3</span>,<span className="text-amber-300">1</span>,<span className="text-amber-300">4</span>,<span className="text-amber-300">1</span>]))  <span className="text-faint"># 1</span></code>
          </pre>
          <div className="border-t border-line bg-ink2 px-5 py-3 font-mono text-xs text-emerald-300">
            ✓ Accepted · Runtime 22 ms · 11.2 MB
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold tracking-tight text-strong">
          Everything you need for a great interview
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-muted">
          Modular features that cover the whole flow — from a live coding room to a
          fair, reviewable report.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            color="bg-brand/15 text-brandbright"
            icon="calendar"
            title="Interview Made Easy"
            body="Create, schedule, and manage live coding sessions with a shareable invite link."
          />
          <FeatureCard
            color="bg-emerald-500/15 text-emerald-300"
            icon="shield"
            title="Secure & Reliable"
            body="Sandboxed, gated code execution keeps the host safe from untrusted submissions."
          />
          <FeatureCard
            color="bg-amber-500/15 text-amber-300"
            icon="gauge"
            title="Fair Evaluation"
            body="A 5-point rubric plus an unbiased AI second-judge to catch scoring gaps."
          />
          <FeatureCard
            color="bg-sky-500/15 text-sky-300"
            icon="chart"
            title="Insightful Reports"
            body="Recordings, transcripts, and attention signals — all in one detail view."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-faint sm:flex-row">
          <Logo href={null} textClassName="text-base" markClassName="h-7 w-7" />
          <span>Live technical interviews with a smart coding room.</span>
        </div>
      </footer>
    </div>
  );
}

function HeroPill({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <div className="card card-hover flex items-center gap-3 px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brandbright">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-strong">{title}</div>
        <div className="text-xs text-faint">{subtitle}</div>
      </div>
    </div>
  );
}

function FeatureCard({
  color,
  icon,
  title,
  body,
}: {
  color: string;
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <div className="card card-hover p-5">
      <span className={`chip ${color}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-strong">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
