"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";

type TimelineEntry = {
    date: string;
    commit_count: number;
    lines_added: number;
    lines_removed: number;
    files_changed: number;
    active_hours: number[];
    branches: string[];
};

type Props = {
    data: TimelineEntry[];
    mode?: "commits" | "lines";
};

const CustomTooltip = ({ active, payload, label, mode }: any) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="bg-[#16161f] border border-white/10 rounded-lg p-3 text-xs font-mono shadow-xl">
            <p className="text-[#9999b0] mb-2">{label}</p>
            {mode === "lines" ? (
                <>
                    <p className="text-[#3dd68c]">+{payload[0]?.value?.toLocaleString()} added</p>
                    <p className="text-[#f87171]">-{payload[1]?.value?.toLocaleString()} removed</p>
                </>
            ) : (
                <p className="text-violet-400">{payload[0]?.value} commits</p>
            )}
        </div>
    );
};

export default function TimelineChart({ data, mode = "commits" }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="h-48 flex items-center justify-center text-[#55556a] text-sm font-mono">
                belum ada data
            </div>
        );
    }

    // Filter hanya hari yang ada aktivitas, format label
    const chartData = data
        .filter((d) => d.commit_count > 0 || mode === "lines")
        .map((d) => ({
            date: d.date.slice(5), // MM-DD
            fullDate: d.date,
            commits: d.commit_count,
            added: d.lines_added,
            removed: d.lines_removed,
        }));

    if (mode === "lines") {
        return (
            <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
                <div className="min-w-[500px] h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="colorAdded" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3dd68c" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3dd68c" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRemoved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                        dataKey="date"
                        tick={{ fill: "#55556a", fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />
                    <YAxis
                        tick={{ fill: "#55556a", fontSize: 10, fontFamily: "var(--font-mono)" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
                    />
                    <Tooltip 
                        content={<CustomTooltip mode="lines" />} 
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="added"
                        stroke="#3dd68c"
                        strokeWidth={1.5}
                        fill="url(#colorAdded)"
                    />
                    <Area
                        type="monotone"
                        dataKey="removed"
                        stroke="#f87171"
                        strokeWidth={1.5}
                        fill="url(#colorRemoved)"
                    />
                </AreaChart>
            </ResponsiveContainer>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto pb-2 scrollbar-thin">
            <div className="min-w-[500px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                    dataKey="date"
                    tick={{ fill: "#55556a", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                />
                <YAxis
                    tick={{ fill: "#55556a", fontSize: 10, fontFamily: "var(--font-mono)" }}
                    tickLine={false}
                    axisLine={false}
                />
                <Tooltip 
                    content={<CustomTooltip mode="commits" />} 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                />
                <Bar
                    dataKey="commits"
                    fill="#7c6af7"
                    radius={[2, 2, 0, 0]}
                    opacity={0.8}
                />
            </BarChart>
        </ResponsiveContainer>
            </div>
        </div>
    );
}