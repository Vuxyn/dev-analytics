"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [username, setUsername] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      router.push(`/u/${username.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-fade-up">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-6">
          <div className="w-6 h-6 rounded-md bg-violet-400 opacity-90" />
        </div>
        <h1 className="text-4xl font-semibold text-white tracking-tight">
          dev<span className="text-violet-400">.</span>analytics
        </h1>
        <p className="text-zinc-400 max-w-md mx-auto">
          Enter a GitHub username to view their coding analytics, commits, languages, and coding sessions.
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-sm flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="GitHub Username"
          required
          autoFocus
          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all font-mono"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors"
        >
          View
        </button>
      </form>

      <div className="pt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center max-w-3xl mx-auto w-full">
        <div className="card p-6 border-white/5">
          <h3 className="text-white font-medium mb-2">Zero-Config SaaS</h3>
          <p className="text-sm text-zinc-500">A seamless integration to sync your work in seconds.</p>
        </div>
        <div className="card p-6 border-white/5">
          <h3 className="text-white font-medium mb-2">Privacy First</h3>
          <p className="text-sm text-zinc-500">Auto-PIN security blocks anyone else from sending spam to your analytics.</p>
        </div>
        <div className="card p-6 border-white/5">
          <h3 className="text-white font-medium mb-2">Detailed Tracking</h3>
          <p className="text-sm text-zinc-500">View language stats, active coding hours, and multi-branch repo insights.</p>
        </div>
      </div>
    </div>
  );
}
