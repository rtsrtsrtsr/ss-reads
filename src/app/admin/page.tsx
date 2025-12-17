"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: "Read" | "Current" | "NextUp" | "Archived";
  date_added: string;
};

export default function AdminPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const [books, setBooks] = useState<Book[]>([]);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [status, setStatus] = useState<Book["status"]>("Read");
  const [msg, setMsg] = useState<string>("");

  async function refreshBooks() {
    const { data, error } = await supabase
      .from("books")
      .select("id,title,author,cover_url,status,date_added")
      .order("date_added", { ascending: false });

    if (error) {
      console.error(error);
      setMsg(`Error loading books: ${error.message}`);
      return;
    }
    setBooks((data ?? []) as any);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg("");

      const { data: sess } = await supabase.auth.getSession();
      const user = sess.session?.user ?? null;
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? null);

      // Check admin flag from profiles
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error(error);
        setMsg(`Error loading profile: ${error.message}`);
        setLoading(false);
        return;
      }

      setIsAdmin(!!prof?.is_admin);

      if (prof?.is_admin) {
        await refreshBooks();
      }

      setLoading(false);
    })();
  }, []);

  async function addBook(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");

    if (!title.trim() || !author.trim()) {
      setMsg("Title and author are required.");
      return;
    }

    const { error } = await supabase.from("books").insert({
      title: title.trim(),
      author: author.trim(),
      cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      status,
    });

    if (error) {
      setMsg(`Add failed: ${error.message}`);
      return;
    }

    setTitle("");
    setAuthor("");
    setCoverUrl("");
    setStatus("Read");
    setMsg("✅ Book added!");
    await refreshBooks();
  }

  async function setUniqueStatus(bookId: string, newStatus: "Current" | "NextUp") {
    setMsg("");

    // 1) Clear existing books with that status back to Read
    const clear = await supabase
      .from("books")
      .update({ status: "Read" })
      .eq("status", newStatus);

    if (clear.error) {
      setMsg(`Failed clearing ${newStatus}: ${clear.error.message}`);
      return;
    }

    // 2) Set selected book
    const set = await supabase
      .from("books")
      .update({ status: newStatus })
      .eq("id", bookId);

    if (set.error) {
      setMsg(`Failed setting ${newStatus}: ${set.error.message}`);
      return;
    }

    setMsg(`✅ Set as ${newStatus}`);
    await refreshBooks();
  }

  async function archiveBook(bookId: string) {
    setMsg("");
    const { error } = await supabase.from("books").update({ status: "Archived" }).eq("id", bookId);
    if (error) setMsg(`Archive failed: ${error.message}`);
    else {
      setMsg("✅ Archived");
      await refreshBooks();
    }
  }

  if (loading) return <main className="p-6">Loading…</main>;

  if (!email) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2">Please log in first.</p>
        <a className="underline" href="/login">Go to login</a>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-2 text-gray-700">
          You’re logged in as <span className="font-medium">{email}</span>, but you don’t have admin access.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          (Set <code>profiles.is_admin=true</code> for your user in Supabase.)
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <nav className="text-sm text-gray-600 space-x-4">
          <a className="underline" href="/">Bookshelf</a>
        </nav>
      </header>

      <section className="mt-6 rounded-2xl border p-5">
        <h2 className="font-semibold">Add a book</h2>

        <form onSubmit={addBook} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2"
            placeholder="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <input
            className="md:col-span-2 rounded-xl border px-3 py-2"
            placeholder="Cover image URL (optional)"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <select className="rounded-xl border px-2 py-2" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="Read">Read</option>
              <option value="Current">Current</option>
              <option value="NextUp">NextUp</option>
            </select>
          </div>
          <button className="rounded-xl bg-black text-white px-4 py-2 md:justify-self-end">
            Add book
          </button>
        </form>

        {msg && <div className="mt-3 text-sm text-gray-700">{msg}</div>}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Books</h2>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          {books.map((b) => (
            <div key={b.id} className="rounded-2xl border p-4">
              <div className="flex gap-3">
                <div className="w-16 shrink-0 aspect-[2/3] rounded-xl overflow-hidden border bg-gray-50">
                  {b.cover_url ? (
                    <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-sm text-gray-600">{b.author}</div>
                  <div className="mt-2 text-xs inline-flex rounded-full border px-2 py-1">{b.status}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <button
                  className="rounded-xl border px-3 py-1"
                  onClick={() => setUniqueStatus(b.id, "Current")}
                >
                  Set Current
                </button>
                <button
                  className="rounded-xl border px-3 py-1"
                  onClick={() => setUniqueStatus(b.id, "NextUp")}
                >
                  Set NextUp
                </button>
                <button
                  className="rounded-xl border px-3 py-1"
                  onClick={() => archiveBook(b.id)}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
