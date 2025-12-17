"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function InboxPage() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) return;

    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,text,is_read,created_at,book_id,review_id,comment_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setMsg(error.message);
      return;
    }
    setItems(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
    load();
  }

  function linkFor(n: any) {
    if (n.review_id) return `/review/${n.review_id}`;
    if (n.book_id) return `/book/${n.book_id}`;
    return "/";
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">📥 Inbox</h1>
        <nav className="text-sm text-gray-600 space-x-4">
          <a className="underline" href="/">Bookshelf</a>
          <button className="underline" onClick={markAllRead}>Mark all read</button>
        </nav>
      </header>

      {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}

      <div className="mt-6 space-y-3">
        {items.length === 0 ? (
          <div className="text-gray-600">No notifications yet.</div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded-2xl border p-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500">{n.type}</div>
                <Link href={linkFor(n)} className="font-medium underline">
                  {n.text}
                </Link>
                {!n.is_read && <div className="mt-1 text-xs text-gray-500">Unread</div>}
              </div>
              {!n.is_read && (
                <button className="text-sm underline" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
