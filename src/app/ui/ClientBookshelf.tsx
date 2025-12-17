"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ClientBookshelf() {
  const [books, setBooks] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("books")
      .select("*")
      .neq("status", "Archived")
      .order("date_added", { ascending: false })
      .then(({ data }) => setBooks(data ?? []));
  }, []);

  return (
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
      {books.map(book => (
        <Link key={book.id} href={`/book/${book.id}`}>
          <div className="rounded-2xl overflow-hidden border bg-gray-50">
            {book.cover_url && (
              <img src={book.cover_url} className="aspect-[2/3] object-cover" />
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
