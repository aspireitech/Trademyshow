/**
 * Error reporting.
 *
 * Sentry is called over its plain HTTP store endpoint rather than through the
 * SDK: the SDK is large, and this only needs to post an event. When no DSN is
 * configured errors still reach the console, so nothing is ever swallowed.
 */

interface CapturedContext {
  userId?: number;
  route?: string;
  extra?: Record<string, unknown>;
}

function parseDsn(dsn: string): { url: string; key: string } | null {
  // https://<key>@<host>/<projectId>
  const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, key, host, projectId] = m;
  return { url: `https://${host}/api/${projectId}/store/`, key };
}

export async function captureError(err: unknown, context: CapturedContext = {}): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(`[error]${context.route ? ` ${context.route}` : ""} ${message}`, stack ?? "");

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const parsed = parseDsn(dsn);
  if (!parsed) {
    console.warn("[observability] SENTRY_DSN is malformed; error not reported upstream");
    return;
  }

  try {
    await fetch(parsed.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        platform: "node",
        environment: process.env.NODE_ENV ?? "development",
        release: process.env.APP_VERSION,
        level: "error",
        logger: context.route ?? "app",
        message: { formatted: message },
        exception: { values: [{ type: err instanceof Error ? err.name : "Error", value: message }] },
        // Only the id — never the email or name.
        user: context.userId ? { id: String(context.userId) } : undefined,
        extra: { ...context.extra, stack },
      }),
    });
  } catch (reportErr) {
    // Reporting must never take down the request it was reporting on.
    console.warn("[observability] failed to report error:", reportErr);
  }
}
