"use client";

import type { GithubUser, GithubRepo } from "@/lib/github";
import Link from "next/link";

type LanguageCount = { language: string; count: number };

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function GithubPreview({
  user,
  repos,
  languages,
}: {
  user: GithubUser;
  repos: GithubRepo[];
  languages: LanguageCount[];
}) {
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const maxCount = Math.max(...languages.map((l) => l.count), 1);

  const LANG_COLORS: Record<string, string> = {
    TypeScript: "#3178c6", JavaScript: "#f7df1e", Python: "#3572a5",
    Rust: "#dea584", Go: "#00add8", Java: "#b07219", "C++": "#f34b7d",
    C: "#555555", Shell: "#89e051", HTML: "#e34c26", CSS: "#563d7c",
    Ruby: "#701516", PHP: "#4f5d95", Swift: "#ffac45", Kotlin: "#a97bff",
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Banner */}
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 flex items-start gap-3">
        <span className="text-yellow-400 text-lg mt-0.5">⚡</span>
        <div>
          <p className="text-sm text-yellow-300 font-medium">Mode Preview GitHub</p>
          <p className="text-xs text-yellow-400/70 mt-0.5">
            Menampilkan data publik dari GitHub API.{" "}
            <a href="https://github.com/Vuxyn/dev-analytics#install" className="underline hover:text-yellow-300">
              Pasang collector
            </a>{" "}
            untuk data yang lebih detail (lines changed, sessions, heatmap, dll).
          </p>
        </div>
      </div>

      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <img
          src={user.avatar_url}
          alt={user.login}
          className="w-16 h-16 rounded-full border border-white/10"
        />
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {user.name || user.login}
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">{user.bio || `@${user.login} on GitHub`}</p>
        </div>
        <a
          href={user.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="sm:ml-auto text-xs text-violet-400 border border-violet-500/30 px-3 py-1.5 rounded-lg hover:bg-violet-500/10 transition-colors"
        >
          Lihat GitHub →
        </a>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Public Repos", value: user.public_repos, color: "text-violet-400" },
          { label: "Total Stars", value: totalStars, color: "text-yellow-400" },
          { label: "Followers", value: user.followers, color: "text-blue-400" },
          { label: "Following", value: user.following, color: "text-green-400" },
        ].map((s) => (
          <div key={s.label} className="card p-4 space-y-1.5">
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">{s.label}</p>
            <p className={`text-xl font-semibold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Language Distribution */}
      {languages.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-medium text-white">Bahasa Pemrograman</h2>
          <div className="space-y-2.5">
            {languages.slice(0, 8).map(({ language, count }) => {
              const color = LANG_COLORS[language] || "#7c7c8a";
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={language} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{language}</span>
                    <span className="text-zinc-500">{count} repos</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Repos */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-medium text-white">Repository Terbaru</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {repos.slice(0, 6).map((repo) => (
            <a
              key={repo.id}
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group"
            >
              <div className="card p-4 space-y-2 group-hover:border-violet-500/20 transition-all">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-violet-400/60 group-hover:bg-violet-400 transition-colors shrink-0" />
                  <span className="text-sm font-mono text-white font-medium truncate">{repo.name}</span>
                </div>
                {repo.description && (
                  <p className="text-xs text-zinc-500 pl-4 truncate">{repo.description}</p>
                )}
                <div className="flex items-center gap-3 pl-4 text-xs text-zinc-500">
                  {repo.language && (
                    <span
                      className="flex items-center gap-1"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: LANG_COLORS[repo.language] || "#7c7c8a" }}
                      />
                      {repo.language}
                    </span>
                  )}
                  <span>⭐ {repo.stargazers_count}</span>
                  <span className="ml-auto">{formatDate(repo.pushed_at)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
