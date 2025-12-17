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

      // ---- CASE 1: Code-based (PKCE) flow ----
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMsg(`Login failed: ${error.message}`);
          return;
        }
        router.replace("/");
        return;
      }

      // ---- CASE 2: Token-based (implicit) flow ----
      const hash = window.location.hash.substring(1); // remove "#"
      const params = new URLSearchParams(hash);

      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          setMsg(`Login failed: ${error.message}`);
          return;
        }

        router.replace("/");
        return;
      }

      // ---- Neither format matched ----
      setMsg("Login link invalid or expired. Redirecting to login…");
      setTimeout(() => router.replace("/login"), 2000);
    })();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border p-6">
        <div className="font-medium">Signing you in</div>
        <div className="mt-2 text-sm text-gray-600">{msg}</div>
      </div>
    </main>
  );
}
