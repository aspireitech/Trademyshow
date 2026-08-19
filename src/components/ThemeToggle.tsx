"use client";

import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";

/**
 * Light / dark / system switch.
 *
 * The stored choice is applied by an inline script in the document head so the
 * correct theme is painted on the first frame — without it, an explicit dark
 * preference would flash light on every navigation.
 */
export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") setChoice(stored);
  }, []);

  function apply(next: Choice) {
    setChoice(next);
    const root = document.documentElement;
    if (next === "system") {
      root.removeAttribute("data-theme");
      localStorage.removeItem("theme");
    } else {
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    }
  }

  // Cycles light -> dark -> follow the system -> light.
  const next: Choice = choice === "light" ? "dark" : choice === "dark" ? "system" : "light";
  const icon = choice === "light" ? "☀" : choice === "dark" ? "☾" : "◐";
  const label =
    choice === "system"
      ? "Theme: following your system. Switch to light."
      : `Theme: ${choice}. Switch to ${next === "system" ? "system default" : next}.`;

  return (
    <button className="theme-toggle" onClick={() => apply(next)} title={label} aria-label={label}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
