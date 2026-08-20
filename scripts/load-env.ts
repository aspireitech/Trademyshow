import fs from "node:fs";
import path from "node:path";

/**
 * Load .env files for scripts that run outside Next.
 *
 * Imported for its side effect, and imported FIRST: ES module imports are
 * evaluated in order, so this runs before the database module — which reads
 * DB_PATH at import time. Without it, `npm run seed` would quietly write to a
 * different database than `npm start` reads from.
 *
 * Precedence matches Next's: a real environment variable beats any file, and
 * earlier files beat later ones.
 */
for (const file of [".env.local", ".env.production", ".env"]) {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) continue;

  for (const line of fs.readFileSync(full, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
