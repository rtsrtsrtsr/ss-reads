/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import MentionInput from "@/app/ui/MentionInput";


type ReactionType = "Like" | "Helpful" | "Funny";

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [review, setReview] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [author, setAuthor] = useState<any>(null);

  const [comments, setComments] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [commentBody, setCommentBody] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");

    const r = await supabase
      .from("reviews")
      .select("id,book_id,user_id,rating,thoughts,created_at,profiles(display_name)")
      .eq("id", id)
      .single();

    if (r.error) {
      setMsg(r.error.message);
      return;
    }

    setReview(r.data);

    const b = await supabase.from("books").select("*").eq("id", r.data.book_id).single();
    if (!b.error) setBook(b.data);

    const c = await supabase
      .from("review_comments")
      .select("id,review_id,user_id,body,created_at,profiles(display_name)")
      .eq("review_id", id)
      .order("created_at", { ascending: true });

    if (!c.error) setComments(c.data ?? []);

    const rx = await supabase
      .from("review_reactions")
      .select("id,review_id,user_id,type,created_at")
      .eq("review_id", id);

    if (!rx.error) setReactions(rx.data ?? []);

    const p = await supabase.from("profiles").select("id,email,display_name");
    if (!p.error) setProfiles(p.data ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const counts = useMemo(() => {
    const c = { Like: 0, Helpful: 0, Funny: 0 } as Record<ReactionType, number>;
    for (const r of reactions) c[r.type as ReactionType] = (c[r.type as ReactionType] ?? 0) + 1;
    return c;
  }, [reactions]);

  const [myUserId, setMyUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMyUserId(data.session?.user.id ?? null));
  }, []);

  function iReacted(type: ReactionType) {
    return !!reactions.find((r) => r.user_id === myUserId && r.type === type);
  }

  async function toggleReaction(type: ReactionType) {
    setMsg("");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;

    const existing = reactions.find((r) => r.user_id === uid && r.type === type);
    if (existing) {
      const del = await supabase.from("review_reactions").delete().eq("id", existing.id);
      if (del.error) setMsg(del.error.message);
      else load();
    } else {
      const ins = await supabase.from("review_reactions").insert({ review_id: id, user_id: uid, type });
      if (ins.error) setMsg(ins.error.message);
      else load();
    }
  }

  async function addComment() {
    setMsg("");
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;

    if (!commentBody.trim()) {
      setMsg("Write a comment first.");
      return;
    }

    const inserted = await supabase
      .from("review_comments")
      .insert({ review_id: id, user_id: uid, body: commentBody.trim() })
      .select("id")
      .single();

    if (inserted.error || !inserted.data?.id) {
      setMsg(inserted.error?.message ?? "Failed to add comment.");
      return;
    }

	// Extract @mentions from comment body
	const mentionedNames = Array.from(
	  new Set(
		commentBody.match(/@([\w-]+)/g)?.map((m) => m.slice(1).toLowerCase()) ?? []
	  )
	);

	if (mentionedNames.length) {
	  const targets = profiles.filter((p) =>
		mentionedNames.includes(p.display_name.toLowerCase())
	  );

	  for (const t of targets) {
		await supabase.from("comment_mentions").insert({
		  comment_id: inserted.data.id,
		  mentioned_user_id: t.id,
		});
	  }
	}


    setCommentBody("");
    load();
  }

  if (!review || !book) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link href={`/book/${book.id}`} className="text-sm underline text-gray-600">← Back to book</Link>

      <div className="mt-4 flex gap-4">
        <div className="w-24 aspect-[2/3] rounded-2xl overflow-hidden border bg-gray-50">
          {book.cover_url ? <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-600">{book.author}</div>
          <h1 className="text-2xl font-semibold">{book.title}</h1>
          <div className="mt-2 text-sm text-gray-700">
            Review by <span className="font-medium">{review.profiles?.display_name ?? "someone"}</span>
            {review.rating ? <span className="ml-2">{ "⭐".repeat(review.rating) }</span> : null}
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border p-4">
        <div className="text-gray-900 whitespace-pre-wrap">{review.thoughts}</div>
        <div className="mt-4 flex gap-2 text-sm">
          {(["Like","Helpful","Funny"] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleReaction(t)}
              className={`rounded-xl border px-3 py-1 ${iReacted(t) ? "bg-black text-white" : ""}`}
            >
              {t === "Like" ? "👍" : t === "Helpful" ? "✅" : "😂"} {t} · {counts[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Comments</h2>

        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="rounded-2xl border p-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{c.profiles?.display_name ?? "someone"}</span>
              </div>
              <div className="mt-2 whitespace-pre-wrap">{c.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border p-4">
          <div className="font-medium">Add a comment</div>
          <textarea
            className="mt-2 w-full rounded-xl border p-3"
            rows={3}
            placeholder="Reply…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          />
			<MentionInput
			  value={commentBody}
			  onChange={setCommentBody}
			  profiles={profiles}
			  placeholder="Reply… use @ to mention"
			/>

          <button onClick={addComment} className="mt-3 rounded-xl bg-black text-white px-4 py-2">
            Post comment
          </button>
        </div>

        {msg && <div className="mt-3 text-sm text-red-600">{msg}</div>}
      </section>
    </main>
  );
}
