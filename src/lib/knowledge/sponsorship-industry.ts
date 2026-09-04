// Sponsorship industry knowledge base for Nolan (ROI v2 / Nolan v2, Phase C1).
//
// Source: an independently-researched industry report on creator-sponsor
// market structure, deal economics, contracts, measurement, and compliance
// (public information through September 2, 2026), cleaned of citation
// rendering artifacts. Prose attributions (e.g. "Hootsuite's 2026 pricing
// guide", "FTC guidance") are preserved as the actual sourcing.
//
// Deliberately excludes the source document's own "Sponsorship negotiation
// agent" section -- that section is a blueprint for building an AI agent
// (system prompt, workflow, output format), not domain knowledge. It
// informed the rewrite of NOLAN_SYSTEM_PROMPT (src/lib/claude.ts) instead
// of being included here, where a model reading it as reference material
// would be confusingly reading a spec for an agent rather than a fact base.
//
// This is Nolan's largest stable input (~15K tokens) and belongs at the end
// of the cached system-prompt prefix -- see the cache_control placement in
// src/app/api/nolan/chat/route.ts and src/app/api/nolan/analyze/route.ts.
// Keep this file free of anything per-request or per-user; a single
// volatile byte here silently invalidates the cache for every Nolan call
// (AGENTS.md).

