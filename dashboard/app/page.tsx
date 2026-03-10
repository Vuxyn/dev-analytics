import { Suspense } from "react";
import SummaryStats from "@/components/SummaryStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import TopRepos from "@/components/TopRepos";
import DateFilter from "@/components/DateFilter";

export const revalidate = 0; // dynamic because of user searchParams

async function getSummary(days: string | null) {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/summary${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

async function getHeatmap(days: string | null) {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/heatmap${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch heatmap");
  return res.json();
}

async function getRepos(days: string | null) {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const days = typeof resolvedParams.days === "string" ? resolvedParams.days : null;

  const [summary, heatmap, repos] = await Promise.all([
    getSummary(days),
    getHeatmap(days),
    getRepos(days),
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

      {/* Top repos */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white">
            Repository Aktif
          </h2>
          <a
            href="/repos"
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
