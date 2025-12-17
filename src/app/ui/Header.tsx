"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        "text-sm transition",
        active ? "text-cyan-200" : "text-slate-300 hover:text-white",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function Header() {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="
              h-9 w-9 rounded-xl
              border border-slate-800
              bg-slate-900
              grid place-items-center
              shadow-[0_0_20px_rgba(34,211,238,0.12)]
              group-hover:shadow-[0_0_30px_rgba(34,211,238,0.25)]
              transition
            "
          >
            <span className="text-cyan-200">📚</span>
          </div>

          <div className="leading-tight">
            <div className="font-semibold tracking-tight">SourcingSprints Reading</div>
            <div className="text-xs text-slate-400">ratings &amp; reviews from the team</div>
          </div>
        </Link>

        <nav className="flex items-center gap-5">
          <NavLink href="/" label="Home" />
          <NavLink href="/inbox" label="Inbox" />
          <NavLink href="/up-next" label="Up Next" />
          <NavLink href="/stats" label="Stats" />
          <NavLink href="/admin" label="Admin" />

          <button
            onClick={signOut}
            className="
              ml-2 rounded-xl
              border border-slate-700 bg-slate-950
              px-3 py-1.5 text-sm text-slate-200
              hover:border-slate-500 hover:text-white
              hover:shadow-[0_0_20px_rgba(255,255,255,0.12)]
              transition
            "
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
