"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");

      if (!code) {
        setMsg("No auth code found in URL. Sending you to login…");
        router.replace("/login");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        // Show the real error so we can diagnose quickly
        setMsg(`Login failed: ${error.message}`);
        return;
      }

      router.replace("/");
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border p-6">
        <div className="font-medium">Auth Callback</div>
        <div className="mt-2 text-sm text-gray-600">{msg}</div>
      </div>
    </main>
  );
}
