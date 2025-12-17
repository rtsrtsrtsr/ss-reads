"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthStatus() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="text-sm text-gray-600 flex items-center gap-3">
      {email ? (
        <>
          <span>Logged in as <span className="font-medium">{email}</span></span>
          <button onClick={signOut} className="underline">Sign out</button>
        </>
      ) : (
        <span>Not logged in</span>
      )}
    </div>
  );
}
