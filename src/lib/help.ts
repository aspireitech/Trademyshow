/**
 * Help centre content.
 *
 * The questions are ordered by what a nervous first-time visitor actually
 * wants to know, and the ones about advice, accuracy and data come first on
 * purpose. Answering "do you make recommendations?" in public, plainly, is
 * both the honest thing and part of the record that this is a publication
 * rather than an advisory service.
 */

export interface HelpArticle {
  q: string;
  a: string[];
}

export interface HelpCategory {
  id: string;
  title: string;
  blurb: string;
  articles: HelpArticle[];
}

export const HELP: HelpCategory[] = [
  {
    id: "what-this-is",
    title: "What this is",
    blurb: "The questions worth asking before you trust any of it.",
    articles: [
      {
        q: "Do you make stock recommendations?",
        a: [
          "No. TradeMyShow publishes analysis and education. It never tells you what to buy, sell or hold, and it does not know your financial situation, goals or tax position — we do not ask, and we could not tailor anything to them if we did.",
          "Everything you see is the same computation applied identically to every instrument. Where we describe what happened after similar past readings, that is a historical frequency with its sample size attached, not a prediction.",
        ],
      },
      {
        q: "Can I invest or trade through the platform?",
        a: [
          "No. We do not execute orders, hold money, or connect to a broker. Nothing you do here moves a single share.",
        ],
      },
      {
        q: "How is the Insight Score calculated?",
        a: [
          "It is a weighted average of four measured components: news sentiment (30%), trend consistency across timeframes (30%), momentum relative to the longer-term pace (25%) and price stability (15%).",
          "Every component is shown with its value, its weight and a sentence explaining it. Multiply each value by its weight, add them up, and you get the score back — you can check our arithmetic with a calculator, which is rather the point.",
        ],
      },
      {
        q: "Is the score a prediction?",
        a: [
          "No. It describes the strength of signals visible right now. A high score means several measures currently agree, not that the price will rise.",
          "Our published track record shows how scores have actually performed, including where they have not. If the score stopped predicting anything, that page is where you would see it first.",
        ],
      },
      {
        q: "Why does the AI write the words but not the numbers?",
        a: [
          "Every figure is computed by our own engine before the AI sees anything. The model receives those finished numbers and writes the explanation around them; it cannot change a single one.",
          "That separation is deliberate. It means an AI error can produce a clumsy sentence but never a wrong number, and it is why the explanation always matches the data underneath it.",
        ],
      },
    ],
  },
  {
    id: "data",
    title: "Data and accuracy",
    blurb: "Where the numbers come from and how current they are.",
    articles: [
      {
        q: "Where does your data come from?",
        a: [
          "Prices and company news come from third-party market-data providers. Analysis is computed from that data by our own engine.",
          "We do not originate the underlying data and cannot guarantee its accuracy. If a figure looks wrong, tell us and we will check it against the provider.",
        ],
      },
      {
        q: "Is the price data real-time?",
        a: [
          "No. Prices should be assumed delayed or end-of-day unless a page says otherwise. This product explains daily and weekly movement, which is computed from closing prices — real-time quotes would add cost and licensing complexity without improving a single insight.",
          "Do not use anything here for a time-sensitive decision.",
        ],
      },
      {
        q: "Why does your data differ from another finance site?",
        a: [
          "Different providers timestamp and adjust differently — for splits, dividends and after-hours activity. Small discrepancies between sites are normal.",
          "Large ones are not. If you find one, report it.",
        ],
      },
      {
        q: "Which instruments do you cover?",
        a: [
          "Listed equities, index and sector funds, bond and commodity ETFs, and the major crypto pairs — all scored by the same model, with no separate treatment for any asset class.",
        ],
      },
    ],
  },
  {
    id: "account",
    title: "Account and security",
    blurb: "Signing in, protecting the account, and getting back in.",
    articles: [
      {
        q: "What is the difference between the authenticator app and SMS codes?",
        a: [
          "The authenticator app is stronger and free. It generates codes on your device with no network involved, so nothing can be intercepted.",
          "SMS is a backup. Anyone who takes over your phone number — which is easier than it should be — receives your codes. Use SMS as a way back in, not as your main protection.",
        ],
      },
      {
        q: "What are security questions used for?",
        a: [
          "Support uses them to confirm it is really you, alongside your email address. They never sign you in and never reset a password on their own.",
          "Your answers are stored scrambled and cannot be read back by anyone here, including us.",
        ],
      },
      {
        q: "I have lost access to my two-factor device.",
        a: [
          "Use one of the recovery codes shown when you turned two-factor on. Each works once.",
          "If those are gone too, contact support from the email address on the account. Recovery involves your verified email and your security questions together — never one alone.",
        ],
      },
      {
        q: "How do I see what has happened on my account?",
        a: [
          "Settings → Activity lists every event: sign-ins, password changes, plan changes, downloads. Entries worth a second look are marked.",
          "If you see something you did not do, change your password and sign out your other devices from Settings → Security.",
        ],
      },
    ],
  },
  {
    id: "billing",
    title: "Plans and billing",
    blurb: "Trials, changing tier, pausing and refunds.",
    articles: [
      {
        q: "What happens when the free trial ends?",
        a: [
          "Nothing is charged. We take no card to start a trial, so there is nothing to charge — the account simply returns to the free plan unless you choose to subscribe.",
        ],
      },
      {
        q: "Can I pause instead of cancelling?",
        a: [
          "Yes. Settings → Plan & billing lets you pause for between a week and three months. Billing and emails stop; your watchlists, history and everything else stay exactly as they are.",
          "It resumes on its own at the end, or immediately whenever you choose.",
        ],
      },
      {
        q: "How do I change or cancel my plan?",
        a: [
          "Settings → Plan & billing. Upgrades take effect immediately; downgrades and cancellations take effect at the end of the period you have already paid for.",
        ],
      },
      {
        q: "Do you offer refunds?",
        a: [
          "If the product is not what you expected, write to us within 30 days of a charge and we will refund it. No form, no argument.",
          "Where local consumer law gives you a stronger right, that applies in addition.",
        ],
      },
      {
        q: "How does the referral programme work?",
        a: [
          "Share the link in Settings → Plan & billing. When someone you refer subscribes, you earn a share of what they pay for as long as they stay.",
          "Commission is paid on money actually received and kept, after any refund. It is not a security or an investment.",
        ],
      },
    ],
  },
];

export function findCategory(id: string): HelpCategory | null {
  return HELP.find((c) => c.id === id) ?? null;
}

export function articleCount(): number {
  return HELP.reduce((n, c) => n + c.articles.length, 0);
}
