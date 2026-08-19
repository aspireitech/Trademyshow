# What it costs to launch and run

Two separate questions people conflate: **one-time costs to get live**, and **monthly costs
once you are**. Figures are estimates from mid-2026 market rates — treat them as a budgeting
range, not a quote, and get current pricing before you commit.

---

## 1 · One-time, before launch

| Item | Range | Notes |
|---|---|---|
| Securities-lawyer review | **$2,000 – $8,000** | The one that actually matters. See §4. |
| Penetration test | **$0 – $15,000** | Huge range depending on route. See §3. |
| Company formation, if not already | $100 – $800 | LLC/Ltd + registered agent |
| Domain | $10 – $40/yr | — |
| **Realistic minimum to launch responsibly** | **~$2,500** | Lawyer + a freelance security review |
| **Comfortable** | **~$12,000** | Lawyer + full pen test |

## 2 · Monthly, once live

| Item | Starting | At 1,000 subscribers |
|---|---|---|
| Hosting (Vercel/Render/Fly) | $0 – $20 | $20 – $100 |
| Market data | $0 – $50 | $50 – $250 |
| News feed | $0 – $50 | $50 – $450 |
| Email delivery | $0 (3k/mo free) | $20 – $50 |
| LLM narration | **$0** | **$13 – $99** — see §5 |
| Error tracking | $0 | $0 – $26 |
| Stripe fees | 2.9% + $0.30 per charge | ~$390 on $12k MRR |
| **Total infrastructure** | **~$0 – $120** | **~$150 – $1,000** |

At 1,000 Pro subscribers ($12/mo) that is **$12,000 revenue against roughly $550–$1,400 of
cost**, Stripe included. The margin is not the problem with this business; distribution is.

---

## 3 · The penetration test

### Why one is needed even though the security work is done and tested

Every security control in this codebase was written and tested by the same author. That is the
weakness, and it is not a small one: **a test can only fail for a reason its author thought of.**
The tests encode exactly the same assumptions as the code they check, so any assumption that is
wrong is wrong in both places simultaneously, and everything still goes green.

This is not hypothetical here. It already happened, twice, in this repository:

- **The Content-Security-Policy blocked every script in production.** CSP code was written. CSP
  tests were written. Both passed. The production site rendered HTML and did absolutely nothing —
  no login, no watchlists. What caught it was loading a real production build in a real browser
  and reading the console, which is a different *kind* of check, not a more careful one.
- **The unsubscribe link verified the user's email address**, because it reused the verification
  token helper. Every test passed, because no test asked "does unsubscribe do anything it
  shouldn't?" — only "does unsubscribe work?"

A pen tester's job is to ask the questions the author did not think to ask. Specifically, the
things testing from inside cannot reach:

| Gap | Why the test suite cannot cover it |
|---|---|
| Deployed configuration | Tests run against localhost. TLS setup, real headers, proxy behaviour, DNS and leaked env vars only exist in production. |
| Business-logic abuse chains | Each rule is tested alone. Nobody tested *trial → referral → promo → cancel → re-signup* as one chain to see if it yields free service forever. |
| Concurrency and races | Tests are sequential. Two simultaneous requests redeeming the same single-use promo is a different program. |
| Dependency chain | Dependabot flags known CVEs. It says nothing about a transitive package's behaviour. |
| Secret strength in production | `AUTH_SECRET` is validated in shape, not in entropy. Nothing stops a deployment shipping `change-me-in-production`. |
| The unknown unknowns | The whole point. |

**Short version:** the code is in the best possible state to be tested — every control built,
every one covered — which is exactly when outside review is worth paying for. Testing an
unfinished system wastes the engagement.

### What it costs, cheapest first

