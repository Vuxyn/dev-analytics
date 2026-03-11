import { Suspense } from "react";
import SummaryStats from "@/components/SummaryStats";
import SessionStats from "@/components/SessionStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import TopRepos from "@/components/TopRepos";
import DateFilter from "@/components/DateFilter";
import LanguageDistribution from "@/components/LanguageDistribution";

export const revalidate = 0; // dynamic because of user searchParams

async function getSummary(username: string, days: string | null) {
  const query = days ? `&days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/summary?username=${username}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch summary: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

async function getSessionSummary(username: string, days: string | null) {
  const query = days ? `&days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/sessions/summary?username=${username}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch session summary: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

async function getHeatmap(username: string, days: string | null) {
  const query = days ? `&days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/heatmap?username=${username}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch heatmap: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

async function getRepos(username: string, days: string | null) {
  const query = days ? `&days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos?username=${username}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch repos: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

async function getLanguageStats(username: string, days: string | null) {
  const query = days ? `&days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/languages?username=${username}${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const errorText = await res.text().catch(() => "Unknown error");
    throw new Error(`Failed to fetch languages: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

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

  const [summary, sessions, heatmap, repos, languages] = await Promise.all([
    getSummary(username, days),
    getSessionSummary(username, days),
    getHeatmap(username, days),
    getRepos(username, days),
    getLanguageStats(username, days),
  ]);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Overview
          </h1>
          <p className="text-sm text-zinc-400">
            Aktivitas coding dari semua branch, {" "}
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
          <h2 className="text-sm font-medium text-white">
            Aktivitas Coding
          </h2>
          <span className="stat-badge">semua branch</span>
        </div>
        <Suspense fallback={<div className="h-32 bg-white/5 rounded animate-pulse" />}>
          <ActivityHeatmap data={heatmap} />
        </Suspense>
      </div>

      {/* Language distribution */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-medium text-white">
          Bahasa Pemrograman
        </h2>
        <Suspense fallback={<div className="h-12 bg-white/5 rounded animate-pulse" />}>
          <LanguageDistribution data={languages} />
        </Suspense>
      </div>

      {/* Top repos */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">
            Repository Aktif
          </h2>
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
