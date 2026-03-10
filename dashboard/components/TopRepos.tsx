"use client";

import Link from "next/link";
import { useState } from "react";

type Repo = {
  id: number;
  name: string;
  remote_url: string;
  last_synced: string | null;
  total_commits: number;
  total_lines_added: number;
  total_lines_removed: number;
};

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function TopRepos({ data }: { data: Repo[] }) {
  const [page, setPage] = useState(1);

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-zinc-500 font-mono">belum ada data</div>
    );
  }

  const maxCommits = Math.max(...data.map((r) => r.total_commits), 1);

  const LIMIT = 4;
  const totalPages = Math.ceil(data.length / LIMIT);
  const displayData = data.slice((page - 1) * LIMIT, page * LIMIT);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayData.map((repo) => {
        const barWidth = Math.max((repo.total_commits / maxCommits) * 100, 2);
        const netLines = repo.total_lines_added - repo.total_lines_removed;

        return (
          <Link
            key={repo.id}
            href={`/repos/${repo.id}`}
            className="block group"
          >
            <div className="card p-4 space-y-3 group-hover:border-violet-500/20 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400/60 group-hover:bg-violet-400 transition-colors" />
                  <span className="text-sm font-medium text-white font-mono break-all">
                    {repo.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500 font-mono">
                    synced {formatDate(repo.last_synced)}
                  </span>
                  <span className="stat-badge">
                    {repo.total_commits} commits
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500/60 rounded-full transition-all group-hover:bg-violet-400/80"
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-xs text-[#3dd68c] font-mono">
                  +{formatNumber(repo.total_lines_added)}
                </span>
                <span className="text-xs text-[#f87171] font-mono">
                  -{formatNumber(repo.total_lines_removed)}
                </span>
                <span className={`text-xs font-mono ${netLines >= 0 ? "text-zinc-500" : "text-[#f87171]"}`}>
                  net {netLines >= 0 ? "+" : ""}{formatNumber(netLines)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
      </div>
      
      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-4 pr-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-violet-400/50 hover:text-violet-400 disabled:opacity-30 disabled:hover:text-violet-400/50 transition-colors font-mono"
          >
            ← prev
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs text-violet-400/50 hover:text-violet-400 disabled:opacity-30 disabled:hover:text-violet-400/50 transition-colors font-mono"
          >
            next →
          </button>
        </div>
      )}
    </div>
  );
}
