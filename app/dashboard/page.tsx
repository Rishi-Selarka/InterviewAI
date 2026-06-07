// Dashboard: any signed-in user can host interviews (and join others' rooms via
// invite link). Sidebar links to the profile settings.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionProfile, displayName } from '@/src/features/auth/profile';
import {
  listInterviewsForInterviewer,
  type Interview,
} from '@/src/features/interviews/server/interviews';
import NewInterviewButton from '@/src/features/interviews/NewInterviewButton';
import SignOutButton from '@/src/features/auth/SignOutButton';
import Logo from '@/src/features/brand/Logo';
import Icon, { type IconName } from '@/src/features/ui/Icon';
import ThemeToggle from '@/src/features/ui/ThemeToggle';

const STATUS_STYLES: Record<string, string> = {
  created: 'bg-zinc-500/15 text-fg',
  active: 'bg-emerald-500/15 text-emerald-300',
  ended: 'bg-brand/15 text-brandbright',
};

export default async function DashboardPage() {
  const session = await getSessionProfile();
  if (!session) redirect('/login?next=/dashboard');

  const { profile } = session;
  const name = displayName(profile, session.email);
  const interviews = await listInterviewsForInterviewer(session.userId);

  return (
    <div className="flex flex-1">
      <Sidebar name={name} avatarUrl={profile.avatar_url} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line px-5 py-3 lg:hidden">
          <Logo href="/" textClassName="text-base" markClassName="h-7 w-7" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/profile" className="btn-ghost px-3 py-1.5">Profile</Link>
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-6 py-8">
          <InterviewerDashboard interviews={interviews} name={name} />
        </main>
      </div>
    </div>
  );
}

function Sidebar({ name, avatarUrl }: { name: string; avatarUrl: string }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-ink2/60 lg:flex">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo href="/" textClassName="text-lg" markClassName="h-8 w-8" />
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-3">
        <NavItem href="/dashboard" icon="dashboard" label="Dashboard" active />
        <NavItem href="/profile" icon="user" label="Profile" />
        <NavItem href="/interview" icon="code" label="Coding Pad" />
        <p className="px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-wider text-faint">
          More
        </p>
        <NavItem icon="users" label="Candidates" soon />
        <NavItem icon="report" label="Reports" soon />
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors hover:bg-surface2"
        >
          <Avatar name={name} url={avatarUrl} />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-strong">{name}</div>
            <div className="text-xs text-faint">View profile</div>
          </div>
        </Link>
        <div className="mt-2">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function Avatar({ name, url }: { name: string; url: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-strong">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
  soon,
}: {
  href?: string;
  icon: IconName;
  label: string;
  active?: boolean;
  soon?: boolean;
}) {
  const base =
    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors';
  if (soon || !href) {
    return (
      <div className={`${base} cursor-default text-faint`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
        <span>{label}</span>
        <span className="ml-auto rounded-full bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
          soon
        </span>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${
        active ? 'bg-brand/15 text-strong' : 'text-muted hover:bg-surface2 hover:text-strong'
      }`}
    >
      <Icon name={icon} className="h-[18px] w-[18px]" />
      <span>{label}</span>
    </Link>
  );
}

function InterviewerDashboard({
  interviews,
  name,
}: {
  interviews: Interview[];
  name: string;
}) {
  const active = interviews.filter((i) => i.status === 'active').length;
  const ended = interviews.filter((i) => i.status === 'ended').length;
  const candidates = interviews.filter((i) => i.candidate_id).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-strong">Welcome back, {name} 👋</h1>
          <p className="mt-1 text-sm text-muted">Create an interview and share the invite link.</p>
        </div>
        <NewInterviewButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon="briefcase" color="bg-brand/15 text-brandbright" label="Total Interviews" value={interviews.length} />
        <StatCard icon="live" color="bg-emerald-500/15 text-emerald-300" label="Active Now" value={active} />
        <StatCard icon="check" color="bg-sky-500/15 text-sky-300" label="Completed" value={ended} />
        <StatCard icon="user" color="bg-amber-500/15 text-amber-300" label="Candidates Joined" value={candidates} />
      </div>

      <h2 className="mb-3 mt-9 text-lg font-semibold text-strong">Your interviews</h2>
      {interviews.length === 0 ? (
        <div className="card border-dashed p-10 text-center">
          <p className="text-sm text-muted">
            No interviews yet. Click <strong className="text-fg">New interview</strong> to
            create one and get a shareable invite link.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {interviews.map((iv) => (
            <li key={iv.id} className="card card-hover flex items-center justify-between px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-sm font-medium text-strong">{iv.room_id}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[iv.status] ?? ''}`}>
                    {iv.status}
                  </span>
                  {iv.candidate_id && (
                    <span className="hidden text-xs text-faint sm:inline">candidate joined</span>
                  )}
                </div>
                <span className="text-xs text-faint">{new Date(iv.created_at).toLocaleString()}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href={`/interviews/${iv.id}`} className="btn-ghost px-3.5 py-1.5">Details</Link>
                <Link href={`/room/${iv.room_id}`} className="btn-primary px-3.5 py-1.5">Open</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="card p-4">
      <span className={`chip ${color}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="mt-3 text-2xl font-bold text-strong">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
