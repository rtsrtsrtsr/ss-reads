"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*")
        .eq("id", id)
        .single();

      if (!error) setBook(data);
    })();
  }, [id]);

  if (!book) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link href="/" className="text-sm underline text-gray-600">← Back</Link>

      <h1 className="mt-4 text-2xl font-semibold">{book.title}</h1>
      <p className="text-gray-600">{book.author}</p>

      {book.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.cover_url}
          alt={book.title}
          className="mt-4 w-48 rounded-2xl border"
        />
      )}
    </main>
  );
}