export const SPONSORSHIP_INDUSTRY_KNOWLEDGE = `# Creator–Sponsor Industry: Market Structure, Deal Economics, Contracts, Measurement, Compliance, and Negotiation

## Executive summary

The creator–sponsor business has moved from an experimental social-media tactic into a distinct advertising and commerce channel. The Interactive Advertising Bureau estimates that U.S. creator advertising reached **$37 billion in 2025** and projects approximately **$44 billion in 2026**; IAB describes the market as shifting from campaign-by-campaign influencer work toward “always-on” creator programs embedded in brands' media strategies, workflows, and even product development. citeturn13view4turn18search2 CreatorIQ's 2025–2026 industry research similarly reports that 71% of surveyed organizations increased creator-marketing investment year over year, although its reported 171% increase in average annual budgets should be treated as a vendor-survey statistic rather than a census of the market. citeturn18search1turn18search4

The industry's core economic transaction is no longer simply **“brand pays influencer for a post.”** A creator can simultaneously be a producer, media property, spokesperson, licensor of intellectual property and likeness, affiliate salesperson, and source of paid-ad creative. Brands increasingly combine organic creator distribution with paid amplification, commerce tracking, affiliate commissions, and platform-native advertising tools. YouTube, for example, now gives advertisers Creator Partnerships tools for creator discovery, sponsored-video management, organic-and-paid measurement, and amplification; its core Creator Partnerships features expanded in June 2026 to locations where the YouTube Partner Program operates. citeturn16view3

The most important analytical conclusions are:

**There is no universal creator rate card.** Follower tiers are convenient shorthand, but even major industry guides disagree about tier boundaries and prices. A 2026 Hootsuite framework calls 10,000–50,000 followers “micro,” while Shopify uses 10,001–100,000; both explicitly warn that audience quality, engagement, niche, production requirements, usage rights, and exclusivity can materially change price. citeturn17view0turn17view6 A rigorous buyer should therefore benchmark **expected impressions, historical conversion performance, production value, rights, and opportunity cost**, not simply multiply followers by a fixed dollar amount.

**The deliverable fee and the rights fee should be conceptually separated.** A creator charging $3,000 to make and publish a video is providing something materially different from granting a brand the right to run that video globally in paid advertising for a year, edit it into derivatives, use the creator's likeness, and bar the creator from working with competitors. SAG-AFTRA specifically advises creators to scrutinize compensation, content ownership, and exclusivity because those provisions affect both ownership and future commercial opportunities. citeturn13view10

**Performance guarantees require care.** A creator can guarantee production, timely posting, disclosures, link placement, reporting, and minimum live time. A creator ordinarily cannot control an algorithm sufficiently to guarantee a precise number of organic views, sales, or impressions. YouTube itself states that its advertising-revenue arrangements do not guarantee how much—or whether—a creator will be paid. citeturn16view2 Contracts should therefore distinguish **creator-controlled failures**, which can justify makegoods, from **market/platform outcomes**, which generally should be treated as performance targets rather than warranties.

**Measurement should follow the campaign objective.** Awareness programs should emphasize qualified reach, impressions, completed views, effective CPM, and preferably lift; engagement programs should measure relevant interactions and CPE; commerce programs should measure clicks, conversion rate, CPA, attributable revenue, new-customer rate, and ROAS. Platform experiments provide a stronger causal signal than simple last-click attribution: Google's Brand Lift measures outcomes such as awareness, consideration and purchase intent, while Conversion Lift uses treatment/control approaches to estimate incremental conversions. citeturn16view4turn16view5

**Disclosure risk belongs to both brand and creator.** FTC guidance treats money, free or discounted products, trips, commissions, employment, and other material connections as potentially disclosure-triggering relationships. A platform's built-in disclosure tool is not automatically sufficient; the FTC says ultimate responsibility for a clear and conspicuous disclosure rests with the influencer and brand. Brands also remain responsible when agencies or intermediaries run the program and should train and monitor endorsers. citeturn15view0turn15view1turn15view2

**Privacy becomes especially consequential once a creator campaign leaves the platform and enters tracking, CRM, retargeting, custom audiences, affiliate attribution, or children's content.** GDPR can apply to EU establishments and, in specified circumstances, non-EU businesses offering goods or services to or monitoring people in the EU; it imposes principles and lawful-basis, transparency and processor requirements. citeturn14view4turn14view0turn14view1turn14view2turn14view3 COPPA is particularly important for commercial creator content directed to children under 13: the FTC expressly says a commercial video creator can become an operator subject to COPPA when child-directed content involves collection on the creator's behalf, including persistent identifiers used for targeted advertising. citeturn16view0

The practical model that follows from these findings is:

> **Creator compensation = creation + distribution + licensed rights + exclusivity/opportunity cost + complexity + risk + performance upside.**

That decomposition is more useful than a follower-count rate card and provides the cleanest basis for negotiation, contract drafting, and campaign analysis. Industry pricing sources themselves identify usage rights, exclusivity, format, production, campaign length, audience quality and engagement as major price variables. citeturn17view0turn17view7

This report reflects public information available through **September 2, 2026**.

## Market structure and ecosystem

Creator advertising operates as a multi-sided market rather than a simple buyer–seller relationship. At one end sits the advertiser and its agencies; at the other sits the creator and audience; between them are managers, talent agencies, MCNs, creator marketplaces, affiliate networks, ad-tech infrastructure, platforms, lawyers, accountants, measurement providers and, increasingly, commerce platforms. IAB's description of creators as a core media channel and Google's integration of creator discovery, sponsorship management, paid promotion and analytics illustrate how formerly separate layers are converging. citeturn13view4turn16view3

\`\`\`mermaid
flowchart LR
 B[Brand / Advertiser]
 M[Brand Marketing Team]
 A[Media / Creative / PR Agency]
 P[Creator Platform / Marketplace]
 TM[Talent Manager / Creator Agency]
 MCN[MCN / Creator Network]
 C[Creator]
 S[Social / Video Platform]
 AU[Audience]
 AF[Affiliate / Commerce Network]
 AD[Ad Network / Programmatic Marketplace]
 L[Legal / Compliance Counsel]
 ME[Measurement / Fraud / Brand-Safety Vendor]

 B --> M
 M --> A
 M --> P
 A --> P
 P --> TM
 TM --> C
 MCN --> C
 C --> S
 S --> AU

 C --> AF
 AF --> B

 AD --> S
 S --> C

 B --- L
 C --- L
 A --- L

 B --> ME
 A --> ME
 ME --> S
\`\`\`

This diagram is a synthesis of the operating relationships described by IAB, platform creator-partnership products, and YouTube's official description of MCNs. YouTube says MCNs and channel-management providers may perform audience development, programming, creator collaboration, digital-rights management and media sales for creators and IP owners. citeturn20search0

**Creator tiers.** The following taxonomy is useful for benchmarking, but the labels are conventions, not legal or industry-standard classifications. Hootsuite's 2026 taxonomy is used throughout this report for internal consistency; Shopify's different micro-tier boundary demonstrates why every rate analysis should state its definitions. citeturn17view0turn17view6

| Tier used in this report | Followers/subscribers | Typical economic characteristics | Best-fit use cases |
|---|---:|---|---|
| Nano | 1K–10K | Small absolute reach; often highly specialized/local; low fixed cost | Sampling, local businesses, niche UGC, affiliate tests |
| Micro | 10K–50K | Meaningful niche audience without celebrity economics | Performance tests, product launches, specialist categories |
| Mid-tier | 50K–500K | Can offer material scale plus recognizable creator identity | Larger launches, integrated campaigns, repeated sponsorships |
| Macro | 500K–1M | Large distribution; higher opportunity cost and scrutiny | Broad awareness, premium launches, multi-format campaigns |
| Mega | 1M+ | Very high reach and potentially celebrity-like rights economics | National/global campaigns, major media moments, ambassadorships |

Tier boundaries above follow Hootsuite's 2026 framework. Shopify instead defines micro as 10,001–100,000 and mid-tier as 100,001–500,000, underscoring that a creator's label should never substitute for actual audience data. citeturn17view0turn17view6

**The main ecosystem participants and their incentives are:**

| Participant | What it supplies | How it typically earns money | Principal conflict/risk |
|---|---|---|---|
| Creator | Creative production, voice, audience access, likeness, IP and/or sales influence | Flat fees, retainers, royalties, affiliate commissions, rev-share, platform revenue | Overbroad rights, exclusivity, nonpayment, audience fatigue |
| Creator manager / talent agent | Sales, negotiation, deal administration, career strategy | Commission or management fee | Incentive to maximize gross deal value vs. long-term creator fit |
| Influencer/creator agency | Campaign strategy, discovery, contracting, logistics, reporting | Brand retainer/project fee, sometimes markup | Incentive opacity; brand still retains compliance exposure |
| MCN / creator network | Channel services, monetization, rights management, media sales, collaborations | Revenue share or contractual fees | Long-term commitments and control over channel economics |
| Brand / advertiser | Budget, product, brief, claims substantiation, amplification | Product sales, leads, awareness, retention | Overpaying for nominal followers; liability for endorsements |
| Media/creative/PR agency | Planning, creative direction, paid media, PR, creator operations | Agency fees and/or percentage of media | Too many approval layers can dilute creator-native content |
| Platform | Distribution, ad inventory, discovery, analytics and commerce | Advertising, commerce and platform economics | Policy changes; platform-defined measurement |
| Creator marketplace / SaaS | Search, workflows, contracting, payments, analytics | SaaS, transaction fee or marketplace spread | Database quality and marketplace-selection bias |
| Affiliate network / retailer | Links, codes, attribution, merchant relationships, commission settlement | Network fee / merchant economics | Last-click incentives, returns, cookie-window disputes |
| Programmatic ad network | Dynamically monetized ad inventory | Media spread/platform share | Creator may have little control over advertiser adjacency |
| Measurement / fraud / brand-safety vendor | Audience verification, analytics, brand-safety screening | Subscription/data fees | Imperfect signals and false positives |
| Legal counsel | Contract, IP, advertising, privacy, employment/union and dispute advice | Professional fees | Should be independent of counterparty where material conflicts exist |
| Accountant / business manager | Tax, entity, bookkeeping, collections | Professional fees | Cross-border withholding, sales/VAT and classification complexity |

The MCN characterization is consistent with YouTube's current services directory. Creator-marketplace economics also vary: for example, Collabstr currently advertises search, direct hiring, escrow-style payment workflows and live analytics, with marketplace hiring fees that vary by service tier; this illustrates that intermediaries can add a distinct transaction-cost layer above the creator's own compensation. citeturn20search0turn18search15

**The deal taxonomy is broader than “sponsored posts.”**

| Deal type | Compensation model | Creator distributes? | Brand receives reusable content? | Main contractual issue |
|---|---|---:|---:|---|
| Sponsored post / video | Flat fee | Yes | Sometimes | Deliverable and organic live period |
| Integrated sponsorship | Flat fee / CPM hybrid | Yes | Limited unless licensed | Placement, duration, talking points |
| Dedicated branded content | Higher flat fee | Yes | Often | Creative approval and ownership |
| Product seeding / gifting | Product only or no guaranteed post | Maybe | Usually no | Disclosure and whether posting is actually required |
| Affiliate | % of attributable sale or fixed CPA | Yes | Usually no | Attribution window, returns, commission basis |
| Performance hybrid | Minimum guarantee + CPA/CPS bonus | Yes | Maybe | Baseline guarantee and attribution |
| Brand ambassadorship | Retainer + deliverables, often bonus | Yes | Often | Exclusivity, term and renewal |
| UGC creation | Production fee | Not necessarily | Yes | License scope is the economic core |
| Licensing | License/royalty fee | No additional post required | Yes | Media, term, territory, edits and sublicensing |
| Paid amplification / partnership ad | Base post + paid-use rights | Initially | Yes for specified ad use | Account authorization and paid-media term |
| Revenue share | Percentage of defined revenue/profit | Maybe | Depends | Definition of revenue, deductions and audit rights |
| Platform affiliate shopping | Commission | Yes | Platform-dependent | Merchant terms and reversals |
| Programmatic/platform ads | Platform revenue share | Creator supplies underlying content | Advertiser buys ad inventory, not endorsement | Ad adjacency and platform rules |
| Appearance/event/live activation | Day/event fee | Possibly | Only if separately licensed | Travel, recording rights, cancellation |

FTC guidance confirms that affiliate relationships require disclosure and that free products can create material connections even when no cash changes hands. citeturn15view1turn15view2 YouTube's Shopping affiliate program is an example of a platform-native affiliate structure in which eligible creators can tag products and receive merchant-funded commissions, while YouTube's Partner Program separately lets creators share in advertising revenue around their content. citeturn20search1turn16view2

The distinction between **direct sponsorship** and **programmatic monetization** is crucial. In a sponsorship, a creator is ordinarily knowingly associated with the sponsor and may be endorsing or integrating the product. In programmatic advertising, an ad marketplace or platform sells inventory around content dynamically; the creator can earn revenue without personally endorsing each advertiser. YouTube's monetization documentation expressly distinguishes creator advertising-revenue sharing from other monetization features. citeturn16view2

## Deal economics and pricing

Creator pricing is best understood as a bundle of assets, not a price per follower:

Total creator price = production + organic distribution + usage/license + exclusivity + complexity/rush + performance upside - portfolio/package discount

This is an analytical decomposition rather than a mandated industry formula, but it reflects the principal variables identified by current pricing guides: platform, audience, campaign scope, content format, usage rights, exclusivity, engagement and production requirements. citeturn17view0turn17view7

**Directional per-deliverable benchmarks.** The table below normalizes Hootsuite's 2026 ranges to the tier definitions used earlier. These figures should be treated as *discovery-stage budget ranges*, not fair-market-value determinations or guaranteed transaction prices. Hootsuite itself states that there is no universal rate card. citeturn17view1

| Platform | Nano 1K–10K | Micro 10K–50K | Mid 50K–500K | Macro 500K–1M | Mega 1M+ |
|---|---:|---:|---:|---:|---:|
| Instagram | $20–$200 | $200–$2,000 | $2,000–$5,000 | $5,000–$15,000 | $15,000–$50,000+ |
| TikTok | $20–$500 | $500–$2,000 | $2,000–$5,000 | $5,000–$20,000 | $20,000+ |
| YouTube | $100–$500 | $500–$5,000 | $5,000–$15,000 | $15,000–$25,000 | $25,000+ |
| X | $2–$25 | $25–$100 | $100–$1,000 | $1,000–$2,000 | $2,000+ |
| Facebook | $25–$200 | $200–$1,000 | $1,000–$5,000 | $5,000–$10,000 | $10,000+ |
| Twitch | $50–$120 | $120–$600 | $600–$3,000 | $3,000–$15,000 | $15,000+ |

Instagram ranges are sourced to Hootsuite's 2026 pricing guide. citeturn17view1 TikTok and YouTube ranges come from the same guide. citeturn17view2turn17view3 X, Facebook and Twitch ranges are likewise Hootsuite estimates, with its Twitch figures attributed by Hootsuite to Infloq. citeturn17view3turn17view4turn17view5

There is substantial benchmark dispersion. Shopify's 2026 aggregation, using a broader 10K–100K micro tier, estimates **Instagram micro posts at $250–$5,000**, TikTok micro posts at **$200–$1,200**, and YouTube micro work at **$1,000–$10,000**. Shopify expressly says its figures aggregate multiple outside sources and should be treated as directional because niche, audience quality, engagement and scope can outweigh follower count. citeturn17view6turn17view7turn17view8

Marketplace transaction data can look dramatically lower still. Collabstr's 2026 marketplace report says roughly 80% of transactions on its platform were under $300, while its August 2026 Instagram analysis reported an average paid Instagram collaboration of $193 and an average posted rate of $214. Those figures describe the mix of transactions occurring on a self-serve marketplace—which includes small creators and UGC engagements—and therefore should not be interpreted as evidence that a large established creator's $10,000+ quote is inherently anomalous. citeturn18search0turn18search3

That divergence is one of the industry's most important pricing lessons: **rate-card benchmarks and marketplace transaction averages measure different populations and scopes.**

**Pricing models should map to the economic objective.**

| Pricing model | Formula / mechanism | Best suited to | Main weakness |
|---|---|---|---|
| Flat fee | Negotiated amount per deliverable/package | Creative campaigns | Weak direct tie to performance |
| CPM | Spend ÷ impressions × 1,000 | Awareness | Platform view/impression definitions vary |
| Cost per view | Spend ÷ qualified views | Video awareness | “View” thresholds differ |
| CPE | Spend ÷ defined engagements | Interaction/community | Easy interactions may not equal business value |
| CPC | Spend ÷ tracked clicks | Traffic | Undercredits view-through effects |
| CPA/CPL | Spend ÷ conversions/leads | Acquisition | Attribution disputes |
| CPS / affiliate | Commission % × qualified net sales | Ecommerce | Returns and last-click bias |
| Minimum guarantee + affiliate | Fixed fee + variable commission | Balanced creator/performance risk | More accounting |
| Retainer | Monthly/quarterly fixed amount | Ambassadors/always-on | Requires capacity planning |
| Revenue share | % × defined revenue base | Deep strategic partnerships | Definition/audit complexity |
| License fee | Fee for agreed media/term/territory | UGC/paid creative | Can be undervalued if bundled |
| Programmatic revenue share | Platform/ad-network formula | Passive content monetization | Creator has limited control over advertiser demand |

Industry pricing guides explicitly identify reach-, conversion- and engagement-based models as alternatives to simple flat pricing. citeturn17view5

For performance analysis, use explicit equations:

CPM = campaign cost / impressions x 1000
CPE = campaign cost / defined engagements
CPA = campaign cost / attributed conversions
ROAS = attributed revenue / campaign cost

A brand should ideally calculate **expected** CPM/CPA before making an offer using the creator's median recent performance rather than follower count. For example, if a creator's last 20 comparable videos have a median of 150,000 qualified views and the negotiated organic-distribution component is $4,500, the implied expected CPM is $30. That calculation is analytical rather than a statement that $30 is a universal market CPM.

**Rights should be priced separately.** Shopify's current guidance explicitly says usage rights add fees when a brand wants to repurpose creator material in advertising and that exclusivity can significantly increase price by preventing future competitor work. citeturn17view7 There is not a sufficiently standardized, authoritative market percentage to justify a rule such as “usage rights always cost 30%” or “exclusivity always costs 50%.” The safer negotiating method is to quote each dimension separately:

| Economic dimension | Question that should determine price |
|---|---|
| Organic publication | What must the creator publish and where? |
| Production | What filming, editing, travel, props or crew are required? |
| Term | 30 days, 90 days, one year, perpetual? |
| Media | Organic repost only, paid social, display, CTV, retail media, out-of-home? |
| Territory | One country or worldwide? |
| Identity | Can the advertiser use creator name, handle, voice and likeness? |
| Editing | Can the advertiser crop only, or create derivative works? |
| Whitelisting/account access | Can ads run through/from the creator identity? |
| Exclusivity | Which named competitors/categories are blocked, and for how long? |
| Renewal | Does brand have an option to extend? At what predetermined price? |

This framework prevents the classic mistake of allowing **“perpetual, worldwide, all-media, sublicensable rights”** to disappear inside the base post fee.

**Negotiation leverage is not symmetrical.** A creator's strongest evidence is usually historical audience/performance data, audience fit, scarcity, production quality and competing demand. A brand's strongest evidence is campaign volume, repeat-business potential, low operational complexity, fast approvals, limited rights and credible performance upside. The rational trade is frequently to reduce fixed price in exchange for narrower rights or higher upside—not simply to argue over one all-in number. That approach is consistent with the fact that rights, exclusivity and scope are recognized pricing variables. citeturn17view0turn17view7

| Creator negotiation tactic | Brand negotiation tactic |
|---|---|
| Quote organic deliverable and paid-use rights separately | Ask for an option to extend rights rather than buying perpetuity upfront |
| Support rate with median comparable-post results | Examine recent comparable content rather than screenshots of one viral post |
| Narrow exclusivity to named competitors | Define the minimum category needed rather than “all competitors” |
| Offer package discount for committed volume | Exchange volume commitment for per-deliverable efficiency |
| Offer performance bonus above a guaranteed base | Use a guarantee + CPA/CPS upside to align incentives |
| Charge for additional revisions/reshoots | Require one consolidated factual/legal review cycle |
| Preserve creator's editorial voice | Control required claims, prohibited claims and compliance—not every stylistic choice |
| Negotiate milestone/deposit payment | Tie final payment to completed deliverables, not uncontrolled performance |
| Set expiration on paid-media rights | Pre-negotiate renewal prices before launch |
| Decline guaranteed view/sales warranties | Set targets and makegoods only for creator-controlled failure |

## Contracts, negotiation, and risk allocation

A sponsorship agreement is fundamentally an allocation of **deliverables, intellectual-property rights, commercial opportunity, compliance responsibility and downside risk**. SAG-AFTRA's influencer resources emphasize compensation/payment, ownership and exclusivity as core issues, while FTC enforcement demonstrates that brands can incur exposure when contracts or approval processes permit inadequate disclosures or misleading endorsements. citeturn13view10turn13view8

**Core clause matrix**

| Clause | What should be specified | Creator-side concern | Brand-side concern |
|---|---|---|---|
| Deliverables | Platform, format, number, duration, messaging, links/tags, posting date | Scope creep | Ambiguous obligations |
| Production specifications | Length, resolution, orientation, product visibility, CTA | Unpaid reshoots | Unusable assets |
| Approval/revisions | Number of rounds, turnaround, what can be changed | Loss of voice / endless edits | Incorrect product claims |
| Compensation | Fee, commission, bonus, expenses | Hidden deductions | Paying before delivery |
| Payment | Deposit, invoice, Net terms, late-payment procedure | Net-90/120 cash-flow risk | Incomplete tax/invoice docs |
| Usage rights | Media, territory, term, edits, sublicensing | Perpetual rights without compensation | Insufficient rights to run campaign |
| IP ownership | Creator-owned vs. work-made-for-hire/assignment | Loss of underlying IP | Inability to use commissioned asset |
| Name/likeness | Exact allowed commercial uses | Uncontrolled endorsement | Ad cannot use creator identity |
| Paid amplification | Partnership ads/whitelisting permissions and duration | Account/reputation exposure | Authorization expires |
| Exclusivity | Category/named competitors and time window | Lost future revenue | Competitor adjacency |
| Confidentiality/NDA | Confidential information, embargo, exclusions | Restricts normal portfolio use | Launch leaks |
| Disclosure | Exact legal/platform requirements | Brand demands hidden ad | Creator fails to disclose |
| Claims | Approved substantiated claims; truthful personal experience | Forced false claims | Unsubstantiated claims |
| KPI | Target, measurement source, reporting window | Guaranteed algorithm outcome | No accountability |
| Makegood | Trigger and substitute deliverable | Free work for uncontrollable underperformance | Remedy for missed post |
| Live period | Minimum time content remains live | Permanent obligation | Early deletion |
| Kill fee | Cancellation compensation by production stage | Unpaid sunk labor | Paying full fee before delivery |
| Morality/brand safety | Objective triggers, materiality, mutuality | Vague reputation veto | Serious creator controversy |
| Warranties | Authority, originality, compliance, no infringement | Overbroad warranty | Third-party IP |
| Indemnity | Which party bears which third-party claims | Unlimited liability | No remedy for creator breach |
| Limitation of liability | Cap and excluded categories | Catastrophic exposure | Cap too low for serious breach |
| Privacy/data | Roles, permitted processing, security, retention | Unexpected controller obligations | GDPR/COPPA exposure |
| Termination | Cause, cure period, convenience, consequences | Instant termination/no pay | Trapped with breaching creator |
| Force majeure/platform outage | Events outside control | Algorithm/platform risk | Missed campaign window |
| Dispute resolution | Governing law, courts/arbitration, fees, venue | Remote expensive forum | Enforcement uncertainty |
| Assignment | Ability to transfer agreement/rights | Unknown future owner | Corporate restructuring |
| Survival | Rights/payment/confidentiality after termination | Perpetual hidden obligations | Necessary rights unexpectedly lapse |

FTC enforcement against Warner Bros. is particularly instructive. According to the FTC, Warner hired gaming influencers through an agency, paid amounts ranging from hundreds to tens of thousands of dollars, required positive promotion and omission of bugs or glitches, and instructed disclosures that often appeared below YouTube's “Show More” threshold. The FTC also alleged Warner had preapproval rights and approved at least one video without adequate disclosure. The settlement required clear material-connection disclosures plus influencer education and monitoring. citeturn13view8

That case shows why an approval clause should not merely say **“Brand may approve all content.”** It should allocate *what* the brand is approving: product accuracy, regulated claims, IP, disclosure and brand-safety compliance, while leaving reasonable room for the creator's actual opinion. FTC principles do not permit an advertiser to manufacture a supposedly independent opinion while suppressing material negative experience. citeturn13view8

**Illustrative balanced contract language.** The following is a negotiating template, not jurisdiction-specific legal advice.

\`\`\`text
DELIVERABLES
Creator will produce and publish the deliverables described in Exhibit A,
including platform, format, approximate length, required tags/links, posting
window, and minimum live period. Any material deliverable not listed in
Exhibit A requires a written change order and any corresponding fee adjustment.

CREATIVE REVIEW
Brand may provide one consolidated round of revisions addressing factual
accuracy, substantiated product claims, legal/compliance requirements, agreed
brand-safety requirements, and material deviations from the approved brief.
Requests that materially change the concept, require reshooting, or add
deliverables will be treated as additional scope.

COMPENSATION
Brand will pay Creator $_____ for the Deliverables. Fifty percent is due upon
execution and fifty percent within 30 days after completion and receipt of a
valid invoice [or insert the commercially agreed schedule]. Approved expenses
are reimbursable separately. Performance compensation, if any, is governed by
Exhibit B and does not reduce the guaranteed fee unless expressly stated.

DISCLOSURE AND ENDORSEMENT
Creator will clearly and conspicuously disclose Creator's material connection
to Brand in each endorsement as required by applicable law and platform policy.
Creator will express only opinions and experiences Creator honestly holds and
will not make product claims outside Brand's substantiated written claims.

CONTENT OWNERSHIP AND LICENSE
As between Brand and Creator, Creator retains ownership of the Creator Content.
Creator grants Brand a non-exclusive license to repost the final approved
Content on Brand-owned organic social channels for ___ days in [territory].
No paid-media use, sublicensing, synthetic replication of Creator's voice or
likeness, derivative advertising edits, out-of-home use, television/CTV use,
or use after the stated term is granted unless separately agreed in writing.

PAID MEDIA OPTION
Brand may license the Content for paid social advertising for an additional
fee of $_____ for a term of ___ days beginning on first paid impression.
Extension requires written agreement and an additional fee.

EXCLUSIVITY
From ___ days before through ___ days after Creator's publication date,
Creator will not publish paid sponsored content for the following named
competitors: [LIST]. Exclusivity does not restrict pre-existing agreements,
unpaid editorial commentary, incidental product appearance, or brands outside
the specifically defined competitive category.

KPIs AND MAKEGOODS
Any projected views, impressions, engagement, clicks, conversions, revenue,
or other KPIs are performance targets and not warranties unless expressly
identified as guaranteed. A makegood is required only if Creator fails to
perform a Creator-controlled contractual obligation, such as failing to publish
an agreed deliverable or removing it before the minimum live period without
permitted cause.

REPORTING
Creator will provide available first-party platform analytics for the agreed
reporting metrics at ___ and ___ days after publication. Neither party will
alter, fabricate, or misrepresent campaign analytics.

CANCELLATION / KILL FEE
If Brand cancels for convenience and Creator is not in breach, Brand will pay:
(a) ___% of fee after contracting but before production;
(b) ___% after material production has begun; and
(c) 100% after Creator delivers a substantially completed asset or the scheduled
publication window begins. Third-party non-refundable costs are reimbursable.

INDEMNITY
Each party will indemnify the other against third-party claims to the extent
arising from that party's breach of its representations, warranties, applicable
law, gross negligence, or willful misconduct. Creator is not responsible for
claims created by Brand-supplied claims, assets, edits, instructions, or uses
outside the granted license.

TERMINATION AND CURE
Either party may terminate for material breach if the breaching party fails to
cure within ___ business days after written notice, except where cure is not
reasonably possible. Accrued payment obligations and authorized uses occurring
before termination remain payable.

DISPUTE RESOLUTION
This Agreement is governed by the law of [STATE/COUNTRY]. Before filing a formal
proceeding, the parties will attempt good-faith executive-level resolution for
___ days. Any unresolved dispute will be resolved in [specified court /
arbitration forum] located in [venue], subject to any non-waivable law.
\`\`\`

FTC guidance supports the disclosure and truthful-endorsement provisions: disclosures must be clear and conspicuous, YouTube-description-only disclosures can be inadequate, and affiliate compensation should be disclosed in understandable language. citeturn15view3turn15view1

**High-value redlines**

| Brand-heavy draft | More balanced redline | Why it matters |
|---|---|---|
| “Perpetual, worldwide, irrevocable, transferable license in all media” | Define specific media + territory + 30/90/180-day term; extension priced separately | Prevents a one-post fee from becoming a permanent ad buy |
| “Brand owns all content and derivatives” | Creator retains IP; brand receives enumerated license | Preserves creator asset value |
| “Brand may edit Content in any manner” | Crop/resize/subtitle only; material edits need approval | Prevents false or damaging endorsements |
| “Creator shall not work with any competitor for 12 months” | Named competitors + narrow category + short pre/post window | Prices actual opportunity cost |
| “Unlimited revisions” | One/two consolidated rounds; reshoot/change-of-brief costs extra | Stops scope creep |
| “Creator guarantees 500,000 views” | KPI is target; makegood only for creator-controlled failure | Removes algorithm warranty |
| “Brand can terminate at any time without payment” | Stage-based kill fee + reimbursed committed expenses | Pays for sunk labor |
| “Net 90 after campaign completion” | Deposit or milestone + Net 30 final payment | Reduces creator financing burden |
| “Creator indemnifies Brand for any claim relating to campaign” | Mutual, fault-based indemnities allocated by source of claim | Aligns liability with control |
| “Unlimited liability” | Negotiated cap, with targeted exceptions | Avoids disproportionate risk |
| “Morality clause whenever Brand believes conduct may harm reputation” | Objective material-adverse trigger + mutual clause | Reduces arbitrary cancellation |
| “Brand may use Creator likeness forever” | Use only in licensed Content during defined campaign term | Prevents unintended endorsement |
| “All data is Brand property” | Define analytics vs. personal data; comply with privacy roles | Avoids privacy ambiguity |
| “Creator shall keep post live forever” | Defined minimum live period | Avoids perpetual editorial restriction |
| “#Partner is sufficient” | Creator may use disclosure necessary for applicable law | FTC warns ambiguous shorthand can be inadequate |

FTC guidance specifically says generic “partner” or “ambassador” terminology can be ambiguous, while clearer brand-linked or advertising disclosures may be necessary. citeturn15view2

**Makegoods should be causal.** A brand has a strong case for a makegood when the creator misses the agreed posting date, omits the contracted CTA, deletes the post prematurely, publishes the wrong product, or fails to make an agreed compliance correction. A brand has a weaker case when the creator delivers correctly but an algorithm produces fewer impressions than forecast. The contract should therefore define a makegood trigger by *breach*, not simply “below benchmark.”

**Kill fees should increase as irrevocable work increases.** A useful structure is a relatively low fee immediately after signing, a larger percentage once concepting/production begins, and essentially the full production component once the finished asset exists. The precise percentages are commercial decisions, not standardized industry rules.

**NDA provisions need exceptions.** A workable NDA normally protects unreleased product information, launch dates, commercial terms and nonpublic campaign strategy while excluding information already public, independently developed or lawfully obtained elsewhere. Creators should also address whether they may list the brand in a portfolio after the campaign goes public.

## Measurement, reporting, and attribution

Creator measurement is difficult because one sponsorship can simultaneously generate brand exposure, social interaction, search demand, direct website traffic, affiliate sales and reusable paid-media creative. IAB has identified standardization and measurement as continuing creator-economy concerns, while Google's Creator Partnerships product now explicitly combines organic and paid metrics for linked sponsored creator videos. citeturn18search5turn16view3

The first rule is to specify the **denominator and data source**. “Engagement rate” can mean engagements divided by followers, reach, impressions, views or something else. “View” can also be platform-defined. A contract or insertion order should therefore say, for example, “engagement rate = likes + comments + saves + shares divided by platform-reported reach at seven days,” rather than merely requiring “5% engagement.”

| Metric | Recommended definition | What it answers |
|---|---|---|
| Followers/subscribers | Account audience count | Potential audience, not guaranteed distribution |
| Reach | Platform-reported unique accounts/users reached | How many different people saw it? |
| Impressions | Total recorded exposures | How much exposure occurred? |
| Views | Platform-reported video views under platform definition | How many recorded video views occurred? |
| Qualified views | Agreed duration/completion threshold where available | How substantive was viewing? |
| Watch time | Total or average minutes/seconds watched | Did viewers stay? |
| Completion rate | Completed views ÷ starts | Did viewers consume the asset? |
| Engagements | Explicit agreed interactions | Did people respond? |
| Engagement rate | Engagements ÷ agreed denominator | Interaction efficiency |
| CTR | Clicks ÷ impressions | Did exposure create traffic? |
| CVR | Conversions ÷ clicks or sessions | Did traffic act? |
| CPM | Spend ÷ impressions × 1,000 | Cost of exposure |
| CPE | Spend ÷ engagements | Cost of interaction |
| CPC | Spend ÷ clicks | Cost of traffic |
| CPA/CPL | Spend ÷ attributed acquisitions/leads | Acquisition efficiency |
| Attributed revenue | Revenue assigned under chosen attribution rule | Commercial output |
| ROAS | Attributed revenue ÷ spend | Revenue efficiency |
| New-customer rate | New customers ÷ attributed customers | Incremental customer mix |
| Search lift | Incremental search behavior | Mid-funnel demand creation |
| Brand lift | Change in awareness/consideration/etc. | Brand effect |
| Conversion lift | Incremental conversions vs. control | Causal performance |

Google's current lift tools illustrate the difference between correlation and incrementality: Brand Lift can assess ad recall, association, awareness, consideration, favorability and purchase intent; Conversion Lift compares exposed and control populations to estimate incremental conversions such as purchases and site visits. citeturn16view4turn16view5

**Attribution should use multiple methods whenever campaign value is material.**

| Method | Strength | Weakness | Best use |
|---|---|---|---|
| Unique promo code | Simple and visible | Misses buyers who do not use code | Ecommerce |
| Affiliate link | Direct click/sale relationship | Cookie/window and last-click bias | Performance deals |
| UTM parameters | Integrates with web analytics | Cross-device loss | Traffic analysis |
| Platform conversion tracking | Strong within ecosystem | Platform dependence | Paid amplification |
| Server-side/conversion API | More durable first-party reporting | Implementation/privacy complexity | Large performance programs |
| Post-purchase survey | Captures untracked influence | Recall/self-report bias | Complementary attribution |
| Search-volume change | Captures demand creation | Confounded without control | Awareness consideration |
| Brand/search lift experiment | More causal | Scale/budget requirements | Major launches |
| Conversion lift / geo experiment | Incrementality | Experimental complexity | Large campaigns |
| Marketing-mix modeling | Broad channel-level inference | Data and model requirements | Mature portfolios |

The most rigorous reporting architecture therefore uses **three layers**: platform-native evidence of delivery, direct-response attribution for trackable actions, and causal/incremental measurement where campaign scale warrants it. Google's documentation expressly positions its lift tools as methods for measuring changes in brand/search outcomes and conversions that advertising drives beyond baseline behavior. citeturn16view4turn16view5

A practical campaign reporting timeline is:

| Stage | Evidence to capture |
|---|---|
| Pre-campaign | Audience demographics, geography, prior 10–20 comparable posts, brand-safety review, benchmark median |
| Publication | URL, timestamp, disclosure, CTA/link/code, screenshot/archive |
| 24–48 hours | Initial reach/views, engagement, tracking validation |
| 7 days | Stable short-form distribution, clicks, sales, comments/sentiment |
| 30 days | Revenue/CPA, returns-adjusted affiliate data where available |
| Long-tail | Search/view accumulation for evergreen YouTube/podcast/blog content |
| Final | Cost metrics, attribution, lift where available, creative learnings, renewal decision |

For linked YouTube sponsorships, advertisers can now use Creator Partnerships to view organic and paid performance data associated with sponsored creator videos, which is an example of the industry's broader move toward creator/paid-media integration. citeturn16view3

**Fraud detection should be behavioral, not follower-count-only.** Useful diligence includes looking for improbable follower growth, audience geography inconsistent with the creator's content, repetitive or irrelevant comments, abrupt engagement changes, suspiciously uniform interaction patterns, and discrepancies between screenshots and first-party analytics. These are risk indicators rather than conclusive proof of fraud. Brands should ideally request native analytics or authorized API/platform data for material campaigns and avoid treating a single vendor's fraud score as determinative.

**Performance should be benchmarked against comparable content.** A 60-second sponsored YouTube integration should not be benchmarked against a creator's viral Shorts outlier, nor should a product launch be judged against an unrelated giveaway. Using the median of a recent comparable set reduces the influence of extreme viral successes and failures.

## Compliance, safety, and case studies

**FTC endorsement compliance.** The central U.S. rule is economic transparency: when there is a material connection that consumers might not expect, the relationship should be clearly and conspicuously disclosed. Free products, discounts and commissions can qualify just as cash sponsorships do. citeturn15view2turn0search7

Placement matters. The FTC says a disclosure buried behind Instagram's “more” truncation can be inadequate; a YouTube description alone may also be insufficient, and video endorsements may need disclosure in the video itself. For livestreams, a single opening disclosure can be missed by late-arriving viewers, so repeated or continuous disclosure can be appropriate. citeturn15view3

A platform label is useful but not an automatic safe harbor. FTC guidance explicitly says the brand and creator—not the platform—ultimately bear responsibility for a clear and conspicuous disclosure. YouTube similarly states that both creators and brands are responsible for understanding and complying with applicable paid-promotion disclosure obligations. citeturn15view0turn16view1 Meta's advertising standards additionally require branded-content ads to tag the relevant third-party brand/business partner using its branded-content tool. citeturn19search0

Brands cannot simply outsource compliance to an agency. FTC guidance says a company remains responsible for promotional activity undertaken on its behalf and should have an appropriate program to train and monitor influencers; intermediaries that pay and direct creators can themselves face potential liability for deceptive endorsements or undisclosed material connections. citeturn15view1

**GDPR.** Creator sponsorship becomes a GDPR issue when campaign actors process personal data rather than merely publish content—for example, building CRM audiences, collecting lead forms, matching email addresses, running behavioral tracking, sharing customer lists, or operating affiliate/retargeting infrastructure involving EU users. GDPR applies to processing in the context of an EU establishment and can also reach non-EU controllers/processors in circumstances involving offering goods or services to, or monitoring, individuals in the EU. citeturn14view4

Among other requirements, Article 5 establishes processing principles and accountability; Article 6 requires a lawful basis; Article 13 requires specified transparency when data are collected from the individual; and Article 28 requires controllers using processors to select processors providing sufficient compliance and security guarantees. GDPR also gives individuals rights including objections in specified circumstances. citeturn14view0turn14view1turn14view2turn14view3turn14view5

Operationally, this means a sophisticated creator agreement should ask: Who is controller? Who is processor? What data passes between creator, brand, platform and tracking vendor? What lawful basis applies? What notice is shown? How long are click IDs, lead data and audience lists retained? Are cross-border transfers involved? Those questions become substantially more important when brands ask creators to upload customer data, collect leads directly, or provide audience information beyond aggregated platform analytics. These are applications of GDPR's controller, lawful-processing and transparency framework. citeturn14view1turn14view2turn14view3

**COPPA.** Current FTC guidance is particularly relevant to kid-focused creators. The FTC says that where commercial creator content is directed to children and personal information is collected by or on behalf of the creator—including a persistent identifier used for targeted advertising—the creator may be treated as an operator that must comply with COPPA. citeturn16view0 Persistent identifiers such as cookies, IP addresses and device identifiers fall within COPPA's personal-information definition under specified conditions, and the general rule is to obtain verifiable parental consent before collecting personal information online from children under 13 unless an exception applies. citeturn16view0

FTC guidance also says persistent identifiers collected under the internal-operations exception cannot be repurposed for behavioral advertising or profiling, and a commercial service does not avoid child-directed status simply by stating in its terms that children are prohibited. citeturn16view0

**Risk map**

| Risk | Typical failure | Mitigation |
|---|---|---|
| Fake/low-quality audience | Paying for fabricated or commercially irrelevant reach | Native analytics, trend analysis, geography validation |
| Brand safety | Historical creator content conflicts with brand | Documented pre-signing review + objective morality language |
| Disclosure | #ad hidden or ambiguous | Disclosure instructions + preflight check + monitoring |
| False claims | Creator improvises health/performance claim | Approved substantiated claim sheet |
| Loss of authenticity | Brand scripts creator as conventional ad actor | Control facts/compliance, leave stylistic room |
| IP infringement | Music/images/clips cannot be licensed for paid use | Rights clearance and representations |
| Usage-rights ambiguity | Brand turns organic post into long-term ad without fee | Explicit media/term/territory/license clause |
| Excessive exclusivity | Creator unknowingly blocks major future category | Named competitors + time limit |
| KPI mismatch | Awareness campaign judged by last-click sales | Objective-specific measurement plan |
| Attribution disputes | Brand and creator use different sales windows | Contractual source of truth and attribution window |
| Payment risk | Creator finances campaign for months | Deposit/milestones, invoice procedure, late-pay clause |
| Platform outage/policy change | Campaign cannot go live as planned | Force-majeure/platform contingency |
| Child privacy | Targeted tracking on child-directed content | COPPA review and strict data minimization |
| GDPR | Unclear controller/processor roles | Data-flow mapping and appropriate privacy terms |
| Reputation imbalance | One-sided morality clause | Mutual, material, objective triggers |
| Account-security risk | Excessive whitelisting credentials | Use native permissions, least privilege, expiration |

YouTube's requirement that paid promotions comply with platform and Google advertising policies, and Meta's separate branded-content requirements, illustrate why a campaign can satisfy its private contract yet still violate platform rules. citeturn16view1turn19search0

**Primary-source case studies**

| Case | Result | What happened | Analytical lesson |
|---|---|---|---|
| Toyota Indonesia + Noah / YouTube | >7M views; Google reports +14% awareness, +17% purchase intent, +7% interest in Toyota | Brand integrated Toyota Veloz into a culturally relevant music-video remake | Creator/cultural fit can make the integration entertainment rather than interruption |
| Krom Bank + YouTube creators | Google reports 42% Search Lift | Creators used their own storytelling styles to explain bank offerings through Shorts | Measure downstream intent, not views alone |
| Love & Pebble + TikTok Shop creators | TikTok reports +1,194% sales and 3.2× ROAS | Combined Creator Affiliate activity with Shop Ads | Affiliate attribution + paid amplification can turn creator content into commerce infrastructure |
| Warner Bros. / Shadow of Mordor | FTC enforcement settlement | Paid gaming influencers; disclosures frequently below “Show More”; positive-review controls | Compliance must be built into the brief, approval and monitoring workflow |
| Teami | FTC enforcement and influencer warning letters | Paid influencer posts had disclosures hidden behind “more”; FTC also alleged unsupported health/weight-loss claims | Disclosure does not cure an unsubstantiated underlying claim |
| Machinima / Xbox | FTC action | FTC alleged paid endorsers promoted Xbox One without adequate compensation disclosure | Agencies/networks and brands must manage material-connection disclosure |

The Toyota and Krom metrics are Google-published case-study results, not independent experimental replication; Google reports Toyota's music-video remake surpassed seven million views and generated the stated brand metrics, and reports a 42% Search Lift for Krom Bank. citeturn13view6 TikTok reports that Love & Pebble's use of its Creator Affiliate program and Shop Ads generated a 1,194% sales increase and 3.2× ROAS; as with all vendor-authored case studies, the result should not be treated as a universal expected return. citeturn13view7

The Warner Bros. failure is documented directly by the FTC: influencers were paid and given advance-release games; disclosures were often below the fold; Warner allegedly imposed positive-content restrictions; and the settlement required disclosure, education and monitoring controls. citeturn13view8

The Teami case demonstrates a second layer of risk. The FTC alleged both inadequate disclosure by well-known influencers and unsupported weight-loss or disease-related advertising claims, and noted that the disclosure often was not visible until users clicked “more.” citeturn13view9 The lesson is important: **an adequate #ad disclosure does not make a false or unsubstantiated advertising claim lawful.**

In the Machinima matter, the FTC alleged that two endorsers received $15,000 and $30,000 for Xbox videos and that the campaign did not adequately disclose the sponsorship. The resulting enforcement framework required stronger disclosure and monitoring practices. citeturn11search2turn11search10

Across the failures, the common pattern is not merely “the influencer forgot #ad.” It is a systems failure involving brief design, contract requirements, disclosure placement, claims control, agency governance, approval and monitoring. FTC guidance now explicitly tells brands running influencer networks to train and monitor participants and says delegation to an outside PR or marketing firm does not remove the advertiser's responsibility. citeturn15view1

## Operational playbook, templates, and checklists

A mature sponsorship process should be treated like a miniature media procurement, production, legal-review and measurement project rather than an informal DM exchange.

\`\`\`mermaid
flowchart LR
 A[Campaign objective] --> B[Creator discovery]
 B --> C[Audience / fraud / brand-safety diligence]
 C --> D[Brief + preliminary economics]
 D --> E[Creator outreach]
 E --> F[Rate + rights negotiation]
 F --> G[Contract / insertion order]
 G --> H[Concept approval]
 H --> I[Production]
 I --> J[Legal / claims / disclosure review]
 J --> K[Publication]
 K --> L[Organic monitoring]
 L --> M[Paid amplification / affiliate]
 M --> N[7 / 30 day reporting]
 N --> O[Attribution + incrementality analysis]
 O --> P[Payment / commission reconciliation]
 P --> Q[Renew / expand / stop]
\`\`\`

The disclosure checkpoint before publication reflects FTC guidance that brands should train and monitor endorsers and, where ephemeral posts are difficult to monitor after publication, can require compliant approval before posting. citeturn15view1

**Creator checklist**

| Before signing | Creator question |
|---|---|
| Brand fit | Would I credibly recommend this to my audience without destroying trust? |
| Scope | Exactly how many assets, stories, revisions and posting dates? |
| Rate | Does the fee include production, posting, rights and exclusivity, or are those separate? |
| Usage | Where can the brand use my content, for how long and in which countries? |
| Likeness | Can it use my name, face, voice or handle outside the original post? |
| Paid media | Can it run ads through my identity/account? For how long? |
| Editing | Can the brand materially alter what I say? |
| Exclusivity | Which named companies/category become unavailable to me? |
| Disclosure | Can I make whatever disclosure applicable law requires? |
| Claims | Have I actually used the product, and are requested claims truthful? |
| KPI | Am I guaranteeing only what I control? |
| Makegood | Exactly what event triggers free replacement work? |
| Payment | Deposit? Invoice requirement? Net date? Commission timing? |
| Cancellation | Do I get paid for work already completed? |
| Liability | Is indemnity one-sided or unlimited? |
| Termination | Can the brand cancel arbitrarily after I reject a problematic claim? |
| Confidentiality | When does embargo end? |
| Analytics | What data must I provide, and does it reveal unrelated audience information? |
| Tax/entity | Is the contracting entity and tax treatment correct? |
| Recordkeeping | Have I archived contract, approved brief, disclosures and analytics? |

SAG-AFTRA's current creator guidance independently emphasizes compensation/payment, ownership and exclusivity as issues that creators should understand before entering influencer agreements. citeturn13view10

**Brand checklist**

| Before committing budget | Brand question |
|---|---|
| Objective | Is the primary outcome awareness, engagement, consideration, leads or revenue? |
| Audience fit | Does first-party creator data match target geography/demographic? |
| Performance | What is median performance for recent comparable content? |
| Fraud | Are growth and interaction patterns credible? |
| Brand safety | Has the creator's historical public content been reviewed proportionately? |
| Rate | What CPM/CPE/CPA is implied by realistic expected performance? |
| Rights | Do we actually need perpetual/global use, or would a 90-day option suffice? |
| Exclusivity | Is each blocked competitor commercially necessary? |
| Claims | Has legal/regulatory substantiation been approved? |
| Disclosure | Does the brief specify clear and conspicuous disclosure? |
| Platform | Are branded-content/paid-promotion tools required? |
| Attribution | Which links, codes, pixels or lift tests will be used? |
| Privacy | Will any personal data move outside the platform? |
| Children | Could the content/service be directed to children under 13? |
| Approvals | Is there one empowered consolidated reviewer? |
| Reporting | What is the source of truth and reporting window? |
| Payment | Are affiliate returns/reversals and creator invoices handled promptly? |
| Rights expiry | Is there a process to stop paid media when license expires? |
| Monitoring | Who checks live content for disclosure/claims compliance? |
| Renewal | What objective decision rule determines expansion? |

The brand's monitoring responsibility is not merely a best-practice invention: FTC guidance says advertisers should maintain reasonable training and monitoring programs and that an outside agency does not relieve the advertiser of responsibility for promotional conduct on its behalf. citeturn15view1

**Compact sponsorship term-sheet template**

| Field | Agreed term |
|---|---|
| Brand / legal entity | |
| Creator / legal entity | |
| Campaign | |
| Objective | |
| Platforms | |
| Deliverables | |
| Publication dates | |
| Minimum live period | |
| Required tags / links / CTA | |
| Disclosure language/process | |
| Approved claims | |
| Creative-review rounds | |
| Base creator fee | |
| Deposit | |
| Performance commission / bonus | |
| Commission basis | Gross / net sales / other |
| Attribution source | |
| Attribution window | |
| Usage media | |
| Usage territory | |
| Usage term | |
| Paid advertising rights | |
| Creator identity/likeness rights | |
| Editing/derivative rights | |
| Exclusivity category | |
| Named competitors | |
| Exclusivity dates | |
| Reporting metrics | |
| Makegood trigger | |
| Kill fee | |
| Expenses | |
| Confidentiality / embargo | |
| Morality/brand-safety standard | |
| Indemnity / liability cap | |
| Termination / cure | |
| Governing law / dispute forum | |
| Privacy/data roles | |
| Renewal option | |

A useful rule is that **a blank term is not a neutral term**. Missing rights language often becomes a dispute precisely when the campaign performs well and someone tries to reuse the asset beyond what the other side believed was included.`;
