import { isSandbox, sandboxNotice } from "@/lib/sandbox";

/**
 * Server-rendered so it cannot be missed by a client that fails to hydrate,
 * and so it is present in the HTML a crawler or a screenshot captures.
 */
export default function SandboxBanner() {
  if (!isSandbox()) return null;
  const notice = sandboxNotice();

  return (
    <div className="sandbox-banner" role="note">
      <div className="sandbox-inner">
        <span className="sandbox-tag">SANDBOX</span>
        <p>
          <strong>{notice.title}.</strong> {notice.body}
        </p>
        <p className="sandbox-creds mono">
          Demo login: {notice.demo.email} / {notice.demo.password}
        </p>
      </div>
    </div>
  );
}
