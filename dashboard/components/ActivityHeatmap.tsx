"use client";

type HeatmapEntry = {
  date: string;
  commits: number;
  lines_added: number;
  lines_removed: number;
};

function getIntensity(commits: number, max: number): number {
  if (commits === 0) return 0;
  const ratio = commits / max;
  if (ratio < 0.2) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.6) return 3;
  if (ratio < 0.8) return 4;
  return 5;
}

const intensityColors: Record<number, string> = {
  0: "bg-white/5",
  1: "bg-violet-900/40",
  2: "bg-violet-700/50",
  3: "bg-violet-600/60",
  4: "bg-violet-500/75",
  5: "bg-violet-400",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

export default function ActivityHeatmap({ data }: { data: HeatmapEntry[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-[#55556a] text-sm font-mono">
        belum ada data
      </div>
    );
  }

  const maxCommits = Math.max(...data.map((d) => d.commits), 1);

  // Build grid: 52 minggu x 7 hari
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  // Map data ke date string
  const dataMap = new Map<string, HeatmapEntry>();
  data.forEach((d) => dataMap.set(d.date, d));

  // Build weeks array
  const weeks: { date: Date; entry: HeatmapEntry | null }[][] = [];
  let currentWeek: { date: Date; entry: HeatmapEntry | null }[] = [];

  const cursor = new Date(startDate);
  // Mulai dari hari Minggu
  cursor.setDate(cursor.getDate() - cursor.getDay());

  while (cursor <= today) {
    const dateStr = cursor.toISOString().split("T")[0];
    const entry = dataMap.get(dateStr) || null;
    currentWeek.push({ date: new Date(cursor), entry });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: new Date(cursor), entry: null });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(currentWeek);
  }

  // Month labels
  const monthLabels: { label: string; col: number }[] = [];
  weeks.forEach((week, i) => {
    const firstDay = week[0].date;
    if (firstDay.getDate() <= 7) {
      monthLabels.push({ label: MONTHS[firstDay.getMonth()], col: i });
    }
  });

  return (
    <div className="space-y-3">
      {/* Month labels */}
      <div className="flex gap-[3px] ml-8">
        {weeks.map((_, i) => {
          const label = monthLabels.find((m) => m.col === i);
          return (
            <div key={i} className="w-[13px] text-[9px] text-[#55556a] font-mono">
              {label?.label ?? ""}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] mr-1">
          {DAYS.map((day, i) => (
            <div key={i} className="h-[13px] text-[9px] text-[#55556a] font-mono leading-[13px]">
              {day}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                const intensity = day.entry
                  ? getIntensity(day.entry.commits, maxCommits)
                  : 0;
                const isFuture = day.date > today;
                return (
                  <div
                    key={di}
                    title={
                      day.entry
                        ? `${day.date.toISOString().split("T")[0]}: ${day.entry.commits} commits, +${day.entry.lines_added} -${day.entry.lines_removed}`
                        : day.date.toISOString().split("T")[0]
                    }
                    className={`w-[13px] h-[13px] rounded-[2px] transition-transform hover:scale-125 cursor-default
                      ${isFuture ? "opacity-0" : intensityColors[intensity]}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[10px] text-[#55556a] font-mono">less</span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-[11px] h-[11px] rounded-[2px] ${intensityColors[i]}`}
          />
        ))}
        <span className="text-[10px] text-[#55556a] font-mono">more</span>
      </div>
    </div>
  );
}
