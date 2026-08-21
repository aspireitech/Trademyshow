"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StockInfo } from "@/lib/types";

/**
 * Ticker type-ahead, in the header of every page.
 *
 * The behaviour is copied deliberately from the research sites people already
 * use, because those habits are the thing being satisfied: type one or two
 * letters and see matching tickers immediately, arrow down, press Enter. "/"
 * focuses it from anywhere, which is the one shortcut this audience expects to
 * work without being told.
 *
 * Results come from the local universe first, so the common names appear
 * before the network answers at all, and the vendor's list arrives behind
 * them.
 */

const DEBOUNCE_MS = 140;

function assetBadge(assetClass?: string): string | null {
  if (!assetClass || assetClass === "stock") return null;
  return assetClass.toUpperCase();
}

export default function GlobalSearch({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // "/" focuses the box, unless the visitor is already typing somewhere else.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey) return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A click anywhere else closes the list; leaving it open over the page
  // content is the thing that makes these menus feel broken.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      const controller = new AbortController();
      void fetch(`/api/stocks/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results: StockInfo[] }) => {
          setResults(d.results ?? []);
          setCursor(0);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const go = useCallback(
    (symbol: string) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      inputRef.current?.blur();
      router.push(`/stocks/${encodeURIComponent(symbol)}`);
    },
    [router],
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setCursor((c) => Math.min(c + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter on an empty list still goes somewhere: someone who typed a whole
      // ticker and hit Enter before the list arrived means that ticker.
      const chosen = results[cursor]?.symbol ?? query.trim().toUpperCase();
      if (chosen) go(chosen);
    }
  }

  return (
    <div className="gsearch" ref={boxRef}>
      <svg className="gsearch-icon" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M13.5 13.5 L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        className="gsearch-input"
        placeholder={placeholder ?? "Company or stock symbol…"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="gsearch-list"
        aria-autocomplete="list"
        aria-label="Search for a company or stock symbol"
        autoComplete="off"
      />
      <kbd className="gsearch-kbd" aria-hidden="true">/</kbd>

      {open && query.trim() && (
        <div className="gsearch-menu" id="gsearch-list" role="listbox">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              role="option"
              aria-selected={i === cursor}
              className={i === cursor ? "active" : ""}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(r.symbol)}
            >
              <span className="gsearch-sym">{r.symbol}</span>
              <span className="gsearch-name">{r.name}</span>
              {assetBadge(r.assetClass) && (
                <span className="gsearch-tag">{assetBadge(r.assetClass)}</span>
              )}
            </button>
          ))}

          {results.length === 0 && (
            <p className="gsearch-empty">
              {loading
                ? "Searching…"
                : `Nothing matching “${query.trim()}”. Try a ticker like AAPL or a name like Apple.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