| Route | Cost | What you get | When it fits |
|---|---|---|---|
| Automated scanning (OWASP ZAP, `npm audit`, Snyk free) | **$0** | Known CVEs, missing headers, obvious injection. Catches maybe 30% of what a human finds. | Do this now, regardless |
| Freelance security engineer, 2–3 days | **$1,500 – $5,000** | A real human reading auth, billing and session logic. Best value at this stage. | Pre-revenue, before first payment |
| Bug bounty (HackerOne, Intigriti) | **$500+ pool, pay per finding** | Many eyes, ongoing, costs nothing if nothing is found. | After launch, once there are real users |
| Boutique firm, scoped web-app test | **$5,000 – $15,000** | Formal report, retest, a letter you can show enterprise customers | When a customer or insurer asks |
| Big-name firm | $15,000 – $40,000+ | The brand on the report | Not you, not yet |

**Recommendation: the $0 tier today, the $1,500–$5,000 tier before you accept the first
payment.** A full firm engagement is not proportionate to a pre-revenue product, and the money
is better spent on the lawyer.

---

## 4 · The lawyer review

### What is actually being asked

Not "please read my Terms of Service." The question is narrow and specific:

> Does TradeMyShow fall within the publisher exclusion of the Investment Advisers Act
> §202(a)(11)(D), or does it constitute investment advice requiring registration?

The whole product is designed around the answer being *yes, it is publishing*: the AI narrates
numbers it cannot alter, nothing is personalised to an individual's circumstances, expectations
are stated as historical base rates rather than forecasts, and no buy/sell language appears
anywhere. That is a defensible position — it is roughly the ground *Lowe v. SEC* settled — but
**"defensible" is a lawyer's word, and only a lawyer gets to say it about your specific product.**

### Cost

| Route | Cost | Reality |
|---|---|---|
| Template generator (Termly, Iubenda) | $10 – $50/mo | Produces a Privacy Policy and ToS. Says **nothing** about the publisher exclusion — the only question that matters here. Necessary, nowhere near sufficient. |
| Securities lawyer, scoped review + memo | **$2,000 – $8,000** | 5–15 hours at $300–$700/hr. Reviews the disclaimers, the product copy, the score methodology and the not-advice posture, and writes an opinion you can rely on. |
| Fintech launch package (some firms) | $3,000 – $10,000 flat | Same, bundled with entity and ToS work |
| Ongoing counsel retainer | $500 – $2,000/mo | Not needed yet |

**Ask for a scoped engagement, not open-ended hours.** The brief is one page: "SaaS publishing
algorithmic stock analysis with AI-written commentary, no personalisation, no execution, no
custody of funds. Confirm publisher-exclusion posture and review disclaimers." Specialists in
this exact question quote flat fees because they answer it often.

**Do not skip this one to save money.** It is the cheapest item on the list relative to what
being wrong costs, and unregistered investment advice is not a fine — it is a cease-and-desist
that ends the company.

---

## 5 · Market data and news licensing

### The cost driver nobody expects: *display rights*

Market-data pricing is not really about the API. It is about what you are permitted to *show*,
and to whom:

| Data type | Typical cost | Redistribution |
|---|---|---|
| **End-of-day / delayed (15 min)** | $0 – $100/mo | Usually redistributable to end users |
| **Real-time consolidated** | $500 – $5,000+/mo | Requires exchange agreements (NYSE, Nasdaq) with **per-user monthly fees** |

**This product does not need real-time data, and that is worth real money.** Daily and weekly
insights are computed from closes. Buying end-of-day data keeps you in the cheap tier and out of
per-user exchange fees entirely — a decision that scales from $50/month instead of $500 plus
$1–$25 per subscriber per month.

**Read the redistribution clause before you sign.** Several providers' cheap tiers permit
internal analysis only, not showing prices to your customers. That is the clause that would
break a $12/month consumer product, and it is why this item sits at the top of the checklist
rather than the bottom.

### Rough provider pricing

| Provider | Free tier | Paid from | Notes |
|---|---|---|---|
| Alpha Vantage | Yes, heavily limited | ~$50/mo | Includes a news-sentiment endpoint |
| Finnhub | Yes | ~$50/mo | Prices + news + fundamentals in one |
| Twelve Data | Yes | ~$29/mo | Good EOD coverage |
| Polygon.io | Limited | ~$29 – $199/mo | Strong US equities |
| EOD Historical Data | Trial | ~$20 – $100/mo | Cheapest for exactly this use case |

