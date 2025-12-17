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
  const [query, setQuery] = useState<string | null>(null);
  const [matches, setMatches] = useState<Profile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!query) {
      setMatches([]);
      return;
    }

    const q = query.toLowerCase();
    setMatches(
      profiles.filter((p) =>
        p.display_name.toLowerCase().startsWith(q)
      )
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
    const before = value.slice(0, cursor).replace(/@[\w-]+$/, `@${name} `);
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
        className="w-full rounded-xl border p-3 bg-white text-gray-900 placeholder:text-gray-400"
      />

      {matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-64 rounded-xl border bg-white shadow">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => insertMention(p.display_name)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
            >
              @{p.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
