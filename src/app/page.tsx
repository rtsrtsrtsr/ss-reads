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
  // may or may not exist in your DB; we handle safely
  date_added?: string | null;
};

type Proposal = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  created_at: string;
  is_active: boolean;
};

type Vote = {
  id: string;
  proposal_id: string;
  user_id: string;
};

function GlowCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
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
    <span
      className={`inline-flex items-center rounded-full border bg-slate-950 px-2 py-0.5 text-xs ${cls}`}
    >
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

  const [booksRaw, setBooksRaw] = useState<Book[]>([]);
  const [current, setCurrent] = useState<Book | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [msg, setMsg] = useState("");

  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // review aggregates per book
  const [reviewAgg, setReviewAgg] = useState<
    Record<string, { count: number; avg: number | null }>
  >({});

  const voteCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of votes) map[v.proposal_id] = (map[v.proposal_id] ?? 0) + 1;
    return map;
  }, [votes]);

  const topProposals = useMemo(() => {
    return [...proposals]
      .sort((a, b) => {
        const ca = voteCounts[a.id] ?? 0;
        const cb = voteCounts[b.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, 3);
  }, [proposals, voteCounts]);

  const booksSorted = useMemo(() => {
    const list = [...booksRaw];

    if (sortMode === "most_read") {
      list.sort((a, b) => {
        const ca = reviewAgg[a.id]?.count ?? 0;
        const cb = reviewAgg[b.id]?.count ?? 0;
        if (cb !== ca) return cb - ca;
        // tie-break: newest
        return safeDateMs(b.date_added) - safeDateMs(a.date_added);
      });
      return list;
    }

    if (sortMode === "highest_rated") {
      list.sort((a, b) => {
        const aa = reviewAgg[a.id]?.avg ?? -1;
        const bb = reviewAgg[b.id]?.avg ?? -1;
        if (bb !== aa) return bb - aa;
        // tie-break: more reviews
        const ca = reviewAgg[a.id]?.count ?? 0;
        const cb = reviewAgg[b.id]?.count ?? 0;
        if (cb !== ca) return cb - ca;
        // tie-break: newest
        return safeDateMs(b.date_added) - safeDateMs(a.date_added);
      });
      return list;
    }

    // default newest
    list.sort((a, b) => safeDateMs(b.date_added) - safeDateMs(a.date_added));
    return list;
  }, [booksRaw, reviewAgg, sortMode]);

  async function loadBooks() {
    // We *try* to select date_added (common), but if your DB doesn't have it,
    // we retry without it to avoid breaking the page.
    const attempt = await supabase
      .from("books")
      .select("id,title,author,cover_url,status,date_added")
      .in("status", ["Current", "Read"]);

    if (!attempt.error) {
      return (attempt.data ?? []) as any as Book[];
    }

    // fallback
    const fallback = await supabase
      .from("books")
      .select("id,title,author,cover_url,status")
      .in("status", ["Current", "Read"]);

    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []) as any as Book[];
  }

  async function loadReviewAgg(bookIds: string[]) {
    if (!bookIds.length) {
      setReviewAgg({});
      return;
    }

    // Pull ratings; compute avg + counts on client (simple + reliable)
    const r = await supabase
      .from("reviews")
      .select("book_id,rating")
      .in("book_id", bookIds);

    if (r.error) {
      // Don’t hard-fail the whole home page if reviews query fails
      setReviewAgg({});
      return;
    }

    const map: Record<string, { count: number; sum: number; ratedCount: number }> = {};
    for (const row of (r.data ?? []) as any[]) {
      const bid = row.book_id as string;
      if (!map[bid]) map[bid] = { count: 0, sum: 0, ratedCount: 0 };
      map[bid].count += 1;
      if (typeof row.rating === "number") {
        map[bid].sum += row.rating;
        map[bid].ratedCount += 1;
      }
    }

    const out: Record<string, { count: number; avg: number | null }> = {};
    for (const bid of bookIds) {
      const m = map[bid];
      if (!m) out[bid] = { count: 0, avg: null };
      else out[bid] = { count: m.count, avg: m.ratedCount ? m.sum / m.ratedCount : null };
    }
    setReviewAgg(out);
  }

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (user?.id && user.email) setMe({ id: user.id, email: user.email });
    else setMe(null);

    try {
      const list = await loadBooks();

      // feature current, but ALSO keep it in bookshelf list (as you wanted)
      const cur = list.find((x) => x.status === "Current") ?? null;
      setCurrent(cur);
      setBooksRaw(list);

      await loadReviewAgg(list.map((b) => b.id));
    } catch (e: any) {
      setMsg(`Could not load books: ${e?.message ?? String(e)}`);
      return;
    }

    const p = await supabase
      .from("book_proposals")
      .select("id,title,author,cover_url,created_at,is_active")
      .eq("is_active", true);
    if (!p.error) setProposals((p.data ?? []) as any);

    const v = await supabase.from("book_votes").select("id,proposal_id,user_id");
    if (!v.error) setVotes((v.data ?? []) as any);
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-[0_0_20px_rgba(34,211,238,0.12)] grid place-items-center">
            <span className="text-cyan-200">📚</span>
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">SourceSprints Reads</div>
            <div className="text-sm text-slate-400">cute little internal bookshelf</div>
          </div>
        </Link>

        <nav className="text-sm text-slate-300 flex flex-wrap items-center gap-4">
          <Link className="underline hover:text-white transition" href="/inbox">
            Inbox
          </Link>
          <Link className="underline hover:text-white transition" href="/up-next">
            Up Next
          </Link>
          <Link className="underline hover:text-white transition" href="/admin">
            Admin
          </Link>
          {!me ? (
            <Link className="underline hover:text-white transition" href="/login">
              Login
            </Link>
          ) : (
            <>
              <span className="text-slate-400 hidden sm:inline">
                Logged in as <span className="text-slate-200">{me.email}</span>
              </span>
              <button onClick={signOut} className="underline hover:text-white transition">
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>

      {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

      {/* Top row: Current + Up Next */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill tone="cyan">■ Current</Pill>
              <span className="text-slate-400 text-sm">what we’re reading now</span>
            </div>
            {current ? (
              <Link
                href={`/book/${current.id}`}
                className="text-sm underline text-slate-300 hover:text-white transition"
              >
                Open →
              </Link>
            ) : null}
          </div>

          {!current ? (
            <div className="mt-6 text-slate-400">No current book set.</div>
          ) : (
            <Link href={`/book/${current.id}`} className="mt-6 flex gap-4 items-center group">
              <div className="w-20 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_0_25px_rgba(0,0,0,0.45)] group-hover:shadow-[0_0_35px_rgba(34,211,238,0.15)] transition">
                {current.cover_url ? (
                  <img src={current.cover_url} alt={current.title} className="h-full w-full object-cover" />
                ) : null}
              </div>

			{(() => {
			  const agg = reviewAgg[current.id];
			  const avgText = agg?.avg == null ? "—" : agg.avg.toFixed(1);
			  const count = agg?.count ?? 0;

			  return (
				<div className="mt-2 flex items-center gap-2">
				  <Pill tone="cyan">⭐ {avgText}</Pill>
				  <Pill>
					{count} review{count === 1 ? "" : "s"}
				  </Pill>
				</div>
			  );
			})()}

              </div>
            </Link>
          )}
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill tone="cyan">⏭ Up Next</Pill>
              <span className="text-slate-400 text-sm">top proposals</span>
            </div>
            <Link href="/up-next" className="text-sm underline text-slate-300 hover:text-white transition">
              Vote →
            </Link>
          </div>

          {topProposals.length === 0 ? (
            <div className="mt-6 text-slate-400">No proposals yet. Add one on the Up Next page.</div>
          ) : (
            <div className="mt-6 space-y-3">
              {topProposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-[0_0_25px_rgba(0,0,0,0.35)]"
                >
                  <div className="w-12 aspect-[2/3] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                    {p.cover_url ? <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-100 truncate">{p.title}</div>
                    <div className="text-sm text-slate-400 truncate">{p.author}</div>
                  </div>
                  <Pill tone="cyan">{voteCounts[p.id] ?? 0} votes</Pill>
                </div>
              ))}
            </div>
          )}
        </GlowCard>
      </section>

      {/* Bookshelf + Sort */}
      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <span className="text-cyan-200">▦</span> Bookshelf
            </h2>
            <div className="text-sm text-slate-400">current + past reads</div>
          </div>

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
            const agg = reviewAgg[b.id] ?? { count: 0, avg: null };
            return (
              <Link key={b.id} href={`/book/${b.id}`} className="group">
                <div
                  className="
                    rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur
                    p-3
                    shadow-[0_0_30px_rgba(0,0,0,0.35)]
                    hover:shadow-[0_0_45px_rgba(34,211,238,0.18)]
                    transition
                  "
                >
                  <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[2/3]">
                    {b.cover_url ? (
                      <img
                        src={b.cover_url}
                        alt={b.title}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-500">No cover</div>
                    )}

                    {/* top-left badge */}
                    {b.status === "Current" ? (
                      <div className="absolute top-2 left-2">
                        <Pill tone="cyan">Current</Pill>
                      </div>
                    ) : null}

                    {/* bottom overlay stats */}
                    <div className="absolute left-2 right-2 bottom-2 flex gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-xs text-slate-200">
                        ⭐ {agg.avg != null ? agg.avg.toFixed(1) : "—"}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/90 px-2 py-0.5 text-xs text-slate-200">
                        {agg.count} review{agg.count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="font-medium text-slate-100 truncate group-hover:text-white transition">
                      {b.title}
                    </div>
                    <div className="text-sm text-slate-400 truncate">{b.author}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {booksSorted.length === 0 ? <div className="mt-5 text-slate-400">No books yet.</div> : null}
      </section>
    </main>
  );
}
