/**
 * Legal configuration and the agreement text itself.
 *
 * The terms live here as structured data, not as JSX, for one reason that
 * matters more than convenience: the page a user reads and the PDF recording
 * what they accepted are rendered from this same object. If they were written
 * twice they would drift, and a signed record that does not match the text
 * shown is worse than no record at all.
 *
 * Bump TERMS_VERSION whenever the text changes. Acceptance is stored against
 * a version, so a later dispute can establish which wording applied.
 */

// ---------- deployment-specific values ----------

/**
 * These MUST be set before launch. The defaults are deliberately obvious
 * placeholders, and `unresolvedLegalPlaceholders()` reports any left in place
 * so a deployment cannot quietly ship "YOUR COMPANY" in a binding contract.
 */
export const LEGAL_CONFIG = {
  companyName: process.env.LEGAL_COMPANY_NAME ?? "[COMPANY LEGAL NAME]",
  companyNumber: process.env.LEGAL_COMPANY_NUMBER ?? "[COMPANY REGISTRATION NUMBER]",
  address: process.env.LEGAL_ADDRESS ?? "[REGISTERED ADDRESS]",
  governingLaw: process.env.LEGAL_GOVERNING_LAW ?? "[GOVERNING LAW JURISDICTION]",
  forum: process.env.LEGAL_FORUM ?? "[COURTS / ARBITRAL SEAT]",
  contactEmail: process.env.LEGAL_CONTACT_EMAIL ?? "legal@trademyshow.com",
  /** Absolute ceiling on aggregate liability, in USD. */
  liabilityCapUsd: Number(process.env.LEGAL_LIABILITY_CAP_USD ?? 1000),
  /** Floor, so the cap is not unconscionably low for a free-tier user. */
  liabilityFloorUsd: 100,
} as const;

export function unresolvedLegalPlaceholders(): string[] {
  return Object.entries(LEGAL_CONFIG)
    .filter(([, v]) => typeof v === "string" && v.startsWith("["))
    .map(([k]) => k);
}

/** Bump on every substantive edit to the text below. */
export const TERMS_VERSION = "2026-08-19.1";
export const PRIVACY_VERSION = "2026-08-19.1";

// ---------- agreement text ----------

export interface LegalSection {
  heading: string;
  /** Paragraphs. A leading "• " marks a bullet. */
  paragraphs: string[];
}

