"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "rounded-3xl border border-slate-800 bg-slate-900/70 backdrop-blur",
        "shadow-[0_0_40px_rgba(0,0,0,0.35)] hover:shadow-[0_0_60px_rgba(0,0,0,0.55)] transition",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
      {children}
    </span>
  );
}

export default function StatsPage() {
  const [msg, setMsg] = useState("");
  const [booksCountRead, setBooksCountRead] = useState(0);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  const [leaderMostReviews, setLeaderMostReviews] = useState<{ name: string; count: number }[]>([]);
  const [leaderHighestAvg, setLeaderHighestAvg] = useState<{ name: string; avg: number; count: number }[]>([]);
  const [leaderLowestAvg, setLeaderLowestAvg] = useState<{ name: string; avg: number; count: number }[]>([]);

  useEffect(() => {
    async function load() {
      setMsg("");

      // 1) books read
      const b = await supabase.from("books").select("id,status");
      if (b.error) return setMsg(b.error.message);

      const books = (b.data ?? []) as any[];
      setBooksCountRead(books.filter((x) => x.status === "Read").length);

      // 2) reviews (team avg + leaderboards)
      const r = await supabase.from("reviews").select("user_id,rating");
      if (r.error) return setMsg(r.error.message);

      const reviews = (r.data ?? []) as any[];
      const rated = reviews.filter((x) => typeof x.rating === "number");

      if (!rated.length) {
        setTeamAvg(null);
        setLeaderMostReviews([]);
        setLeaderHighestAvg([]);
        setLeaderLowestAvg([]);
        return;
      }

      const overall = rated.reduce((acc, x) => acc + x.rating, 0) / rated.length;
      setTeamAvg(overall);

      // group per user
      const byUser: Record<string, { sum: number; count: number }> = {};
      for (const row of rated) {
        const uid = row.user_id as string;
        if (!byUser[uid]) byUser[uid] = { sum: 0, count: 0 };
        byUser[uid].sum += row.rating;
        byUser[uid].count += 1;
      }

      const userIds = Object.keys(byUser);
      const p = await supabase.from("profiles").select("id,display_name,email").in("id", userIds);
      if (p.error) return setMsg(p.error.message);

      const nameMap: Record<string, string> = {};
      for (const row of (p.data ?? []) as any[]) {
        nameMap[row.id] = row.display_name || (row.email ? String(row.email).split("@")[0] : "someone");
      }

      const rows = userIds.map((id) => {
        const { sum, count } = byUser[id];
        return { id, name: nameMap[id] || "someone", count, avg: sum / count };
      });

      // leaderboards
      const most = [...rows].sort((a, b) => b.count - a.count).slice(0, 5);
      setLeaderMostReviews(most.map((x) => ({ name: x.name, count: x.count })));

      // Only include people with at least 2 ratings for avg leaderboards (prevents 1-review flukes)
      const eligible = rows.filter((x) => x.count >= 2);

      const highest = [...eligible].sort((a, b) => b.avg - a.avg).slice(0, 5);
      setLeaderHighestAvg(highest.map((x) => ({ name: x.name, avg: x.avg, count: x.count })));

      const lowest = [...eligible].sort((a, b) => a.avg - b.avg).slice(0, 5);
      setLeaderLowestAvg(lowest.map((x) => ({ name: x.name, avg: x.avg, count: x.count })));
    }

    load();
  }, []);

  const teamAvgText = useMemo(() => (teamAvg == null ? "—" : teamAvg.toFixed(2)), [teamAvg]);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Stats</div>
          <div className="text-sm text-slate-400">fun little team leaderboards</div>
        </div>
        <nav className="text-sm text-slate-300 flex flex-wrap items-center gap-4">
          <Link className="underline hover:text-white transition" href="/">
            Bookshelf
          </Link>
          <Link className="underline hover:text-white transition" href="/up-next">
            Up Next
          </Link>
          <Link className="underline hover:text-white transition" href="/inbox">
            Inbox
          </Link>
          <Link className="underline hover:text-white transition" href="/admin">
            Admin
          </Link>
        </nav>
      </header>

      {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

      <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlowCard className="p-6">
          <div className="text-sm text-slate-400">Team avg rating</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight">
            <span className="text-cyan-200">⭐</span> {teamAvgText}
          </div>
          <div className="mt-2 text-sm text-slate-500">Across all ratings</div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="text-sm text-slate-400">Books read</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight">{booksCountRead}</div>
          <div className="mt-2 text-sm text-slate-500">Status = Read</div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="text-sm text-slate-400">Vibe metric</div>
          <div className="mt-2 text-4xl font-semibold tracking-tight">✨</div>
          <div className="mt-2 text-sm text-slate-500">Coming soon: “most helpful commenter”</div>
        </GlowCard>
      </section>

      <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Most books reviewed</div>
            <Pill>volume</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {leaderMostReviews.length ? (
              leaderMostReviews.map((x, i) => (
                <div key={x.name} className="flex items-center justify-between text-slate-200">
                  <div className="text-sm">
                    <span className="text-slate-500 mr-2">#{i + 1}</span>
                    {x.name}
                  </div>
                  <div className="text-sm text-slate-400">{x.count}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">No data yet.</div>
            )}
          </div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Highest average ratings</div>
            <Pill>taste</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {leaderHighestAvg.length ? (
              leaderHighestAvg.map((x, i) => (
                <div key={x.name} className="flex items-center justify-between text-slate-200">
                  <div className="text-sm">
                    <span className="text-slate-500 mr-2">#{i + 1}</span>
                    {x.name} <span className="text-slate-500">({x.count})</span>
                  </div>
                  <div className="text-sm text-slate-400">⭐ {x.avg.toFixed(2)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">Needs at least 2 ratings per person.</div>
            )}
          </div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Lowest average ratings</div>
            <Pill>harsh</Pill>
          </div>
          <div className="mt-4 space-y-2">
            {leaderLowestAvg.length ? (
              leaderLowestAvg.map((x, i) => (
                <div key={x.name} className="flex items-center justify-between text-slate-200">
                  <div className="text-sm">
                    <span className="text-slate-500 mr-2">#{i + 1}</span>
                    {x.name} <span className="text-slate-500">({x.count})</span>
                  </div>
                  <div className="text-sm text-slate-400">⭐ {x.avg.toFixed(2)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">Needs at least 2 ratings per person.</div>
            )}
          </div>
        </GlowCard>
      </section>
    </main>
  );
}
