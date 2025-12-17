"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ClientBookshelf() {
  const [books, setBooks] = useState<any[]>([]);
  const [status, setStatus] = useState<"loading"|"logged_out"|"ready">("loading");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user.email ?? null;

      if (!email) {
        setStatus("logged_out");
        return;
      }
      if (!email.endsWith("@sourcingsprints.com")) {
        setStatus("logged_out");
        return;
      }

      setStatus("ready");
      const { data: books, error } = await supabase
        .from("books")
        .select("*")
        .neq("status", "Archived")
        .order("date_added", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }
      setBooks(books ?? []);
    })();
  }, []);

  if (status === "loading") return <div className="mt-6 text-gray-600">Loading…</div>;

  if (status === "logged_out") {
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
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {books.map(book => (
        <Link key={book.id} href={`/book/${book.id}`}>
          <div className="rounded-2xl overflow-hidden border bg-gray-50">
            {book.cover_url ? (
              <img src={book.cover_url} className="aspect-[2/3] object-cover w-full" alt={book.title} />
            ) : (
              <div className="aspect-[2/3] flex items-center justify-center text-xs text-gray-500">
                No cover
              </div>
            )}
          </div>
          <div className="mt-2 text-sm">
            <div className="font-medium">{book.title}</div>
            <div className="text-gray-500">{book.author}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