const C = LEGAL_CONFIG;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Who this agreement is between",
    paragraphs: [
      `These Terms of Service ("Terms") are a binding agreement between you and ${C.companyName}, registered in ${C.governingLaw} under number ${C.companyNumber}, of ${C.address} ("TradeMyShow", "we", "us").`,
      `By ticking the acceptance box at registration you confirm that you have read these Terms and the Privacy Policy, that you are at least 18 years old, and that you have the legal capacity to enter this agreement. A dated record of your acceptance, including the version of these Terms you accepted, is generated at that moment and made available to you in your account settings.`,
      `If you do not agree to these Terms, do not register and do not use the service.`,
    ],
  },
  {
    heading: "2. What TradeMyShow is — and what it is not",
    paragraphs: [
      `TradeMyShow is a financial information and analytics publication. It computes descriptive statistics about publicly traded instruments from third-party market data and public news, and publishes plain-language commentary explaining those computations.`,
      `TradeMyShow is NOT, and does not hold itself out as, any of the following:`,
      `• an investment adviser, financial adviser, broker, dealer, or portfolio manager;`,
      `• a provider of personalised investment, financial, legal, accounting or tax advice;`,
      `• a recommendation, solicitation, offer or inducement to buy, sell or hold any security or other instrument;`,
      `• a party that executes transactions, holds client money, or takes custody of any asset.`,
      `Nothing published by TradeMyShow is tailored to your financial situation, investment objectives, tax position, risk tolerance or particular needs. We do not collect that information and we could not tailor content to it. The same computation is applied identically to every instrument for every user.`,
      `Where you enter holdings, you are choosing which publicly available instruments you wish to read published analysis about. Any figure derived from a quantity you enter is arithmetic performed on your own input using public prices. It is not a recommendation, an assessment of suitability, or an opinion about what you should do.`,
      `No fiduciary, advisory, agency, or trust relationship of any kind arises between you and us under these Terms or through your use of the service.`,
    ],
  },
  {
    heading: "3. No reliance, and no guarantee of outcome",
    paragraphs: [
      `You are solely responsible for every investment decision you make and for the consequences of those decisions. You must not treat anything published by TradeMyShow as a substitute for your own research or for advice from a licensed professional in your jurisdiction.`,
      `Past performance of any instrument, and any historical base rate we publish, does not indicate or predict future results. Statistical patterns observed in the past frequently do not persist. Markets can and do move against every signal we compute.`,
      `Investing carries risk, including the total loss of the amount invested. Nothing on the service reduces that risk or is designed to.`,
      `We make no representation or warranty, express or implied, that any content is accurate, complete, current, or fit for any purpose. Content is generated by automated systems, including large language models, which can produce errors.`,
    ],
  },
  {
    heading: "4. Third-party data",
    paragraphs: [
      `Market prices, company information and news headlines are supplied by third-party providers. We do not originate that data, cannot verify it, and are not responsible for its accuracy, completeness, timeliness or continued availability.`,
      `Data may be delayed. Unless a page states otherwise, prices should be assumed to be delayed or end-of-day and must not be relied upon for time-sensitive decisions.`,
      `Your use of third-party data through the service may be subject to the terms of the originating provider or exchange, which we will make available on request.`,
    ],
  },
  {
    heading: "5. Your account",
    paragraphs: [
      `You must provide accurate registration information and keep your credentials confidential. You are responsible for all activity under your account. Tell us promptly at ${C.contactEmail} if you believe your account has been compromised.`,
      `You may not: share or resell access; scrape, mirror or redistribute our content or the underlying data; attempt to defeat access controls, rate limits or usage limits; use the service to build a competing product; or use the service unlawfully or in breach of any market-data licence.`,
      `We may suspend or terminate an account that breaches these Terms, that we reasonably believe presents a security or legal risk, or where required by a data provider or regulator.`,
    ],
  },
  {
    heading: "6. Subscriptions, trials, billing and refunds",
    paragraphs: [
      `Paid plans are billed in advance on a recurring basis through our payment processor. Prices are shown before purchase and exclude taxes unless stated.`,
      `New accounts receive a time-limited trial of paid features without a payment card. The trial ends automatically and does not convert into a paid plan by itself.`,
      `You may cancel at any time. Cancellation stops the next renewal; it does not retroactively refund the current period. Where a statutory right of withdrawal or cancellation applies to you as a consumer, that right applies in addition to these Terms and is not limited by them.`,
      `We may change prices on notice. Changes take effect at your next renewal, never mid-period.`,
    ],
  },
  {
    heading: "7. Referral programme",
    paragraphs: [
      `Where offered, referral commission is payable only on amounts actually received and retained by us from a referred account, after any refund or chargeback. Self-referral, and referral through misrepresentation, spam or automated means, voids all commission.`,
      `We may vary or withdraw the programme on reasonable notice. Commission is not a security, an investment, or a share of profits, and confers no interest in the business.`,
    ],
  },
  {
    heading: "8. Intellectual property",
    paragraphs: [
      `The service, its scoring methodology, its software and its written content are owned by us or our licensors. You receive a personal, non-exclusive, non-transferable, revocable licence to access the service for your own use for as long as your account is in good standing.`,
      `You keep ownership of the watchlists and other inputs you create. You grant us only the licence needed to operate, secure and improve the service.`,
    ],
  },
  {
    heading: "9. Service availability",
    paragraphs: [
      `The service is provided "as is" and "as available". We do not warrant uninterrupted or error-free operation, and we may modify, suspend or discontinue any feature.`,
      `Scheduled communications, including emailed insights, are provided as a convenience. We do not guarantee delivery, timing or receipt, and you must not rely on the arrival of any message.`,
    ],
  },
  {
    heading: "10. Disclaimer of warranties",
    paragraphs: [
      `To the fullest extent permitted by law, we disclaim all warranties, conditions and terms implied by statute or common law, including any implied warranty of merchantability, satisfactory quality, fitness for a particular purpose, accuracy, and non-infringement.`,
      `Some jurisdictions do not allow the exclusion of certain warranties. Where that is so, the exclusions above apply only to the extent permitted, and your mandatory statutory rights as a consumer are unaffected.`,
    ],
  },
  {
    heading: "11. Limitation of liability",
    paragraphs: [
      `To the fullest extent permitted by law, we are not liable for any indirect, incidental, special, consequential, exemplary or punitive damages, nor for lost profits, lost trading gains, trading losses, lost opportunity, lost data, or business interruption, whether in contract, tort (including negligence), statute or otherwise, and whether or not we were advised such loss was possible.`,
      `To the fullest extent permitted by law, our total aggregate liability arising out of or relating to the service or these Terms, for all claims combined, shall not exceed the greater of (a) the fees you actually paid us in the twelve months immediately before the event giving rise to the claim, or (b) US$${C.liabilityFloorUsd} — and shall in no event exceed US$${C.liabilityCapUsd}.`,
      `This limit is a fundamental basis of the bargain between us: the subscription price is set on the assumption that we do not underwrite investment outcomes, and the service would not be offered at this price without it.`,
      `Nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for fraud or fraudulent misrepresentation, for death or personal injury caused by negligence, or under any non-excludable consumer protection statute. Some jurisdictions do not permit the exclusion or limitation of incidental or consequential damages, so parts of this section may not apply to you.`,
    ],
  },
  {
    heading: "12. Indemnity",
    paragraphs: [
      `You agree to indemnify and hold us harmless from third-party claims, losses and reasonable legal costs arising from your breach of these Terms, your misuse of the service, your redistribution of content or data, or your violation of law or of any third party's rights. This does not apply to the extent the claim arises from our own breach, negligence or wilful misconduct.`,
    ],
  },
  {
    heading: "13. Disputes: talk first, then arbitration",
    paragraphs: [
      `Before starting any formal proceeding, you agree to contact us at ${C.contactEmail} and allow 30 days to resolve the matter informally. Most disputes end here.`,
      `If the matter is unresolved, you and we agree that any dispute arising out of or relating to these Terms or the service shall be finally resolved by binding individual arbitration seated in ${C.forum}, conducted in English, rather than in court.`,
      `CLASS ACTION WAIVER. To the fullest extent permitted by law, claims may be brought only in an individual capacity, and not as a plaintiff or class member in any purported class, collective, consolidated or representative proceeding. The arbitrator may not consolidate claims or preside over any form of representative proceeding.`,
      `Either party may bring an individual claim in a small-claims court instead, if it qualifies. Either party may seek injunctive relief in a court of competent jurisdiction to protect intellectual property or confidential information.`,
      `If the class action waiver in this section is found unenforceable as to a particular claim, that claim alone shall proceed in court and the remainder of this section shall continue to apply. Where mandatory local law gives you as a consumer a non-waivable right to bring proceedings in your own courts, or renders a pre-dispute arbitration agreement unenforceable, that law prevails over this section.`,
    ],
  },
  {
    heading: "14. Governing law",
    paragraphs: [
      `These Terms are governed by the laws of ${C.governingLaw}, without regard to conflict-of-laws rules. Where you are a consumer resident elsewhere, you keep the benefit of any mandatory protections of your local law that cannot be varied by agreement.`,
    ],
  },
  {
    heading: "15. Changes to these Terms",
    paragraphs: [
      `We may update these Terms. Material changes will be notified by email or in-app at least 14 days before they take effect, and the version identifier will change. Continuing to use the service after that date constitutes acceptance of the updated Terms. If you do not accept them, you may cancel before they take effect.`,
      `Your original acceptance record remains available in your account and continues to evidence the version in force when you registered.`,
    ],
  },
  {
    heading: "16. General",
    paragraphs: [
      `If any provision is held unenforceable, it shall be modified to the minimum extent necessary to make it enforceable, or severed, and the remaining provisions shall continue in full force.`,
      `Our failure to enforce a provision is not a waiver of it. You may not assign these Terms; we may assign them in connection with a merger, acquisition or sale of assets.`,
      `These Terms, together with the Privacy Policy, form the entire agreement between us about the service and supersede any prior understanding.`,
      `Questions: ${C.contactEmail}.`,
    ],
  },
];

/** Rendered at the head of both the page and the PDF. */
export const TERMS_SUMMARY = [
  "TradeMyShow publishes analytics and education about publicly traded instruments. It is not investment advice and never tells you what to buy or sell.",
  "Nothing here is personalised to your circumstances, and no adviser or fiduciary relationship is created.",
  "You are responsible for your own investment decisions. Investing can lose money, including everything you put in.",
  `Our total liability is capped, and disputes go to individual arbitration rather than court or class action.`,
];
