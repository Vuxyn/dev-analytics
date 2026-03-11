import React from "react";

type SessionSummary = {
  total_sessions: number;
  total_duration_minutes: number;
  average_duration_minutes: number;
};

function formatHours(minutes: number): string {
  if (minutes === 0) return "0m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
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
  accent?: "green" | "red" | "violet" | "blue" | "orange";
}) {
  const accentMap: Record<string, string> = {
    green: "text-[#3dd68c]",
    red: "text-[#f87171]",
    violet: "text-violet-400",
    blue: "text-[#60a5fa]",
    orange: "text-orange-400",
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

export default function SessionStats({ data }: { data: SessionSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Coding Time"
        value={formatHours(data.total_duration_minutes)}
        sub="Total time spent"
        accent="blue"
      />
      <StatCard
        label="Sessions"
        value={data.total_sessions.toString()}
        sub="Coding sessions"
        accent="orange"
      />
      <StatCard
        label="Avg Duration"
        value={formatHours(data.average_duration_minutes)}
        sub="Time per session"
        accent="green"
      />
    </div>
  );
}
