import { enabledProviders } from "@/lib/oauth";

/**
 * Rendered on the server so the buttons only exist when the provider is
 * actually configured — a dead "Continue with Google" button is worse than
 * no button at all.
 */
export default function SocialButtons({ ref: refCode }: { ref?: string }) {
  const providers = enabledProviders();
  if (providers.length === 0) return null;

  const query = refCode ? `?ref=${encodeURIComponent(refCode)}` : "";

  return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      <div style={{ display: "grid", gap: 8 }}>
        {providers.map((p) => (
          <a key={p.id} className="btn secondary" href={`/api/auth/oauth/${p.id}${query}`}>
            Continue with {p.label}
          </a>
        ))}
      </div>
      <div className="or-divider">
        <span>or</span>
      </div>
    </div>
  );
}
