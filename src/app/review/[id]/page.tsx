/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/app/ui/Header";
import MentionInput from "@/app/ui/MentionInput";

type ReactionType = "Like" | "Helpful" | "Funny";

type Profile = {
  id: string;
  email: string;
  display_name: string;
};

function highlightMentions(text: string) {
  const parts = text.split(/(@[\w-]+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^@[\w-]+$/.test(p)) {
          return (
            <span
              key={i}
              className="
                inline-flex items-center
                rounded-full
                border border-cyan-500/40
                bg-slate-950
                px-2 py-0.5
                text-sm
                text-cyan-200
                shadow-[0_0_12px_rgba(34,211,238,0.25)]
              "
            >
              {p}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}


export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [review, setReview] = useState<any>(null);
  const [book, setBook] = useState<any>(null);

  const [comments, setComments] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [commentBody, setCommentBody] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user?.id || !user.email) {
      setMsg("Please log in.");
      return;
    }
    setMe({ id: user.id, email: user.email });

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
    if (!p.error) setProfiles((p.data ?? []) as any);
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

  function iReacted(type: ReactionType) {
    if (!me) return false;
    return !!reactions.find((r) => r.user_id === me.id && r.type === type);
  }

  async function toggleReaction(type: ReactionType) {
    setMsg("");
    if (!me) return;

    const existing = reactions.find((r) => r.user_id === me.id && r.type === type);
    if (existing) {
      const del = await supabase.from("review_reactions").delete().eq("id", existing.id);
      if (del.error) setMsg(del.error.message);
      else load();
    } else {
      const ins = await supabase.from("review_reactions").insert({ review_id: id, user_id: me.id, type });
      if (ins.error) setMsg(ins.error.message);
      else load();
    }
  }

  async function addComment() {
    setMsg("");
    if (!me) return;

    const body = commentBody.trim();
    if (!body) {
      setMsg("Write a comment first.");
      return;
    }

    const inserted = await supabase
      .from("review_comments")
      .insert({ review_id: id, user_id: me.id, body })
      .select("id")
      .single();

    if (inserted.error || !inserted.data?.id) {
      setMsg(inserted.error?.message ?? "Failed to add comment.");
      return;
    }

    const mentionedNames = Array.from(
      new Set(body.match(/@([\w-]+)/g)?.map((m) => m.slice(1).toLowerCase()) ?? [])
    );

    if (mentionedNames.length) {
      const targets = profiles.filter((p) => mentionedNames.includes(p.display_name.toLowerCase()));
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

  if (!review || !book) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <div className="text-slate-400">Loading…</div>
        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}
      </main>
    );
  }

  return (
	<>
	<Header />
    <main className="p-6 max-w-3xl mx-auto">
      <Link href={`/book/${book.id}`} className="text-sm underline text-slate-300">
        ← Back to book
      </Link>

      <div className="mt-6 flex gap-5">
        <div className="w-28 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-sm">
          {book.cover_url ? <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" /> : null}
        </div>

        <div className="flex-1">
          <div className="text-slate-400">{book.author}</div>
          <h1 className="text-4xl font-semibold tracking-tight">{book.title}</h1>

          <div className="mt-3 text-slate-300 flex items-center gap-3">
            <span>
              Review by <span className="text-slate-100 font-medium">{review.profiles?.display_name ?? "someone"}</span>
            </span>
            {review.rating ? (
              <span className="text-yellow-400">{Array(review.rating).fill("★").join("")}</span>
            ) : null}
          </div>
        </div>
      </div>

      <section className="
		  mt-7
		  rounded-2xl
		  border border-slate-800
		  bg-slate-900
		  p-5
		  shadow-[0_0_40px_rgba(0,0,0,0.35)]
	">
        <div className="text-slate-100 whitespace-pre-wrap leading-relaxed">
          {highlightMentions(review.thoughts ?? "")}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {(["Like", "Helpful", "Funny"] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleReaction(t)}
              className={`
				  rounded-xl
				  border
				  px-3 py-1.5
				  transition
				  ${
					iReacted(t)
					  ? "bg-slate-100 text-slate-950 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
					  : "bg-slate-950 text-slate-100 border-slate-700 hover:border-slate-500 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
				  }
				`}

            >
              {t === "Like" ? "👍" : t === "Helpful" ? "✅" : "😂"} {t} · {counts[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Comments</h2>

        <div className="mt-4 space-y-3">
          {comments.map((c) => (
            <div
			  key={c.id}
			  className="
				rounded-2xl
				border border-slate-800
				bg-slate-900
				p-4
				shadow-[0_0_30px_rgba(0,0,0,0.35)]
				hover:shadow-[0_0_45px_rgba(0,0,0,0.55)]
				transition
			  "
			>

              <div className="text-sm text-slate-400">
                <span className="font-medium text-slate-100">{c.profiles?.display_name ?? "someone"}</span>
              </div>
              <div className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-100">
                {highlightMentions(c.body ?? "")}
              </div>
            </div>
          ))}
        </div>

		<div className="
		  mt-5
		  rounded-2xl
		  border border-slate-800
		  bg-slate-900
		  p-5
		  shadow-[0_0_40px_rgba(0,0,0,0.35)]
		">
          <div className="font-medium text-slate-100">Add a comment</div>

          <div className="mt-3">
            <MentionInput
              value={commentBody}
              onChange={setCommentBody}
              profiles={profiles}
              placeholder="Reply… type @ to mention"
            />
          </div>

          <button
            onClick={addComment}
            className="mt-3 rounded-xl bg-slate-100 text-slate-950 px-4 py-2 font-medium hover:bg-white transition"
          >
            Post comment
          </button>

          {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}
        </div>
      </section>
    </main>
	</>
  );
}
