/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Proposal = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  why_read: string | null;
  proposed_by: string | null;
  created_at: string;
  is_active: boolean;
};

type Vote = {
  id: string;
  proposal_id: string;
  user_id: string;
  created_at: string;
};

export default function UpNextPage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  // Propose form
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [whyRead, setWhyRead] = useState("");

  const [msg, setMsg] = useState<string>("");

  // Admin promote controls
  const [promoteStatus, setPromoteStatus] = useState<"Current" | "Read">("Current");

  const voteCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of votes) map[v.proposal_id] = (map[v.proposal_id] ?? 0) + 1;
    return map;
  }, [votes]);

  const myVotesSet = useMemo(() => {
    const s = new Set<string>();
    if (!me) return s;
    for (const v of votes) if (v.user_id === me.id) s.add(v.proposal_id);
    return s;
  }, [votes, me]);

  const sortedProposals = useMemo(() => {
    return [...proposals].sort((a, b) => {
      const ca = voteCounts[a.id] ?? 0;
      const cb = voteCounts[b.id] ?? 0;
      if (cb !== ca) return cb - ca;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [proposals, voteCounts]);

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user?.id || !user.email) {
      setMe(null);
      setMsg("Please log in.");
      return;
    }
    if (!user.email.endsWith("@sourcingsprints.com")) {
      setMe(null);
      setMsg("Use your @sourcingsprints.com email.");
      return;
    }
    setMe({ id: user.id, email: user.email });

    const prof = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    setIsAdmin(!!prof.data?.is_admin);

    const p = await supabase
      .from("book_proposals")
      .select("id,title,author,cover_url,why_read,proposed_by,created_at,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (p.error) {
      setMsg(`Could not load proposals: ${p.error.message}`);
      return;
    }
    setProposals((p.data ?? []) as any);

    const v = await supabase.from("book_votes").select("id,proposal_id,user_id,created_at");
    if (v.error) {
      setMsg(`Could not load votes: ${v.error.message}`);
      return;
    }
    setVotes((v.data ?? []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!me) return;

    if (!title.trim() || !author.trim()) {
      setMsg("Title and author are required.");
      return;
    }

    const ins = await supabase.from("book_proposals").insert({
      title: title.trim(),
      author: author.trim(),
      cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      why_read: whyRead.trim() ? whyRead.trim() : null,
      proposed_by: me.id,
      is_active: true,
    });

    if (ins.error) {
      setMsg(`Proposal failed: ${ins.error.message}`);
      return;
    }

    setTitle("");
    setAuthor("");
    setCoverUrl("");
    setWhyRead("");
    setMsg("✅ Proposed!");
    await load();
  }

  async function toggleVote(proposalId: string) {
    setMsg("");
    if (!me) return;

    const already = votes.find((v) => v.user_id === me.id && v.proposal_id === proposalId);

    if (already) {
      const del = await supabase.from("book_votes").delete().eq("id", already.id);
      if (del.error) setMsg(`Could not remove vote: ${del.error.message}`);
      else await load();
    } else {
      const ins = await supabase.from("book_votes").insert({
        proposal_id: proposalId,
        user_id: me.id,
      });
      if (ins.error) setMsg(`Could not vote: ${ins.error.message}`);
      else await load();
    }
  }

  async function promoteToBooks(p: Proposal) {
    setMsg("");
    if (!isAdmin) return;

    // If promoting to Current, clear existing Current back to Read
    if (promoteStatus === "Current") {
      const clear = await supabase.from("books").update({ status: "Read" }).eq("status", "Current");
      if (clear.error) {
        setMsg(`Could not clear existing Current: ${clear.error.message}`);
        return;
      }
    }

    const ins = await supabase.from("books").insert({
      title: p.title,
      author: p.author,
      cover_url: p.cover_url,
      status: promoteStatus,
    });

    if (ins.error) {
      setMsg(`Could not add to Books: ${ins.error.message}`);
      return;
    }

    // Deactivate proposal so it no longer appears in Up Next
    const upd = await supabase.from("book_proposals").update({ is_active: false }).eq("id", p.id);
    if (upd.error) {
      setMsg(`Added to Books, but could not deactivate proposal: ${upd.error.message}`);
      return;
    }

    setMsg(`✅ Promoted to Books as ${promoteStatus}`);
    await load();
  }

  async function deactivateProposal(p: Proposal) {
    setMsg("");
    if (!isAdmin) return;

    const upd = await supabase.from("book_proposals").update({ is_active: false }).eq("id", p.id);
    if (upd.error) setMsg(`Could not deactivate: ${upd.error.message}`);
    else {
      setMsg("✅ Deactivated");
      await load();
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto bg-white text-gray-900 min-h-screen">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">⏭️ Up Next</h1>
        <nav className="text-sm text-gray-600 space-x-4">
          <Link className="underline" href="/">
            Bookshelf
          </Link>
          <Link className="underline" href="/inbox">
            Inbox
          </Link>
          <Link className="underline" href="/admin">
            Admin
          </Link>
        </nav>
      </header>

      {!me ? (
        <div className="mt-6 rounded-2xl border p-5">
          <div className="font-medium">Please log in</div>
          <div className="text-sm text-gray-600 mt-1">
            Go to <a className="underline" href="/login">Login</a> to participate in voting.
          </div>
          {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}
        </div>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border p-5">
              <div className="font-semibold">Propose a book</div>
              <form onSubmit={propose} className="mt-4 space-y-3">
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Cover URL (optional)"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                />
                <textarea
                  className="w-full rounded-xl border p-3 bg-white text-gray-900 placeholder:text-gray-400"
                  rows={3}
                  placeholder="Why should we read it? (optional)"
                  value={whyRead}
                  onChange={(e) => setWhyRead(e.target.value)}
                />
                <button className="rounded-xl bg-black text-white px-4 py-2">Submit proposal</button>
              </form>
            </div>

            <div className="rounded-2xl border p-5">
              <div className="font-semibold">How voting works</div>
              <ul className="mt-3 text-sm text-gray-700 space-y-2 list-disc pl-5">
                <li>Vote for any number of proposals (toggle on/off).</li>
                <li>Items are sorted by votes, then most recently proposed.</li>
                <li>When we decide, an admin promotes the winner to the Bookshelf as Current.</li>
              </ul>

              {isAdmin && (
                <div className="mt-5 rounded-2xl border p-4">
                  <div className="font-medium">Admin promote default</div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Promote as:</span>
                    <select
                      className="rounded-xl border px-2 py-1 bg-white text-gray-900"
                      value={promoteStatus}
                      onChange={(e) => setPromoteStatus(e.target.value as any)}
                    >
                      <option value="Current">Current</option>
                      <option value="Read">Read</option>
                    </select>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    If promoting as Current, we automatically move the existing Current book to Read.
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Proposals</h2>
              <div className="text-sm text-gray-600">
                Logged in as <span className="font-medium">{me.email}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {sortedProposals.length === 0 ? (
                <div className="text-sm text-gray-600">No proposals yet — add the first one!</div>
              ) : (
                sortedProposals.map((p) => {
                  const count = voteCounts[p.id] ?? 0;
                  const voted = myVotesSet.has(p.id);

                  return (
                    <div key={p.id} className="rounded-2xl border p-4">
                      <div className="flex gap-3">
                        <div className="w-16 shrink-0 aspect-[2/3] rounded-xl overflow-hidden border bg-gray-50">
                          {p.cover_url ? (
                            <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" />
                          ) : null}
                        </div>

                        <div className="flex-1">
                          <div className="font-medium">{p.title}</div>
                          <div className="text-sm text-gray-600">{p.author}</div>

                          {p.why_read ? (
                            <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">
                              {p.why_read}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-gray-500 italic">No notes.</div>
                          )}

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => toggleVote(p.id)}
                              className={`rounded-xl border px-3 py-1 text-sm hover:shadow-sm transition ${
                                voted ? "bg-black text-white" : ""
                              }`}
                            >
                              {voted ? "Voted" : "Vote"}
                            </button>

                            <div className="text-sm text-gray-700">
                              <span className="font-medium">{count}</span> vote{count === 1 ? "" : "s"}
                            </div>
                          </div>

                          {isAdmin && (
                            <div className="mt-3 flex flex-wrap gap-2 text-sm">
                              <button
                                type="button"
                                onClick={() => promoteToBooks(p)}
                                className="rounded-xl border px-3 py-1"
                              >
                                Promote to Books
                              </button>
                              <button
                                type="button"
                                onClick={() => deactivateProposal(p)}
                                className="rounded-xl border px-3 py-1"
                              >
                                Deactivate
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {msg && <div className="mt-4 text-sm text-gray-700">{msg}</div>}
          </section>
        </>
      )}
    </main>
  );
}
