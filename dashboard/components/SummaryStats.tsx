type Summary = {
  total_repos: number;
  total_commits: number;
  total_lines_added: number;
  total_lines_removed: number;
  total_files_changed: number;
  first_commit_date: string | null;
  last_commit_date: string | null;
  most_active_repos: { name: string; total_commits: number }[];
};

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "violet" | "blue";
}) {
  const accentMap = {
    green: "text-[#3dd68c]",
    red: "text-[#f87171]",
    violet: "text-violet-400",
    blue: "text-[#60a5fa]",
  };

  return (
    <div className="card p-5 space-y-2 hover:border-white/10 transition-all">
      <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
        {label}
      </p>
      <p
        className={`text-2xl font-semibold font-mono tracking-tight ${
          accent ? accentMap[accent] : "text-white"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

export default function SummaryStats({ data }: { data: Summary }) {
  const dateRange =
    data.first_commit_date && data.last_commit_date
      ? `${data.first_commit_date} → ${data.last_commit_date}`
      : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Commits"
        value={formatNumber(data.total_commits)}
        sub={dateRange}
        accent="violet"
      />
      <StatCard
        label="Lines Added"
        value={`+${formatNumber(data.total_lines_added)}`}
        sub={`${data.total_files_changed} files changed`}
        accent="green"
      />
      <StatCard
        label="Lines Removed"
        value={`-${formatNumber(data.total_lines_removed)}`}
        sub="refactor & cleanup"
        accent="red"
      />
      <StatCard
        label="Repositories"
        value={data.total_repos.toString()}
        sub={`most active: ${data.most_active_repos[0]?.name ?? "—"}`}
        accent="blue"
      />
    </div>
  );
}
