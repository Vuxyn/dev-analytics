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
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getRepoHost(url: string | null): string {
  if (!url) return "local";
  if (url.includes("github.com")) return "github";
  return "git";
}

export default function RepoList({
  repos,
  maxCommits,
}: {
  repos: Repo[];
  maxCommits: number;
}) {
  const [page, setPage] = useState(1);
  const LIMIT = 6;
  const totalPages = Math.ceil(repos.length / LIMIT);
  const displayRepos = repos.slice((page - 1) * LIMIT, page * LIMIT);

  if (!repos || repos.length === 0) {
    return (
      <div className="text-sm text-zinc-500 font-mono">belum ada data</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayRepos.map((repo, i) => {
          const barWidth = Math.max((repo.total_commits / maxCommits) * 100, 2);
          const netLines = repo.total_lines_added - repo.total_lines_removed;
          const host = getRepoHost(repo.remote_url);

          return (
            <Link
              key={repo.id}
              href={`/repos/${repo.id}`}
              className="block group"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="card p-6 space-y-4 group-hover:border-violet-500/20 transition-all">
                {/* Top row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 overflow-hidden min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 shrink-0 rounded-full bg-violet-400/60 group-hover:bg-violet-400 transition-colors" />
                      <h2 className="text-base font-semibold font-mono text-[#e2e2e8] truncate">
                        {repo.name}
                      </h2>
                      <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded bg-white/5 text-[#55556a] border border-white/5">
                        {host}
                      </span>
                    </div>
                    {repo.remote_url && (
                      <p className="text-xs text-[#55556a] font-mono pl-4 truncate max-w-full">
                        {repo.remote_url}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0 mt-1 sm:mt-0">
                    <span className="stat-badge shrink-0">
                      {repo.total_commits} commits
                    </span>
                    <span className="text-xs text-[#55556a] font-mono shrink-0">
                      {formatDate(repo.last_synced)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all group-hover:opacity-90"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-1">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-[#55556a] font-mono uppercase tracking-widest">
                      Added
                    </p>
                    <p className="text-sm font-mono text-[#3dd68c]">
                      +{formatNumber(repo.total_lines_added)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-[#55556a] font-mono uppercase tracking-widest">
                      Removed
                    </p>
                    <p className="text-sm font-mono text-[#f87171]">
                      -{formatNumber(repo.total_lines_removed)}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-[#55556a] font-mono uppercase tracking-widest">
                      Net
                    </p>
                    <p
                      className={`text-sm font-mono ${
                        netLines >= 0 ? "text-[#60a5fa]" : "text-[#f87171]"
                      }`}
                    >
                      {netLines >= 0 ? "+" : ""}
                      {formatNumber(netLines)}
                    </p>
                  </div>
                  <div className="w-full mt-2 sm:w-auto sm:mt-0 sm:ml-auto">
                    <span className="text-xs text-violet-400/50 group-hover:text-violet-400 transition-colors font-mono block sm:inline text-right whitespace-nowrap">
                      lihat timeline →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-end items-center gap-4 pr-2 mt-4">
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
