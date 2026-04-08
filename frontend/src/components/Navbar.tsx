"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();

  const linkClasses = (href: string) => {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `text-sm font-medium transition-all duration-200 ${
      isActive
        ? "text-white"
        : "text-slate-400 hover:text-white"
    }`;
  };

  return (
    <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="h-7 w-7 rounded-md bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-500 transition-all duration-200">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">
            Fin<span className="text-indigo-400">Sight</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6">
          <Link href="/" className={linkClasses("/")}>
            Analyze
          </Link>
          <Link href="/history" className={linkClasses("/history")}>
            History
          </Link>
        </div>
      </div>
    </nav>
  );
}
