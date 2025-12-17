/* eslint-disable @next/next/no-img-element */

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
    <main className="p-6 max-w-5xl mx-aut
