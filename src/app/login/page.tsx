"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.endsWith("@sourcingsprints.com")) {
      setError("Use your @sourcingsprints.com email.");
      return;
    }

	const { error } = await supabase.auth.signInWithOtp({
	  email,
	  options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
	});


    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6">
        <h1 className="text-xl font-semibold">SourceSprints Reads</h1>
        <p className="text-sm text-gray-500">Magic link login</p>

        <form onSubmit={sendLink} className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="you@sourcingsprints.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="w-full rounded-xl bg-black text-white py-2">
            Send link
          </button>
        </form>

        {sent && <p className="mt-3 text-sm">Check your email.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
