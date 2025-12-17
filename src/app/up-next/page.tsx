/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Proposal = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  why_read: string | null;
  created_at: string;
  proposed_by: string;
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
  tone?: "slate" | "cyan" | "yellow" | "red";
}) {
  const cls =
    tone === "cyan"
      ? "border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.18)]"
      : tone === "yellow"
      ? "border-yellow-400/30 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.12)]"
      : tone === "red"
      ? "border-red-400/30 text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.12)]"
      : "border-slate-700 text-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border bg-slate-950 px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

export default function UpNextPage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [msg, setMsg] = useState("");

  // form
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [whyRead, setWhyRead] = useState("");

  const voteCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of votes) map[v.proposal_id] = (map[v.proposal_id] ?? 0) + 1;
    return map;
  }, [votes]);

  const sortedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => {
      const ca = voteCounts[a.id] ?? 0;
      const cb = voteCounts[b.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [proposals, voteCounts]);

  function iVoted(proposalId: string) {
    if (!me) return false;
    return !!votes.find((v) => v.user_id === me.id && v.proposal_id === proposalId);
  }

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user?.id || !user.email) {
      setMe(null);
      setIsAdmin(false);
    } else {
      setMe({ id: user.id, email: user.email });

      const prof = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
      setIsAdmin(!!prof.data?.is_admin);
    }

    const p = await supabase
      .from("book_proposals")
      .select("id,title,author,cover_url,why_read,created_at,proposed_by,is_active")
      .eq("is_active", true);

    if (p.error) return setMsg(`Could not load proposals: ${p.error.message}`);
    setProposals((p.data ?? []) as any);

    const v = await supabase.from("book_votes").select("id,proposal_id,user_id");
    if (v.error) return setMsg(`Could not load votes: ${v.error.message}`);
    setVotes((v.data ?? []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function submitProposal() {
    setMsg("");
    if (!me) return setMsg("Please log in to propose.");

    if (!title.trim() || !author.trim()) {
      return setMsg("Title and Author are required.");
    }

    const ins = await supabase.from("book_proposals").insert({
      title: title.trim(),
      author: author.trim(),
      cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      why_read: whyRead.trim() ? whyRead.trim() : null,
      proposed_by: me.id,
      is_active: true,
    });

    if (ins.error) return setMsg(`Submit failed: ${ins.error.message}`);

    setTitle("");
    setAuthor("");
    setCoverUrl("");
    setWhyRead("");
    setMsg("✅ Proposal submitted");
    await load();
  }

  async function toggleVote(proposalId: string) {
    setMsg("");
    if (!me) return setMsg("Please log in to vote.");

    const existing = votes.find((v) => v.user_id === me.id && v.proposal_id === proposalId);

    if (existing) {
      const del = await supabase.from("book_votes").delete().eq("id", existing.id);
      if (del.error) return setMsg(del.error.message);
    } else {
      const ins = await supabase.from("book_votes").insert({ proposal_id: proposalId, user_id: me.id });
      if (ins.error) return setMsg(ins.error.message);
    }

    await load();
  }

  async function promoteToCurrent(p: Proposal) {
    setMsg("");
    if (!me) return setMsg("Please log in.");
    if (!isAdmin) return setMsg("Admins only.");

    // 1) demote existing Current -> Read
    const demote = await supabase.from("books").update({ status: "Read" }).eq("status", "Current");
    if (demote.error) return setMsg(`Could not demote existing Current: ${demote.error.message}`);

    // 2) create the book as Current
    const ins = await supabase.from("books").insert({
      title: p.title,
      author: p.author,
      cover_url: p.cover_url,
      status: "Current",
    });
    if (ins.error) return setMsg(`Could not create book: ${ins.error.message}`);

    // 3) deactivate proposal
    const upd = await supabase.from("book_proposals").update({ is_active: false }).eq("id", p.id);
    if (upd.error) return setMsg(`Promoted, but could not deactivate proposal: ${upd.error.message}`);

    setMsg("✅ Promoted to Current");
    await load();
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-slate-900 border border-slate-800 shadow-[0_0_20px_rgba(34,211,238,0.12)] grid place-items-center">
            <span className="text-cyan-200">⏭</span>
          </div>
          <div>
            <div className="text-2xl font-semibold tracking-tight">Up Next</div>
            <div className="text-sm text-slate-400">propose + vote on the next book</div>
          </div>
        </div>

        <nav className="text-sm text-slate-300 flex flex-wrap items-center gap-4">
          <Link className="underline hover:text-white transition" href="/">
            Bookshelf
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

      {/* Top row */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill tone="cyan">➕ Propose</Pill>
              <span className="text-sm text-slate-400">add a contender</span>
            </div>
            {me ? <Pill tone="slate">{me.email}</Pill> : <Pill tone="red">Not logged in</Pill>}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <input
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Cover URL (optional)"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
            />
            <textarea
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Why should we read it? (optional)"
              rows={4}
              value={whyRead}
              onChange={(e) => setWhyRead(e.target.value)}
            />

            <button
              onClick={submitProposal}
              className="rounded-xl bg-slate-100 text-slate-950 px-4 py-2 font-medium hover:bg-white transition shadow-[0_0_20px_rgba(255,255,255,0.10)]"
            >
              Submit proposal
            </button>
          </div>
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center gap-3">
            <Pill tone="cyan">🗳 Voting</Pill>
            <span className="text-sm text-slate-400">simple + flexible</span>
          </div>

          <ul className="mt-5 space-y-3 text-slate-200">
            <li className="flex gap-2">
              <span className="text-cyan-200">•</span>
              Vote for any number of proposals (toggle on/off).
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-200">•</span>
              Proposals sort by votes, then newest.
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-200">•</span>
              When we decide, an admin promotes a winner to <Pill tone="cyan">Current</Pill>.
            </li>
          </ul>

          {isAdmin ? (
            <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-950 p-4 shadow-[0_0_20px_rgba(34,211,238,0.10)]">
              <div className="flex items-center justify-between">
                <Pill tone="cyan">Admin</Pill>
                <span className="text-sm text-slate-400">You can promote a proposal below.</span>
              </div>
              <div className="mt-3 text-sm text-slate-300">
                Promoting will:
                <div className="mt-2 space-y-1 text-slate-400">
                  <div>• Move existing Current → Read</div>
                  <div>• Create a new Book as Current</div>
                  <div>• Remove the proposal from Up Next</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 text-sm text-slate-400">
              {me ? "Admins can promote a winner once chosen." : "Log in to vote and propose."}
            </div>
          )}
        </GlowCard>
      </section>

      {/* Proposals list */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-cyan-200">▦</span> Proposals
          </h2>
          <div className="text-sm text-slate-400">{sortedProposals.length} active</div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedProposals.length === 0 ? (
            <GlowCard className="p-6">
              <div className="text-slate-200 font-medium">No proposals yet</div>
              <div className="mt-2 text-slate-400 text-sm">Be the first to propose something great ✨</div>
            </GlowCard>
          ) : (
            sortedProposals.map((p) => {
              const count = voteCounts[p.id] ?? 0;
              const voted = iVoted(p.id);

              return (
                <GlowCard key={p.id} className="p-5">
                  <div className="flex gap-4">
                    <div className="w-16 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_0_25px_rgba(0,0,0,0.45)]">
                      {p.cover_url ? (
                        <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-xs text-slate-500">No cover</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 truncate">{p.title}</div>
                          <div className="text-sm text-slate-400 truncate">{p.author}</div>
                        </div>
                        <Pill tone="cyan">{count} vote{count === 1 ? "" : "s"}</Pill>
                      </div>

                      {p.why_read ? (
                        <div className="mt-3 text-sm text-slate-200 leading-relaxed">
                          {p.why_read}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-500 italic">No pitch yet.</div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => toggleVote(p.id)}
                          className={`
                            rounded-xl border px-3 py-1.5 transition
                            ${
                              voted
                                ? "bg-slate-100 text-slate-950 border-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.20)]"
                                : "bg-slate-950 text-slate-100 border-slate-700 hover:border-slate-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.10)]"
                            }
                          `}
                        >
                          {voted ? "✓ Voted" : "Vote"}
                        </button>

                        {isAdmin ? (
                          <button
                            onClick={() => promoteToCurrent(p)}
                            className="
                              rounded-xl border border-cyan-500/40 bg-slate-950 px-3 py-1.5
                              text-cyan-200
                              shadow-[0_0_12px_rgba(34,211,238,0.18)]
                              hover:shadow-[0_0_18px_rgba(34,211,238,0.28)]
                              transition
                            "
                          >
                            Promote → Current
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </GlowCard>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
