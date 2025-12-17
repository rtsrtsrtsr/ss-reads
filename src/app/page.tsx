/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: "Read" | "Current" | "Archived";
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
    <span className={`inline-flex items-center rounded-full border bg-slate-950 px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

export default function HomePage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);

  const [books, setBooks] = useState<Book[]>([]);
  const [current, setCurrent] = useState<Book | null>(null);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [msg, setMsg] = useState("");

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

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (user?.id && user.email) setMe({ id: user.id, email: user.email });
    else setMe(null);

    // Bookshelf should only be Current + Read
    const b = await supabase
      .from("books")
      .select("id,title,author,cover_url,status")
      .in("status", ["Current", "Read"])
      .order("status", { ascending: true }); // Current often sorts before Read depending on DB; we'll handle anyway

    if (b.error) {
      setMsg(`Could not load books: ${b.error.message}`);
      return;
    }

    const list = (b.data ?? []) as any as Book[];
    const cur = list.find((x) => x.status === "Current") ?? null;
    const rest = list.filter((x) => x.status !== "Current");
    setCurrent(cur);
    setBooks(rest);

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
            <div className="text-2xl font-semibold tracking-tight">Sourcing Sprints Reads</div>
            <div className="text-sm text-slate-400">ratings & reviews from the team</div>
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
              <Link href={`/book/${current.id}`} className="text-sm underline text-slate-300 hover:text-white transition">
                Open →
              </Link>
            ) : null}
          </div>

          {!current ? (
            <div className="mt-6 text-slate-400">No current book set.</div>
          ) : (
            <Link
              href={`/book/${current.id}`}
              className="mt-6 flex gap-4 items-center group"
            >
              <div className="w-20 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_0_25px_rgba(0,0,0,0.45)] group-hover:shadow-[0_0_35px_rgba(34,211,238,0.15)] transition">
                {current.cover_url ? (
                  <img src={current.cover_url} alt={current.title} className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="text-xl font-semibold tracking-tight group-hover:text-white transition">
                  {current.title}
                </div>
                <div className="text-slate-400">{current.author}</div>
                <div className="mt-2 text-sm text-slate-300">
                  Click to see reviews and add yours ✨
                </div>
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

      {/* Bookshelf */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-cyan-200">▦</span> Bookshelf
          </h2>
          <div className="text-sm text-slate-400">past reads (and current lives above)</div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map((b) => (
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
                <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-[2/3]">
                  {b.cover_url ? (
                    <img
                      src={b.cover_url}
                      alt={b.title}
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs text-slate-500">
                      No cover
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="font-medium text-slate-100 truncate group-hover:text-white transition">
                    {b.title}
                  </div>
                  <div className="text-sm text-slate-400 truncate">{b.author}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {books.length === 0 ? (
          <div className="mt-5 text-slate-400">No past books yet.</div>
        ) : null}
      </section>
    </main>
  );
}
