"use client";

type LanguageStat = {
  language: string;
  lines_added: number;
  lines_removed: number;
  total_changes: number;
};

const languageColors: { [key: string]: string } = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Rust: "#dea584",
  "C++": "#f34b7d",
  "C#": "#178600",
  Java: "#b07219",
  PHP: "#4F5D95",
  Ruby: "#701516",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Markdown: "#083fa1",
  SQL: "#e38c00",
  JSON: "#292929",
  YAML: "#cb171e",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  Other: "#8b8b8b",
};

export default function LanguageDistribution({ data }: { data: LanguageStat[] }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.total_changes, 0);
  
  // Sort by percentage and take top 6, group others
  const sorted = [...data].sort((a, b) => b.total_changes - a.total_changes);
  const displayData = sorted.slice(0, 6);
  const others = sorted.slice(6);
  
  if (others.length > 0) {
    const othersTotal = others.reduce((sum, item) => sum + item.total_changes, 0);
    displayData.push({
      language: "Other",
      total_changes: othersTotal,
      lines_added: 0,
      lines_removed: 0
    });
  }

  return (
    <div className="space-y-4">
      {/* Bar */}
      <div className="h-2 w-full flex rounded-full overflow-hidden bg-white/5 border border-white/5">
        {displayData.map((item) => {
          const percentage = (item.total_changes / total) * 100;
          if (percentage < 0.5) return null;
          
          return (
            <div
              key={item.language}
              style={{ 
                width: `${percentage}%`,
                backgroundColor: languageColors[item.language] || languageColors.Other
              }}
              title={`${item.language}: ${percentage.toFixed(1)}%`}
              className="h-full transition-all hover:brightness-125"
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {displayData.map((item) => {
          const percentage = (item.total_changes / total) * 100;
          if (percentage < 1) return null;

          return (
            <div key={item.language} className="flex items-center gap-1.5">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: languageColors[item.language] || languageColors.Other }}
              />
              <span className="text-[11px] font-medium text-[#e2e2e8]">
                {item.language}
              </span>
              <span className="text-[10px] text-[#55556a] font-mono">
                {percentage.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
