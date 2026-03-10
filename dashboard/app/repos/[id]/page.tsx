import { notFound } from "next/navigation";
import TimelineChart from "@/components/TimelineChart";
import BranchBadges from "@/components/BranchBadges";
import DateFilter from "@/components/DateFilter";

export const revalidate = 0;

type TimelineEntry = {
    date: string;
    commit_count: number;
    lines_added: number;
    lines_removed: number;
    files_changed: number;
    active_hours: number[];
    branches: string[];
};

type TimelineData = {
    repo_id: number;
    repo_name: string;
    timeline: TimelineEntry[];
};

async function getTimeline(id: string, days: string | null): Promise<TimelineData> {
    const query = days ? `?days=${days}` : "";
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/timeline/${id}${query}`,
        { cache: "no-store" }
    );
    if (res.status === 404) notFound();
    if (!res.ok) throw new Error("Failed to fetch timeline");
    return res.json();
}

function formatNumber(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
}

function detectMilestones(timeline: TimelineEntry[]) {
    const milestones: { date: string; type: string; label: string }[] = [];

    for (let i = 1; i < timeline.length; i++) {
        const prev = timeline[i - 1];
        const curr = timeline[i];

        // Gap lebih dari 7 hari = hiatus end
        const prevDate = new Date(prev.date);
        const currDate = new Date(curr.date);
        const gapDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
        if (gapDays > 7 && curr.commit_count > 0) {
            milestones.push({ date: curr.date, type: "comeback", label: `comeback setelah ${Math.round(gapDays)}h gap` });
        }

        // Lines removed >> lines added = refactor
        if (curr.lines_removed > curr.lines_added * 1.5 && curr.lines_removed > 100) {
            milestones.push({ date: curr.date, type: "refactor", label: "refactor besar" });
        }

        // Banyak commit dalam sehari = debugging marathon
        if (curr.commit_count >= 5) {
            milestones.push({ date: curr.date, type: "marathon", label: `${curr.commit_count} commits dalam sehari` });
        }
    }

    return milestones;
}

export default async function RepoDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const { id } = await params;
    const resolvedParams = await searchParams;
    const days = typeof resolvedParams.days === "string" ? resolvedParams.days : null;

    const data = await getTimeline(id, days);
    const { timeline, repo_name } = data;

    const totalCommits = timeline.reduce((s, d) => s + d.commit_count, 0);
    const totalAdded = timeline.reduce((s, d) => s + d.lines_added, 0);
    const totalRemoved = timeline.reduce((s, d) => s + d.lines_removed, 0);
    const allBranches = [...new Set(timeline.flatMap((d) => d.branches || []))];
    const milestones = detectMilestones(timeline);

    const firstDate = timeline[0]?.date ?? "—";
    const lastDate = timeline[timeline.length - 1]?.date ?? "—";
    const activeDays = timeline.filter((d) => d.commit_count > 0).length;

    return (
        <div className="space-y-8 animate-fade-up">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-[#55556a] font-mono">
                        <a href="/repos" className="hover:text-violet-400 transition-colors">
                            repos
                        </a>
                        <span>/</span>
                        <span className="text-[#9999b0]">{repo_name}</span>
                    </div>
                    <h1 className="text-2xl font-semibold text-[#e2e2e8] tracking-tight font-mono">
                        {repo_name}
                    </h1>
                    <p className="text-sm text-[#55556a]">
                        {firstDate} → {lastDate} · {activeDays} hari aktif
                    </p>
                </div>
                <DateFilter />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Total Commits", value: totalCommits.toString(), color: "text-violet-400" },
                    { label: "Lines Added", value: `+${formatNumber(totalAdded)}`, color: "text-[#3dd68c]" },
                    { label: "Lines Removed", value: `-${formatNumber(totalRemoved)}`, color: "text-[#f87171]" },
                    { label: "Active Days", value: activeDays.toString(), color: "text-[#60a5fa]" },
                ].map((stat) => (
                    <div key={stat.label} className="card p-4 space-y-1.5">
                        <p className="text-[10px] text-[#55556a] font-mono uppercase tracking-widest">
                            {stat.label}
                        </p>
                        <p className={`text-xl font-semibold font-mono ${stat.color}`}>
                            {stat.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Branches */}
            <div className="card p-5 space-y-3">
                <h2 className="text-sm font-medium text-[#e2e2e8]">
                    Branches ({allBranches.length})
                </h2>
                <BranchBadges branches={allBranches} />
            </div>

            {/* Milestones */}
            {milestones.length > 0 && (
                <div className="card p-5 space-y-3">
                    <h2 className="text-sm font-medium text-[#e2e2e8]">
                        Momen Kunci
                    </h2>
                    <div className="space-y-2">
                        {milestones.slice(0, 5).map((m, i) => (
                            <div key={i} className="flex flex-wrap items-center gap-2 sm:gap-3">
                                <span className="font-mono text-xs text-[#55556a]">{m.date}</span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${m.type === "refactor"
                                        ? "text-[#f87171] border-[#f87171]/20 bg-[#f87171]/5"
                                        : m.type === "comeback"
                                            ? "text-[#60a5fa] border-[#60a5fa]/20 bg-[#60a5fa]/5"
                                            : "text-[#fbbf24] border-[#fbbf24]/20 bg-[#fbbf24]/5"
                                    }`}>
                                    {m.type}
                                </span>
                                <span className="text-xs text-[#9999b0]">{m.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline chart */}
            <div className="card p-6 space-y-4">
                <h2 className="text-sm font-medium text-[#e2e2e8]">
                    Commit Timeline
                </h2>
                <TimelineChart data={timeline} />
            </div>

            {/* Lines chart */}
            <div className="card p-6 space-y-4">
                <h2 className="text-sm font-medium text-[#e2e2e8]">
                    Lines Changed
                </h2>
                <TimelineChart data={timeline} mode="lines" />
            </div>
        </div>
    );
}
