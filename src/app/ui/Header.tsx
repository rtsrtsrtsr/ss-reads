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

// Reading status — reusing your existing table
type ReadingStatusValue = "In" | "Reading" | "Finished" | "Out";

type ReadingRow = {
  user_id: string;
  status: string; // keep loose in case old values exist
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

  // ReadingStatus state (reused)
  const [inCount, setInCount] = useState(0);
  const [myStatus, setMyStatus] = useState<ReadingStatusValue>("Out");

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

  async function loadReadingStatusForCurrent(curBookId: string, userId?: string) {
    // Pull all statuses for the current book (so we can count "In")
    const rs = await supabase.from("ReadingStatus").select("user_id,status").eq("book_id", curBookId);

    if (rs.error) {
      setInCount(0);
      setMyStatus("Out");
      return;
    }

    const rows = (rs.data ?? []) as ReadingRow[];

    // Count only people who are explicitly "In"
    setInCount(rows.filter((r) => r.status === "In").length);

    if (!userId) {
      setMyStatus("Out");
      return;
    }

    const mine = rows.find((r) => r.user_id === userId);
    const val = (mine?.status ?? "Out") as ReadingStatusValue;

    // guard: if something older/weird exists, treat as Out
    const allowed: ReadingStatusValue[] = ["In", "Reading", "Finished", "Out"];
    setMyStatus(allowed.includes(val) ? val : "Out");
  }

  async function updateMyStatus(next: ReadingStatusValue) {
    if (!me || !current) return;

    // Upsert into the SAME table the Book page uses
    const up = await supabase
      .from("ReadingStatus")
      .upsert(
        {
          book_id: current.id,
          user_id: me.id,
          status: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "book_id,user_id" }
      );

    if (up.error) {
      setMsg(`Could not update your status: ${up.error.message}`);
      return;
    }

    setMyStatus(next);
    await loadReadingStatusForCurrent(current.id, me.id);
  }

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

    // Reviews → agg
    if (list.length) {
      const r = await supabase
        .from("reviews")
        .select("book_id,rating")
        .in(
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

    // ReadingStatus for Current book
    if (cur) {
      await loadReadingStatusForCurrent(cur.id, user?.id);
    } else {
      setInCount(0);
      setMyStatus("Out");
    }
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
              <Link href={`/book/${current.id}`} className="underline text-sm text-slate-300 hover:text-white transition">
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
                <div className="mt-6 flex flex-wrap gap-4 items-center">
                  <div className="w-20 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_0_25px_rgba(0,0,0,0.45)]">
                    {current.cover_url ? (
                      <img src={current.cover_url} alt={current.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-semibold truncate">{current.title}</div>
                    <div className="text-slate-400 truncate">{current.author}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Pill tone="cyan">⭐ {agg.avg == null ? "—" : agg.avg.toFixed(1)}</Pill>
                      <Pill>
                        {agg.count} review{agg.count === 1 ? "" : "s"}
                      </Pill>
                      <Pill tone="cyan">👥 {inCount} in</Pill>

                      {/* Status picker (reuses ReadingStatus) */}
                      {me ? (
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-sm text-slate-400">Your status:</span>
                          <select
                            className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2"
                            value={myStatus}
                            onChange={(e) => updateMyStatus(e.target.value as ReadingStatusValue)}
                          >
                            <option value="In">In</option>
                            <option value="Reading">Reading</option>
                            <option value="Finished">Finished</option>
                            <option value="Out">Out</option>
                          </select>
                        </div>
                      ) : (
                        <Link
                          href="/login"
                          className="ml-auto text-sm underline text-slate-300 hover:text-white transition"
                        >
                          Log in to set status →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </GlowCard>
      </section>

      {/* Bookshelf */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Bookshelf</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Sort:</span>
            <select
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 px-3 py-2"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="newest">Newest First</option>
              <option value="most_read">Most Read</option>
              <option value="highest_rated">Highest Rated</option>
            </select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {booksSorted.map((b) => {
            const agg = reviewAgg[b.id] ?? { avg: null, count: 0 };

            return (
              <Link key={b.id} href={`/book/${b.id}`} className="group">
                <div
                  className={[
                    "rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur p-3",
                    "shadow-[0_0_30px_rgba(0,0,0,0.35)] hover:shadow-[0_0_45px_rgba(34,211,238,0.18)] transition",
                  ].join(" ")}
                >
                  <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                    {b.cover_url ? (
                      <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-500">No cover</div>
                    )}

                    {b.status === "Current" ? (
                      <div className="absolute top-2 left-2">
                        <Pill tone="cyan">Current</Pill>
                      </div>
                    ) : null}

                    <div className="absolute left-2 right-2 bottom-2 flex gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-xs text-slate-200">
                        ⭐ {agg.avg == null ? "—" : agg.avg.toFixed(1)}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-xs text-slate-200">
                        {agg.count} review{agg.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="font-medium text-slate-100 truncate group-hover:text-white transition">{b.title}</div>
                    <div className="text-sm text-slate-400 truncate">{b.author}</div>
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
