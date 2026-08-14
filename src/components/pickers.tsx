"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PLATAFORMAS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function PlataformaPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(p: string) {
    onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {PLATAFORMAS.map((p) => {
        const on = value.includes(p.value);
        return (
          <button
            type="button"
            key={p.value}
            onClick={() => toggle(p.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              on ? "border-transparent text-white" : "hover:bg-accent",
            )}
            style={on ? { backgroundColor: p.cor } : undefined}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagsInput({
  value,
  onChange,
  placeholder = "Digite e Enter",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft("");
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input p-1.5">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft && add(draft)}
        placeholder={placeholder}
        className="h-6 flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
