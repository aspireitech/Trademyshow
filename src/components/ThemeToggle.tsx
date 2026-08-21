"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark";

/**
 * Light / dark switch. Light is the default for everyone — the site never
 * follows the OS, because colourful data on a white ground is the brand and
 * the first impression should not depend on a system setting. Dark remains
 * one click away and is remembered.
 */
export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("light");

  useEffect(() => {
    if (localStorage.getItem("theme") === "dark") setChoice("dark");
  }, []);

  function apply(next: Choice) {
    setChoice(next);
    if (next === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    }
  }

  const next: Choice = choice === "light" ? "dark" : "light";
  const label = `Theme: ${choice}. Switch to ${next}.`;

  return (
    <button className="theme-toggle" onClick={() => apply(next)} title={label} aria-label={label}>
      <span aria-hidden="true">{choice === "light" ? "☀" : "☾"}</span>
    </button>
  );
}
