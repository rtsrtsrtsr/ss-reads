/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BookStatus = "Read" | "Current" | "Archived";
type ReadingStatus = "In" | "Reading" | "Finished" | "NotThisTime";

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  status: BookStatus;
  date_added: string;
};

type ReviewRow = {
  id: string;
  book_id: string;
  user_id: string;
  rating: number | null;
  thoughts: string;
  created_at: string;
  updated_at: string;
  profiles?: { display_name: string } | null;
};

type ReadingRow = {
  id: string;
  user_id: string;
  status: ReadingStatus;
  profiles?: { display_name: string } | null;
};

function highlightMentionsInline(text: string) {
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

function StarPicker({
  value,
  onChange,
}: {
  value: number | "";
  onChange: (v: number | "") => void;
}) {
  const v = value === "" ? 0 : value;
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="px-0.5 text-3xl leading-none hover:scale-110 transition"
            aria-label={`${n} stars`}
          >
            <span className={n <= v ? "text-yellow-400 drop-shadow" : "text-slate-600"}>
              ★
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange("")}
        className="text-sm text-slate-400 underline hover:text-slate-200 transition"
      >
        clear
      </button>
    </div>
  );
}

export default function BookPage() {
  const { id } = useParams<{ id: string }>();

  const [me, setMe] = useState<{ id: string; email: string } | null>(null);
  const [book, setBook] = useState<Book | null>(null);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewCounts, setReviewCounts] = useState<
    Record<string, { comments: number; like: number; helpful: number; funny: number }>
  >({});

  const [myReviewId, setMyReviewId] = useState<string | null>(null);
  const [myRating, setMyRating] = useState<number | "">("");
  const [myThoughts, setMyThoughts] = useState<string>("");

  const [readingRows, setReadingRows] = useState<ReadingRow[]>([]);
  const [myReadingStatus, setMyReadingStatus] = useState<ReadingStatus | null>(null);

  const [msg, setMsg] = useState<string>("");

  const avgRating = useMemo(() => {
    const rated = reviews.filter((r) => typeof r.rating === "number") as Array<
      ReviewRow & { rating: number }
    >;
    if (!rated.length) return null;
    const sum = rated.reduce((a, r) => a + r.rating, 0);
    return sum / rated.length;
  }, [reviews]);

  async function loadEverything() {
    setMsg("");

    const { data: sess } = await supabase.auth.getSession();
    const user = sess.session?.user;
    if (!user?.id || !user.email) {
      setMsg("Please log in.");
      return;
    }
    setMe({ id: user.id, email: user.email });

    const b = await supabase.from("books").select("*").eq("id", id).single();
    if (b.error) {
      setMsg(`Could not load book: ${b.error.message}`);
      return;
    }
    setBook(b.data as any);

    const mine = await supabase
      .from("reviews")
      .select("id,rating,thoughts")
      .eq("book_id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mine.error && mine.data?.id) {
      setMyReviewId(mine.data.id);
      setMyRating(mine.data.rating ?? "");
      setMyThoughts(mine.data.thoughts ?? "");
    } else {
      setMyReviewId(null);
      setMyRating("");
      setMyThoughts("");
    }

    const r = await supabase
      .from("reviews")
      .select("id,book_id,user_id,rating,thoughts,created_at,updated_at,profiles(display_name)")
      .eq("book_id", id)
      .order("created_at", { ascending: false });

    if (r.error) {
      setMsg(`Could not load reviews: ${r.error.message}`);
      return;
    }

    const reviewList = (r.data ?? []) as any[];
    setReviews(reviewList);

    // Counts per review (quick + clear; can optimize later)
    const counts: Record<string, { comments: number; like: number; helpful: number; funny: number }> =
      {};
    for (const row of reviewList) {
      const [c, lk, hp, fn] = await Promise.all([
        supabase
          .from("review_comments")
          .select("id", { count: "exact", head: true })
          .eq("review_id", row.id),
        supabase
          .from("review_reactions")
          .select("id", { count: "exact", head: true })
          .eq("review_id", row.id)
          .eq("type", "Like"),
        supabase
          .from("review_reactions")
          .select("id", { count: "exact", head: true })
          .eq("review_id", row.id)
          .eq("type", "Helpful"),
        supabase
          .from("review_reactions")
          .select("id", { count: "exact", head: true })
          .eq("review_id", row.id)
          .eq("type", "Funny"),
      ]);

      counts[row.id] = {
        comments: c.count ?? 0,
        like: lk.count ?? 0,
        helpful: hp.count ?? 0,
        funny: fn.count ?? 0,
      };
    }
    setReviewCounts(counts);

    const rs = await supabase
      .from("reading_statuses")
      .select("id,user_id,status,profiles(display_name)")
      .eq("book_id", id)
      .order("updated_at", { ascending: false });

    if (!rs.error) {
      const rows = (rs.data ?? []) as any[];
      setReadingRows(rows);

      const mineRow = rows.find((x: any) => x.user_id === user.id);
      setMyReadingStatus((mineRow?.status as ReadingStatus) ?? null);
    }
  }

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveMyReview() {
    setMsg("");
    if (!me) return;

    if (!myThoughts.trim()) {
      setMsg("Write a quick review in Thoughts.");
      return;
    }

    const payload = {
      book_id: id,
      user_id: me.id,
      rating: myRating === "" ? null : myRating,
      thoughts: myThoughts.trim(),
    };

    if (myReviewId) {
      const upd = await supabase.from("reviews").update(payload).eq("id", myReviewId);
      if (upd.error) return setMsg(`Save failed: ${upd.error.message}`);
      setMsg("✅ Review updated");
    } else {
      const ins = await supabase.from("reviews").insert(payload);
      if (ins.error) return setMsg(`Save failed: ${ins.error.message}`);
      setMsg("✅ Review posted");
    }

    await loadEverything();
  }

  async function setReadingStatus(status: ReadingStatus) {
    setMsg("");
    if (!me) return;

    const existing = await supabase
      .from("reading_statuses")
      .select("id")
      .eq("book_id", id)
      .eq("user_id", me.id)
      .maybeSingle();

    if (existing.error) return setMsg(existing.error.message);

    if (existing.data?.id) {
      const upd = await supabase.from("reading_statuses").update({ status }).eq("id", existing.data.id);
      if (upd.error) return setMsg(upd.error.message);
    } else {
      const ins = await supabase.from("reading_statuses").insert({ book_id: id, user_id: me.id, status });
      if (ins.error) return setMsg(ins.error.message);
    }

    setMyReadingStatus(status);
    await loadEverything();
  }

  if (!book) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="text-slate-400">Loading…</div>
        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}
      </main>
    );
  }

  return (
	<>
	<Header />
    <main className="p-6 max-w-4xl mx-auto">


      <section className="mt-6 flex gap-5">
        <div className="w-32 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-slate-500">
              No cover
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="text-xs inline-flex rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200">
            {book.status}
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{book.title}</h1>
          <p className="mt-1 text-slate-400">{book.author}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 shadow-[0_0_20px_rgba(0,0,0,0.25)]">
              ⭐ {avgRating ? avgRating.toFixed(1) : "—"}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 shadow-[0_0_20px_rgba(0,0,0,0.25)]">
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </span>
            {myReadingStatus ? (
              <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 shadow-[0_0_20px_rgba(0,0,0,0.25)]">
                You: {myReadingStatus === "NotThisTime" ? "Not this time" : myReadingStatus}
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {(["In", "Reading", "Finished", "NotThisTime"] as const).map((s) => {
              const active = myReadingStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setReadingStatus(s)}
                  className={`
                    rounded-xl border px-3 py-1.5 transition
                    border-slate-700 hover:border-slate-500
                    ${active ? "bg-slate-100 text-slate-950 shadow-[0_0_20px_rgba(255,255,255,0.25)]" : "bg-slate-950 text-slate-100 hover:shadow-[0_0_20px_rgba(255,255,255,0.12)]"}
                  `}
                >
                  {s === "NotThisTime" ? "Not this time" : s}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <h2 className="font-semibold text-slate-100">
          {myReviewId ? "Edit your review" : "Add your review"}
        </h2>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-slate-400">Rating (optional):</span>
          <StarPicker value={myRating} onChange={setMyRating} />
        </div>

        <textarea
          className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
          rows={4}
          placeholder="Thoughts…"
          value={myThoughts}
          onChange={(e) => setMyThoughts(e.target.value)}
        />

        <button
          onClick={saveMyReview}
          className="mt-3 rounded-xl bg-slate-100 text-slate-950 px-4 py-2 font-medium hover:bg-white transition"
        >
          Save
        </button>

        {msg && <div className="mt-3 text-sm text-red-400">{msg}</div>}
      </section>

      {book.status === "Current" ? (
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          <h2 className="font-semibold text-slate-100">Who’s in</h2>

          {readingRows.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {readingRows.map((r) => (
                <span
                  key={r.id}
                  className="text-xs rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                >
                  {r.profiles?.display_name ?? "someone"} ·{" "}
                  {r.status === "NotThisTime" ? "Not this time" : r.status}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">No one has marked status yet.</div>
          )}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="font-semibold text-slate-100">Reviews</h2>

        <div className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <div className="text-sm text-slate-400">No reviews yet. Be the first.</div>
          ) : (
            reviews.map((r) => {
              const c = reviewCounts[r.id] ?? { comments: 0, like: 0, helpful: 0, funny: 0 };
              const stars = r.rating ? Array(r.rating).fill("★").join("") : "";

              return (
                <Link
                  key={r.id}
                  href={`/review/${r.id}`}
                  className="
                    block
                    rounded-2xl
                    border border-slate-800
                    bg-slate-900
                    p-5
                    shadow-[0_0_30px_rgba(0,0,0,0.35)]
                    hover:shadow-[0_0_45px_rgba(0,0,0,0.55)]
                    transition
                  "
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-100">
                      {r.profiles?.display_name ?? "someone"}
                    </div>
                    <div className="text-sm text-yellow-400">{stars}</div>
                  </div>

                  <div className="mt-2 text-slate-200 leading-relaxed line-clamp-2">
                    {highlightMentionsInline(r.thoughts ?? "")}
                  </div>

                  <div className="mt-4 text-sm text-slate-300 flex flex-wrap gap-4">
                    <span className="opacity-90">💬 {c.comments}</span>
                    <span className="opacity-90">👍 {c.like}</span>
                    <span className="opacity-90">✅ {c.helpful}</span>
                    <span className="opacity-90">😂 {c.funny}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
	</>
  );
}
