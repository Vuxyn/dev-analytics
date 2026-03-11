import { Suspense } from "react";
import SummaryStats from "@/components/SummaryStats";
import SessionStats from "@/components/SessionStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import TopRepos from "@/components/TopRepos";
import DateFilter from "@/components/DateFilter";
import LanguageDistribution from "@/components/LanguageDistribution";
import GithubPreview from "@/components/GithubPreview";
import { fetchGithubUser, fetchGithubRepos, aggregateLanguages } from "@/lib/github";

type HeatmapEntry = { date: string; commits: number; lines_added: number; lines_removed: number };
type Repo = { id: number; name: string; remote_url: string; last_synced: string | null; total_commits: number; total_lines_added: number; total_lines_removed: number };
type LanguageStat = { language: string; lines_added: number; lines_removed: number; total_changes: number };

export const revalidate = 0;

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 404) return fallback;
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  } catch {
    return fallback;
  }
}

const emptySummary = {
  total_repos: 0, total_commits: 0, total_lines_added: 0,
  total_lines_removed: 0, total_files_changed: 0,
  first_commit_date: null, last_commit_date: null, most_active_repos: [],
};
const emptySessions = { total_sessions: 0, total_duration_minutes: 0, average_duration_minutes: 0 };

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { username } = await params;
  const resolvedParams = await searchParams;
  const days = typeof resolvedParams.days === "string" ? resolvedParams.days : null;
  const q = (base: string) => `${process.env.NEXT_PUBLIC_API_URL}/${base}?username=${username}${days ? `&days=${days}` : ""}`;

  const [summary, sessions, heatmap, repos, languages] = await Promise.all([
    safeFetch(q("summary"), emptySummary),
    safeFetch(q("sessions/summary"), emptySessions),
    safeFetch<HeatmapEntry[]>(q("heatmap"), []),
    safeFetch<Repo[]>(q("repos"), []),
    safeFetch<LanguageStat[]>(q("languages"), []),
  ]);

  const userNotFound = summary.total_commits === 0 && repos.length === 0;

  // GitHub API fallback for new users who haven't run install.sh yet
  if (userNotFound) {
    const [ghUser, ghRepos] = await Promise.all([
      fetchGithubUser(username),
      fetchGithubRepos(username),
    ]);

    if (!ghUser) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4 text-center">
          <div className="text-5xl">🔍</div>
          <h1 className="text-xl font-semibold text-white">User tidak ditemukan</h1>
          <p className="text-sm text-zinc-400">
            Username <span className="font-mono text-violet-400">{username}</span> tidak ada di database maupun GitHub.
          </p>
          <a href="/" className="text-xs text-violet-400 hover:underline">← Cari username lain</a>
        </div>
      );
    }

    const ghLanguages = aggregateLanguages(ghRepos);
    return <GithubPreview user={ghUser} repos={ghRepos} languages={ghLanguages} />;
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Overview — <span className="font-mono text-violet-400">@{username}</span>
          </h1>
          <p className="text-sm text-zinc-400">
            Aktivitas coding dari semua branch,{" "}
            <span className="text-violet-400">bukan cuma master</span>
          </p>
        </div>
        <DateFilter />
      </div>

      {/* Summary stats */}
      <Suspense fallback={<StatsSkeleton />}>
        <SummaryStats data={summary} />
      </Suspense>

      {/* Session stats */}
      <Suspense fallback={<div className="h-24 bg-white/5 rounded animate-pulse" />}>
        <SessionStats data={sessions} />
      </Suspense>

      {/* Heatmap */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Aktivitas Coding</h2>
          <span className="stat-badge">semua branch</span>
        </div>
        <Suspense fallback={<div className="h-32 bg-white/5 rounded animate-pulse" />}>
          <ActivityHeatmap data={heatmap} />
        </Suspense>
      </div>

      {/* Language distribution */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-medium text-white">Bahasa Pemrograman</h2>
        <Suspense fallback={<div className="h-12 bg-white/5 rounded animate-pulse" />}>
          <LanguageDistribution data={languages} />
        </Suspense>
      </div>

      {/* Top repos */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">Repository Aktif</h2>
          <a
            href={`/u/${username}/repos`}
            className="text-xs text-violet-400/70 hover:text-violet-400 transition-colors"
          >
            lihat semua →
          </a>
        </div>
        <Suspense fallback={<div className="h-40 bg-white/5 rounded animate-pulse" />}>
          <TopRepos data={repos} />
        </Suspense>
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 h-24 animate-pulse bg-white/5" />
      ))}
    </div>
  );
}
