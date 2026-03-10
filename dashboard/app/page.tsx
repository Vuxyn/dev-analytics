import { Suspense } from "react";
import SummaryStats from "@/components/SummaryStats";
import ActivityHeatmap from "@/components/ActivityHeatmap";
import TopRepos from "@/components/TopRepos";

export const revalidate = 300; // revalidate setiap 5 menit

async function getSummary() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/summary`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

async function getHeatmap() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/heatmap`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to fetch heatmap");
  return res.json();
}

async function getRepos() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

export default async function HomePage() {
  const [summary, heatmap, repos] = await Promise.all([
    getSummary(),
    getHeatmap(),
    getRepos(),
  ]);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#e2e2e8] tracking-tight">
          Overview
        </h1>
        <p className="text-sm text-[#9999b0]">
          Aktivitas coding dari semua branch —{" "}
          <span className="text-violet-400/80">bukan cuma master</span>
        </p>
      </div>

      {/* Summary stats */}
      <Suspense fallback={<StatsSkeleton />}>
        <SummaryStats data={summary} />
      </Suspense>

      {/* Heatmap */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#e2e2e8]">
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
          <h2 className="text-sm font-medium text-[#e2e2e8]">
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
