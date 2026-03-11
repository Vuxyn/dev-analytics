"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const params = useParams();
  const username = params?.username as string | undefined;

  const navItems = username
    ? [
        { href: `/u/${username}`, label: "Overview", exact: true },
        { href: `/u/${username}/repos`, label: "Repositories", exact: false },
      ]
    : [{ href: "/", label: "Home", exact: true }];

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-md bg-[#0a0a0f]/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-6 h-6 rounded-md bg-violet-500/20 border border-violet-500/30 flex items-center justify-center group-hover:bg-violet-500/30 transition-colors">
              <div className="w-2 h-2 rounded-sm bg-violet-400" />
            </div>
            <span className="font-mono text-sm font-medium text-white">
              dev<span className="text-violet-400">.</span>analytics
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                    isActive
                      ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-soft" />
            <span className="hidden sm:inline-block text-xs text-zinc-500 font-mono">live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