**News** is often bundled (Finnhub, Alpha Vantage) — start there rather than buying a separate
news API. Dedicated feeds run $0–$450/mo, and premium financial newswires (Benzinga, Dow Jones)
run into thousands.

**Budget $50–$150/month to start**, and expect the licence reading to take longer than the
integration.

---

## 6 · The AI keys — why they are not a blocker

This surprises people, so it is worth stating plainly: **the product ships and works with no AI
key at all.** That was a deliberate design decision, and it is tested. When no provider is
configured — or when every provider is rate-limited — a deterministic template writer produces
the insight instead. The numbers are identical either way, because the numbers are computed by
the scoring engine and the AI never touches them. What a key buys is better *prose*.

So an LLM key is a quality upgrade, not a launch dependency, which is why it sits as **partial**
on the tracker rather than **blocks launch**.

### What it actually costs

Measured from this codebase's real digest payload: **~1,800 input tokens and ~400 output tokens
per digest**, at 26 digests per subscriber per month (22 weekday dailies + 4 weekly wraps).

| Provider | Per digest | Per subscriber/month | At 1,000 subscribers |
|---|---|---|---|
| **Gemini 2.5 Flash** (primary) | $0.0015 | $0.04 | **~$40/mo** |
| GPT-4o mini | $0.0005 | $0.01 | ~$13/mo |
| Claude Haiku 4.5 | $0.0038 | $0.10 | ~$99/mo |
| Claude Opus (premium tier only) | $0.057 | $1.48 | ~$1,482/mo |
| **No key — template writer** | $0 | $0 | **$0** |

Two things follow:

1. **Gemini's free tier covers early usage entirely.** At launch volumes the AI bill is zero,
   which is exactly why it is configured as the primary provider.
2. **Even at 1,000 paying subscribers, narration costs ~$40/month against $12,000 of revenue.**
   Roughly 0.3%. AI is not a cost risk in this business at any plausible scale — unless you
   route everything through a frontier model, which is why Opus is listed above as a
   premium-tier-only option rather than a default.

The backup keys (Anthropic, OpenAI) cost **nothing while Gemini is healthy**, because failover
only fires on an actual quota error. They are insurance, not a running expense.

---

## 6b · Insurance — the layer that actually caps your downside

Disclaimers reduce the chance a claim succeeds. **Insurance pays when one succeeds anyway.**
That distinction is the whole reason this section exists: no drafting makes an owner
liability-free, and the contractual cap in the Terms only binds users who agreed to it — it does
nothing about a regulator, and nothing about a claim that falls outside the cap's carve-outs
(fraud, wilful misconduct, non-excludable consumer rights).

| Cover | Typical annual premium | What it is for |
|---|---|---|
| **Errors & Omissions / Professional Indemnity** | **$1,000 – $3,000** | A user claims your analysis caused loss. The core policy for this product. |
| Cyber / data breach | $500 – $2,000 | Breach response, notification costs, regulatory defence |
| General liability | $400 – $800 | Usually bundled; rarely the relevant one here |
| Directors & Officers | $1,500 – $5,000 | Only once you take outside investment |

**Buy E&O before the first paying customer.** It is cheaper than a single hour of defending a
claim, and most insurers will ask to see your Terms — which is a useful free review of whether
the limitation and arbitration clauses read as competent.

Tell the insurer plainly what the product does: publishes algorithmic analysis, no personalised
advice, no execution, no custody. Understating the activity to get a lower premium is the
reliable way to have a claim denied at exactly the wrong moment.

---

## 7 · Summary

**To publish, you must spend:** the lawyer (~$2,000–$8,000) and a data licence (~$50–$150/mo).
Everything else has a free or near-free tier that is genuinely adequate at launch.

**To publish responsibly, add:** a freelance security review (~$1,500–$5,000) before you accept
the first payment.

**Total to be live and defensible: roughly $4,000–$13,000 one-time, plus $50–$200/month**, plus
**$1,000–$3,000/year for E&O insurance** — which is the only item on this page that actually caps
your personal downside, as opposed to reducing the odds of reaching it.

The largest cost on this page is the one with no invoice attached: the weeks of lead time on the
lawyer and the data contract. Start both this week.
