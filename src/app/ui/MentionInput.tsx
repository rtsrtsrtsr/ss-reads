"use client";

import { useEffect, useRef, useState } from "react";

type Profile = {
  id: string;
  email: string;
  display_name: string;
};

export default function MentionInput({
  value,
  onChange,
  profiles,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  profiles: Profile[];
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [query, setQuery] = useState<string | null>(null);
  const [matches, setMatches] = useState<Profile[]>([]);

  // Update autocomplete matches
  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }

    const q = query.toLowerCase();
    setMatches(
      profiles
        .filter((p) => p.display_name.toLowerCase().startsWith(q))
        .slice(0, 5)
    );
  }, [query, profiles]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart;
    const before = text.slice(0, cursor);
    const match = before.match(/@([\w-]+)$/);

    if (match) setQuery(match[1]);
    else setQuery(null);
  }

  function insertMention(name: string) {
    const ta = textareaRef.current;
    if (!ta) return;

    const cursor = ta.selectionStart;
    const before = value
      .slice(0, cursor)
      .replace(/@[\w-]+$/, `@${name} `);
    const after = value.slice(cursor);

    const next = before + after;
    onChange(next);
    setQuery(null);

    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = before.length;
    });
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400 p-3 focus:outline-none focus:ring-2 focus:ring-slate-500"
      />

      {matches.length > 0 && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => insertMention(p.display_name)}
              className="block w-full text-left px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
            >
              @{p.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
