"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: "Read" | "Current" | "NextUp" | "Archived";
  date_added: string;
};

type ReadingRow = { user_id: string; status: string; profiles: { display_name: string } };

export default function HomeFeed() {
  const [state, setState] = useState<"loading" | "logged_out" | "ready">("loading");
  const [books, setBooks] = useState<Book[]>([]);
  const [current, setCurrent] = useState<Book | null>(null);
  const [nextUp, setNextUp] = useState<Book | null>(null);
  const [nextUpReaders, setNextUpReaders] = useState<ReadingRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email ?? null;
      if (!email || !email.endsWith("@sourcingsprints.com")) {
        setState("logged_out");
        return;
      }

      setState("ready");

      const { data: allBooks, error } = await supabase
        .from("books")
        .select("id,title,author,cover_url,status,date_added")
        .in("status", ["Read", "Current"])
        .order("date_added", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      const list = (allBooks ?? []) as Book[];
      setBooks(list);

      const cur = list.find((b) => b.status === "Current") ?? null;
      const nxt = list.find((b) => b.status === "NextUp") ?? null;
      setCurrent(cur);
      setNextUp(nxt);

      if (nxt) {
        const rs = await supabase
          .from("reading_statuses")
          .select("user_id,status,profiles(display_name)")
          .eq("book_id", nxt.id)
          .order("updated_at", { ascending: false });

        if (!rs.error && rs.data) setNextUpReaders(rs.data as any);
      }
    })();
  }, []);

  if (state === "loading") return <div className="mt-6 text-gray-600">Loading…</div>;

  if (state === "logged_out") {
    return (
      <div className="mt-6 rounded-2xl border p-5">
        <div className="font-medium">You’re not logged in.</div>
        <div className="text-sm text-gray-600 mt-1">
          Go to <a className="underline" href="/login">Login</a> to access the bookshelf.
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="📘 Current" book={current} emptyText="No current book set." />
        <div className="rounded-2xl border p-4">
          <div className="font-semibold">⏭️ Next Up</div>
          {nextUp ? (
            <>
              <Link href={`/book/${nextUp.id}`} className="mt-3 flex gap-3 items-center">
                <div className="w-14 aspect-[2/3] rounded-xl overflow-hidden border bg-gray-50">
                  {nextUp.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nextUp.cover_url} alt={nextUp.title} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div>
                  <div className="font-medium">{nextUp.title}</div>
                  <div className="text-sm text-gray-600">{nextUp.author}</div>
                </div>
              </Link>

              <div className="mt-4 text-sm text-gray-700">
                <div className="font-medium">Who’s in:</div>
                {nextUpReaders.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextUpReaders.map((r, i) => (
                      <span key={i} className="text-xs rounded-full border px-2 py-1">
                        {r.profiles?.display_name ?? "someone"} · {r.status}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-gray-600">No one has marked status yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-gray-600">No next book set.</div>
          )}
        </div>
      </section>

      <h2 className="mt-10 font-semibold">📚 Bookshelf</h2>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
        {books.map((b) => (
          <Link key={b.id} href={`/book/${b.id}`} className="group">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden border shadow-sm bg-gray-50">
              {b.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.cover_url} alt={b.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-gray-500 px-3 text-center">No cover</div>
              )}
            </div>
            <div className="mt-2 text-sm">
              <div className="font-medium line-clamp-1">{b.title}</div>
              <div className="text-gray-500 line-clamp-1">{b.author}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function Card({ title, book, emptyText }: { title: string; book: Book | null; emptyText: string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="font-semibold">{title}</div>
      {book ? (
        <Link href={`/book/${book.id}`} className="mt-3 flex gap-3 items-center">
          <div className="w-14 aspect-[2/3] rounded-xl overflow-hidden border bg-gray-50">
            {book.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div>
            <div className="font-medium">{book.title}</div>
            <div className="text-sm text-gray-600">{book.author}</div>
          </div>
        </Link>
      ) : (
        <div className="mt-3 text-sm text-gray-600">{emptyText}</div>
      )}
    </div>
  );
}
