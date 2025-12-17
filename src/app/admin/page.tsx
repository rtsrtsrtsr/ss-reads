/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Header from "@/app/ui/Header";


type BookStatus = "Current" | "Read" | "Archived";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: BookStatus;
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

export default function AdminPage() {
  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [books, setBooks] = useState<Book[]>([]);
  const [msg, setMsg] = useState("");

  // Add-book form
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<BookStatus>("Read");

  const currentBook = useMemo(() => books.find((b) => b.status === "Current") ?? null, [books]);

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;

    if (!user?.id || !user.email) {
      setMe(null);
      setIsAdmin(false);
      setMsg("Please log in.");
      return;
    }
    setMe({ id: user.id, email: user.email });

    const prof = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    setIsAdmin(!!prof.data?.is_admin);

    const b = await supabase
      .from("books")
      .select("id,title,author,cover_url,status")
      .order("status", { ascending: true })
      .order("title", { ascending: true });

    if (b.error) {
      setMsg(`Could not load books: ${b.error.message}`);
      return;
    }
    setBooks((b.data ?? []) as any);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBook() {
    setMsg("");
    if (!isAdmin) return setMsg("Admins only.");

    if (!title.trim() || !author.trim()) {
      return setMsg("Title + Author are required.");
    }

    // If creating as Current, demote existing Current -> Read first
    if (status === "Current") {
      const demote = await supabase.from("books").update({ status: "Read" }).eq("status", "Current");
      if (demote.error) return setMsg(`Could not clear existing Current: ${demote.error.message}`);
    }

    const ins = await supabase.from("books").insert({
      title: title.trim(),
      author: author.trim(),
      cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      status,
    });

    if (ins.error) return setMsg(`Add failed: ${ins.error.message}`);

    setTitle("");
    setAuthor("");
    setCoverUrl("");
    setStatus("Read");
    setMsg("✅ Book added");
    await load();
  }

  async function setAsCurrent(bookId: string) {
    setMsg("");
    if (!isAdmin) return setMsg("Admins only.");

    // Always enforce only one Current:
    const demote = await supabase.from("books").update({ status: "Read" }).eq("status", "Current");
    if (demote.error) return setMsg(`Could not demote existing Current: ${demote.error.message}`);

    const promote = await supabase.from("books").update({ status: "Current" }).eq("id", bookId);
    if (promote.error) return setMsg(`Could not set Current: ${promote.error.message}`);

    setMsg("✅ Set as Current");
    await load();
  }

  async function markAsRead(bookId: string) {
    setMsg("");
    if (!isAdmin) return setMsg("Admins only.");

    const upd = await supabase.from("books").update({ status: "Read" }).eq("id", bookId);
    if (upd.error) return setMsg(`Could not mark as Read: ${upd.error.message}`);

    setMsg("✅ Marked as Read");
    await load();
  }

  async function archive(bookId: string) {
    setMsg("");
    if (!isAdmin) return setMsg("Admins only.");

    const upd = await supabase.from("books").update({ status: "Archived" }).eq("id", bookId);
    if (upd.error) return setMsg(`Could not archive: ${upd.error.message}`);

    setMsg("✅ Archived (hidden from Home)");
    await load();
  }

  async function unarchive(bookId: string) {
    setMsg("");
    if (!isAdmin) return setMsg("Admins only.");

    const upd = await supabase.from("books").update({ status: "Read" }).eq("id", bookId);
    if (upd.error) return setMsg(`Could not unarchive: ${upd.error.message}`);

    setMsg("✅ Restored to Read");
    await load();
  }

  if (!me) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <GlowCard className="p-6">
          <div className="text-slate-100 font-semibold">Admin</div>
          <div className="mt-2 text-slate-400 text-sm">Please log in to use the admin panel.</div>
          <div className="mt-4">
            <Link className="underline text-slate-300 hover:text-white transition" href="/login">
              Go to Login →
            </Link>
          </div>
          {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}
        </GlowCard>
      </main>
    );
  }

  return (
	<>
	<Header />
    <main className="p-6 max-w-6xl mx-auto">

      {msg && <div className="mt-4 text-sm text-red-400">{msg}</div>}

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Pill tone="cyan">⚡ Current</Pill>
              <span className="text-sm text-slate-400">only one allowed</span>
            </div>
          </div>

          {currentBook ? (
            <div className="mt-5 flex items-center gap-4">
              <div className="w-16 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                {currentBook.cover_url ? (
                  <img src={currentBook.cover_url} alt={currentBook.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{currentBook.title}</div>
                <div className="text-sm text-slate-400">{currentBook.author}</div>
                <Link
                  className="mt-2 inline-block text-sm underline text-slate-300 hover:text-white transition"
                  href={`/book/${currentBook.id}`}
                >
                  Open →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 text-slate-400">No Current book set yet.</div>
          )}
        </GlowCard>

        <GlowCard className="p-6">
          <div className="flex items-center gap-3">
            <Pill tone={isAdmin ? "cyan" : "red"}>{isAdmin ? "Admin access" : "No admin access"}</Pill>
            <span className="text-sm text-slate-400">Logged in as {me.email}</span>
          </div>

          <div className="mt-4 text-sm text-slate-300">
            Tip: Finished books should be <Pill>Read</Pill>. <Pill tone="red">Archived</Pill> hides them from Home.
          </div>
        </GlowCard>
      </section>

      <section className="mt-10">
        <GlowCard className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Pill tone="cyan">➕ Add book</Pill>
              <span className="text-sm text-slate-400">admins only</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!isAdmin}
            />
            <input
              className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={!isAdmin}
            />
            <input
              className="md:col-span-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Cover URL (optional)"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              disabled={!isAdmin}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Status:</span>
              <select
                className="rounded-xl border border-slate-700 bg-slate-950 text-slate-100 p-2"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                disabled={!isAdmin}
              >
                <option value="Read">Read</option>
                <option value="Current">Current</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <button
                onClick={addBook}
                disabled={!isAdmin}
                className={`rounded-xl px-4 py-2 font-medium transition ${
                  isAdmin
                    ? "bg-slate-100 text-slate-950 hover:bg-white shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                Add book
              </button>
            </div>
          </div>
        </GlowCard>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <span className="text-cyan-200">▦</span> All books
          </h2>
          <div className="text-sm text-slate-400">
            Current + Read show on Home. Archived is hidden.
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {books.map((b) => (
            <GlowCard key={b.id} className="p-4">
              <div className="flex gap-4">
                <div className="w-14 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                  {b.cover_url ? <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" /> : null}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate text-slate-100">{b.title}</div>
                      <div className="text-sm text-slate-400 truncate">{b.author}</div>
                    </div>
                    <Pill
                      tone={b.status === "Current" ? "cyan" : b.status === "Archived" ? "red" : "slate"}
                    >
                      {b.status}
                    </Pill>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <Link
                      className="underline text-slate-300 hover:text-white transition"
                      href={`/book/${b.id}`}
                    >
                      Open
                    </Link>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => setAsCurrent(b.id)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 hover:border-slate-500 hover:shadow-[0_0_20px_rgba(34,211,238,0.12)] transition"
                        >
                          Set Current
                        </button>
                        <button
                          onClick={() => markAsRead(b.id)}
                          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 hover:border-slate-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.10)] transition"
                        >
                          Mark Read
                        </button>
                        {b.status !== "Archived" ? (
                          <button
                            onClick={() => archive(b.id)}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 hover:border-red-400/60 hover:shadow-[0_0_20px_rgba(248,113,113,0.12)] transition"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            onClick={() => unarchive(b.id)}
                            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 hover:border-slate-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.10)] transition"
                          >
                            Unarchive
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      </section>
    </main>
	</>
  );
}
