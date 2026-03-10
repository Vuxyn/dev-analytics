import Link from "next/link";

export const revalidate = 300;

type Repo = {
  id: number;
  name: string;
  remote_url: string;
  last_synced: string | null;
  total_commits: number;
  total_lines_added: number;
  total_lines_removed: number;
};

async function getRepos(): Promise<Repo[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

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

export default async function ReposPage() {
  const repos = await getRepos();
  const maxCommits = Math.max(...repos.map((r) => r.total_commits), 1);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#e2e2e8] tracking-tight">
          Repositories
        </h1>
        <p className="text-sm text-[#9999b0]">
          {repos.length} repo dipantau ·{" "}
          <span className="text-violet-400/80">semua branch</span>
        </p>
      </div>

      {/* Repo list */}
      <div className="space-y-4">
        {repos.map((repo, i) => {
          const barWidth = Math.max(
            (repo.total_commits / maxCommits) * 100,
            2
          );
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
    </div>
  );
}
