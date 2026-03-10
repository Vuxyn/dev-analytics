"use client";

const branchColors: Record<string, string> = {
  main: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  master: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  dev: "text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/10",
  develop: "text-[#60a5fa] border-[#60a5fa]/30 bg-[#60a5fa]/10",
};

function getBranchColor(branch: string): string {
  if (branchColors[branch]) return branchColors[branch];
  if (branch.startsWith("feature/") || branch.startsWith("features/"))
    return "text-[#3dd68c] border-[#3dd68c]/30 bg-[#3dd68c]/10";
  if (branch.startsWith("fix/") || branch.startsWith("hotfix/"))
    return "text-[#f87171] border-[#f87171]/30 bg-[#f87171]/10";
  if (branch.startsWith("refactor/"))
    return "text-[#fbbf24] border-[#fbbf24]/30 bg-[#fbbf24]/10";
  return "text-[#9999b0] border-white/10 bg-white/5";
}

export default function BranchBadges({ branches }: { branches: string[] }) {
  if (!branches || branches.length === 0) {
    return <span className="text-xs text-[#55556a] font-mono">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {branches.map((branch) => (
        <span
          key={branch}
          className={`text-[11px] font-mono px-2.5 py-1 rounded-md border ${getBranchColor(branch)}`}
        >
          {branch}
        </span>
      ))}
    </div>
  );
}
