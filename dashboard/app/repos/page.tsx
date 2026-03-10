import Link from "next/link";
import RepoList from "@/components/RepoList";
import DateFilter from "@/components/DateFilter";

export const revalidate = 0;

type Repo = {
  id: number;
  name: string;
  remote_url: string;
  last_synced: string | null;
  total_commits: number;
  total_lines_added: number;
  total_lines_removed: number;
};

async function getRepos(days: string | null): Promise<Repo[]> {
  const query = days ? `?days=${days}` : "";
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/repos${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

export default async function ReposPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const days = typeof resolvedParams.days === "string" ? resolvedParams.days : null;

  const repos = await getRepos(days);
  const maxCommits = Math.max(...repos.map((r) => r.total_commits), 1);

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#e2e2e8] tracking-tight">
            Repositories
          </h1>
          <p className="text-sm text-[#9999b0]">
            {repos.length} repo dipantau ·{" "}
            <span className="text-violet-400/80">semua branch</span>
          </p>
        </div>
        <DateFilter />
      </div>

      {/* Repo list */}
      <RepoList repos={repos} maxCommits={maxCommits} />
    </div>
  );
}
