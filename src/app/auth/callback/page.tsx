"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // This exchanges the auth code in the URL for a session
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      // Even if it errors, send them somewhere sane
      router.replace(error ? "/login" : "/");
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="rounded-2xl border p-6">Signing you in…</div>
    </main>
  );
}
