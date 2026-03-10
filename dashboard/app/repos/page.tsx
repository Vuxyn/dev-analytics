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

import RepoList from "@/components/RepoList";

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
      <RepoList repos={repos} maxCommits={maxCommits} />
    </div>
  );
}
