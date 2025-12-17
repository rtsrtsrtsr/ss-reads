/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SortMode = "newest" | "most_read" | "highest_rated";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: "Read" | "Current" | "Archived";
  date_added?: string | null;
};

type ReviewAgg = {
  count: number;
  avg: number | null;
};

type ReadingRow = {
  user_id: string;
  status: string;
};

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

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "cyan";
}) {
  const cls =
    tone === "cyan"
      ? "border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]"
      : "border-slate-700 text-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border bg-slate-950 px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

function safeDateMs(s?: string | null) {
  if (!s) return 0;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function HomePage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [current, setCurrent] = useState<Book | null>(null);

  const [reviewAgg, setReviewAgg] = useState<Record<string, ReviewAgg>>({});
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const [inCount, setInCount] = useState(0);
  const [amIIn, setAmIIn] = useState(false);

  const [msg, setMsg] = useState("");

  const booksSorted = useMemo(() => {
    const list = [...books];

    if (sortMode === "most_read") {
      list.sort((a, b) => {
        const ca = reviewAgg[a.id]?.count ?? 0;
        const cb = reviewAgg[b.id]?.count ?? 0;
        if (cb !== ca) return cb - ca;
        return safeDateMs(b.date_added) - safeDateMs(a.date_added);
      });
      return list;
    }

    if (sortMode === "highest_rated") {
      list.sort((a, b) => {
        const aa = reviewAgg[a.id]?.avg ?? -1;
        const bb = reviewAgg[b.id]?.avg ?? -1;
        if (bb !== aa) return bb - aa;
        return safeDateMs(b.date_added) - safeDateMs(a.date_added);
      });
      return list;
    }

    list.sort((a, b) => safeDateMs(b.date_added) - safeDateMs(a.date_added));
    return list;
  }, [books, reviewAgg, sortMode]);

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (user?.id && user.email) setMe({ id: user.id, email: user.email });
    else setMe(null);

    const b = await supabase
      .from("books")
      .select("id,title,author,cover_url,status,date_added")
      .in("status", ["Current", "Read"]);

    if (b.error) return setMsg(b.error.message);

    const list = (b.data ?? []) as Book[];
    setBooks(list);

    const cur = list.find((x) => x.status === "Current") ?? null;
    setCurrent(cur);

    if (list.length) {
      const r = await supabase.from("reviews").select("book_id,rating").in(
        "book_id",
        list.map((x) => x.id)
      );

      if (!r.error) {
        const tmp: Record<string, { sum: number; count: number }> = {};
        for (const row of r.data ?? []) {
          const bid = row.book_id;
          if (!tmp[bid]) tmp[bid] = { sum: 0, count: 0 };
          if (typeof row.rating === "number") {
            tmp[bid].sum += row.rating;
            tmp[bid].count += 1;
          }
        }

        const agg: Record<string, ReviewAgg> = {};
        for (const book of list) {
          const m = tmp[book.id];
          agg[book.id] = m ? { avg: m.sum / m.count, count: m.count } : { avg: null, count: 0 };
        }
        setReviewAgg(agg);
      }
    }

    if (cur && user?.id) {
      const rs = await supabase
        .from("ReadingStatus")
        .select("user_id,status")
        .eq("book_id", cur.id);

      if (!rs.error) {
        const rows = (rs.data ?? []) as ReadingRow[];
        const ins = rows.filter((r) => r.status === "In");
        setInCount(ins.length);
        setAmIIn(ins.some((r) => r.user_id === user.id));
      }
    }
  }

  async function toggleImIn() {
    if (!me || !current) return;

    const next = amIIn ? "Out" : "In";
    const up = await supabase.from("ReadingStatus").upsert(
      {
        book_id: current.id,
        user_id: me.id,
        status: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,user_id" }
    );

    if (!up.error) load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">SourceSprints Reads</div>
          <div className="text-sm text-slate-400">internal bookshelf</div>
        </div>
        <nav className="flex gap-4 text-sm text-slate-300">
          <Link href="/up-next" className="underline hover:text-white">
            Up Next
          </Link>
          <Link href="/stats" className="underline hover:text-white">
            Stats
          </Link>
        </nav>
      </header>

      {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

      {/* Current */}
      <section className="mt-8">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <Pill tone="cyan">Current</Pill>
            {current && (
              <Link href={`/book/${current.id}`} className="underline text-sm">
                Open →
              </Link>
            )}
          </div>

          {!current ? (
            <div className="mt-4 text-slate-400">No current book.</div>
          ) : (
            (() => {
              const agg = reviewAgg[current.id] ?? { avg: null, count: 0 };
              return (
                <div className="mt-6 flex gap-4 items-center">
                  <div className="w-20 aspect-[2/3] rounded-xl overflow-hidden border border-slate-800">
                    {current.cover_url && (
                      <img src={current.cover_url} alt={current.title} className="h-full w-full object-cover" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-xl font-semibold">{current.title}</div>
                    <div className="text-slate-400">{current.author}</div>

                    <div className="mt-2 flex items-center gap-2">
                      <Pill tone="cyan">⭐ {agg.avg == null ? "—" : agg.avg.toFixed(1)}</Pill>
                      <Pill>{agg.count} reviews</Pill>
                      <Pill>👥 {inCount} in</Pill>
                    </div>
                  </div>

                  {me && (
                    <button
                      onClick={toggleImIn}
                      className={[
                        "rounded-xl border px-3 py-1.5 transition",
                        amIIn
                          ? "bg-slate-100 text-slate-950"
                          : "bg-slate-950 text-slate-100 border-cyan-500/40",
                      ].join(" ")}
                    >
                      {amIIn ? "✓ You're in" : "I'm in"}
                    </button>
                  )}
                </div>
              );
            })()
          )}
        </GlowCard>
      </section>

      {/* Bookshelf */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Bookshelf</h2>
          <select
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="newest">Newest First</option>
            <option value="most_read">Most Read</option>
            <option value="highest_rated">Highest Rated</option>
          </select>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {booksSorted.map((b) => {
            const agg = reviewAgg[b.id] ?? { avg: null, count: 0 };
            return (
              <Link key={b.id} href={`/book/${b.id}`} className="group">
                <div className="rounded-3xl border border-slate-800 bg-slate-900 p-3 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border border-slate-800">
                    {b.cover_url && (
                      <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="mt-3">
                    <div className="font-medium truncate">{b.title}</div>
                    <div className="text-sm text-slate-400 truncate">{b.author}</div>
                    <div className="mt-1 text-xs text-slate-300">
                      ⭐ {agg.avg == null ? "—" : agg.avg.toFixed(1)} · {agg.count}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
