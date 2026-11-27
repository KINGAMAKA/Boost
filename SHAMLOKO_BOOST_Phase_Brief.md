# SHAMLOKO BOOST - PHASE BRIEF AND HANDOFF (Phases 2 to 6)

**How to use this file:** Start each new phase by sharing this brief, `SHAMLOKO_BOOST_Master_Prompt.md` (the original full specification, still the authority) and the current code zip. Say: "Build Phase N from the brief." Update the "Status" section after each phase.

---
## 1. STATUS

**Phase 1: DONE and working** on an Android phone. Login/registration, profiles, roles, genre preferences, creator profile, read-only wallet from the ledger.

**Phase 2: CODE DELIVERED — awaiting Supabase SQL execution and Android acceptance test.** New About/auth flow, Earner-first mode switch, Creator onboarding, catalogue-driven Ways to Earn/Get Discovered, deposit request/admin confirmation rails, wallet/profile v1 and admin deposit review are included in `sql/03_phase2.sql`, `js/app.js`, `css/style.css` and `index.html`. Do not mark Phase 2 fully complete until the deposit-confirmation test succeeds on the live Android app.

**Environment (fixed decisions)**
- Developer works only on an Android phone: GitHub browser editor, Supabase SQL Editor and dashboard. No terminal, no build step.
- Stack: HTML, CSS, vanilla JavaScript, Supabase JS client v2.45.4 from jsDelivr. Hosted on GitHub Pages.
- Supabase project is SHARED with the original SHAMLOKO marketplace. All BOOST tables live in the Postgres schema `boost`. Never touch `public` tables. `boost` is added under Project Settings > API > Exposed schemas.
- App client: `createClient(url, key, { db: { schema: "boost" }, auth: { storageKey: "boost-auth" } })`.
- Project URL: `https://arfsggndgyezukwuvmad.supabase.co` (publishable key is in `js/config.js`; never use or ask for the service_role key).
- Shared auth settings (Confirm email, Site URL) belong to SHAMLOKO: do not change them. BOOST's Pages link is added under Redirect URLs only.
- The admin account is `adminamaka@gmail.com` (role `admin` exists in `boost.user_roles`). Other existing SHAMLOKO users automatically have BOOST accounts with the earner role.
- Supabase's SQL Editor says only "Success" for inserts. Verify with a select.

**Repository layout (real paths)**
`index.html`, `css/style.css`, `js/config.js`, `js/app.js`, `sql/01_core.sql`, `sql/02_make_admin.sql`. New work should split `js/app.js` into `js/modules/` files as it grows (keep each file short enough to paste on a phone).

**Phase 1 database (schema `boost`)**: profiles, user_roles (earner/creator/admin), creator_profiles, genres (11 seeded), user_preferences, wallets, wallet_transactions (the ledger), platform_settings (platform_fee_percent=10, min_withdrawal=20), notifications, admin_audit_logs, view wallet_balances (available, pending, reserved, derived from the ledger), functions is_admin(), handle_new_user() trigger `boost_on_auth_user_created`, become_creator().
**Security pattern to keep:** RLS on every table; the browser can only SELECT the ledger; money moves only through `security definer` functions with `set search_path = boost`; ledger rows use a unique `reference` as an idempotency key (blocks duplicate credits); grant only what is needed to `authenticated`; every new table needs `grant` plus RLS policies; new SQL files are numbered and safe to re-run.
**Code helpers in app.js:** `esc()` for all inserted text, `K()` for kwacha format, `must()` to throw Supabase errors, `guard()` to toast errors.

---
## 2. NEW PRODUCT FLOW (owner's additions)

**Wording note:** "owner mode" in the owner's dictation means **Earner mode**.

### 2.1 First screen: About page (logged-out)
Very small, no long scrolling, fits roughly one phone screen. Two short blocks: **For earners** (listen, compete, complete tasks, earn kwacha) and **For creators** (get discovered, get real feedback, run competitions). Buttons: Register, Log in. Tagline: Discover. Compete. Earn. Grow.

### 2.2 After registering
- The app opens in **Earner mode** by default.
- At the very top is a **mode switch: Earner | Creator**. Switching to Creator for the first time asks for the creator profile (existing become_creator function), then opens Creator mode. The last used mode is remembered per device.
- Bottom navigation stays, adapted per mode (see below).

### 2.3 Earner mode: "Ways to Earn" is the first screen
Cards show each package with **how much the earner can earn** ("Earn K1.50", "Earn up to K15").
1. **Discover an Artist** (build first): listen to new songs inside BOOST. Choose Random or pick a genre. Answer short questions (favourite song, strongest chorus, would replay, improvement, mood). Reward on approval.
2. **Compete** (build second): enter creative competitions (music, photo, design, video, slogans, writing) for prizes.
3. **Complete** (later): tasks and reviews.
4. **Suggested services (shown as "Coming soon", coded later):**

| Service | How it works | Example earn |
|---|---|---|
| Video review | Watch a short video, rate it, write one comment | K1.00 |
| Music review | Written review of a track | K1.50 |
| Content rating | Rate a post/image/design | K0.50 |
| Audience survey | Answer a short survey | K0.50 |
| Content comparison | Pick the better of two options, say why | K1.00 |
| Website/app testing | Follow steps, submit a bug/UX report | K2.00 |
| Product feedback | Try a product or idea, give structured feedback | K2.50 |
| Focus group | Answer a creator's questions in depth | K5 to K15 |
| Create promo content | Make original content for a brand (no external engagement) | K10 to K50 |

All rewards are configurable examples, set by the creator within platform limits.

### 2.4 Creator mode: "Get Discovered" is the first screen
Tapping Get Discovered opens the list of ways to be discovered. Each shows what it does, what it costs (reward x participants + platform fee) and what the creator gets back.
1. **Sample your music to listeners (build first):** upload up to 3 tracks, choose genres and the number of listeners (e.g. 100). Results show preference split (e.g. Song A 55%), best chorus, replay choice, written feedback. Live results hidden from participants until they submit.
2. **Run a competition (build second):** set rules, dates, prize fund and judging; entries come in; winners paid from the ledger.
3. **Get reviews:** people review your song, video, design or product.
4. **Audience survey:** your questions to a target audience.
5. **Content comparison (A/B):** which version wins.
6. **Website/app testing and product feedback.**
7. **Focus group:** small group, deeper written answers.
8. **Promo content:** hire earners to create original content.
Services 3 to 8 are listed as "Coming soon" until their phase.
Example cost: K1.50 reward x 100 listeners = K150 + 10% fee K15 = **K165**, reserved from the creator wallet at publication.

### 2.5 Profile (mode-aware)
- **Earner mode:** total earned (lifetime), available, pending, tasks completed, competition entries, recent activity.
- **Creator mode:** total spent, reserved campaign funds, active campaigns, participants, completion rate, average cost per response, ratings and written reviews received, results per campaign, deposits history.
- Profile settings (name, phone, visibility, genres) stay in both modes.

### 2.6 Policy safeguards (unchanged, non-negotiable)
No rewards for external-platform engagement (likes, subscriptions, views, fake reviews). Creators upload only music they own or may distribute. Hide live vote results until a participant submits. Aggregate/anonymised reporting by default. No claim that money moved until confirmed.

---
## 3. THE FIVE REMAINING PHASES

### PHASE 2 - App flow, service catalogue and funding foundation
**Goal:** the new shell and the money rails, so every later feature plugs in.
- Landing/About page; register and login flow; Earner-first; Earner/Creator switch at the top; remembered mode; per-mode bottom navigation.
- "Ways to Earn" and "Get Discovered" home screens driven by a `service_catalog` table (side, key, title, description, status live/coming_soon, reward range, sort order). Coming-soon items clearly labelled and not clickable into fake screens.
- Wallet functions in SQL: `request_deposit`, admin `confirm_deposit` / `reject_deposit`, ledger credits with idempotency, audit-log entries. Deposit amounts K50, K100, K250, K500, K1,000, K2,500, K5,000, custom. Manual admin confirmation only.
- First small admin screen (admin-only, checked server-side): confirm/reject deposits.
- Profile statistics v1 (totals from the ledger).
- **Done when:** a creator requests a deposit, admin confirms it, creator wallet balance rises exactly once, and the new flow works on Android.

### PHASE 3 - Discover an Artist (music campaigns end to end)
- Storage: private/public buckets with upload limits and type restrictions; creators upload up to 3 tracks (ownership confirmation checkbox).
- Campaign builder: title, tracks, genres, target audience, reward per participant, participant cap, budget, dates, preview; statuses Draft, Pending funding, Active, Paused, Completed, Cancelled, Under review.
- `publish_campaign` (server-side): validates budget plus fee, checks available balance, reserves funds in the ledger, cannot spend reserved money twice.
- Earner side: Discover an Artist with Random or genre choice, in-app audio player, question form, one participation per campaign, results hidden until submit.
- Review: creator/admin approves or rejects with reason; `approve_submission` credits the reward exactly once (pending to available per rules); duplicate protection.
- Creator results page: aggregate percentages, ratings, written feedback, cost per response.
- Notifications for submission received/approved/rejected, reward credited.
- **Done when:** acceptance tests 5 to 13 and 16 from the master spec pass for music campaigns.

### PHASE 4 - Compete
- Competitions: creator sets category, rules, entry requirements, reference files, open/close dates, prize fund (reserved from wallet), judging criteria, winner selection or transparent voting.
- Earners browse, read rules and prize conditions before entering, submit work (text, image, audio, video), track entries, see published results.
- Prize payout through the ledger; fund reservation and refunds of unused funds handled server-side; audit trail.
- Compete tab and Earn "Compete" card go live; notifications for results.
- **Done when:** a creator funds and runs a competition, an earner enters, a winner is chosen and paid exactly once.

### PHASE 5 - Complete tasks, more services and withdrawals
- Enable the "Complete" marketplace: video review, music review, content rating, survey, content comparison first; then website testing, product feedback, focus group, promo content as time allows.
- Creator side: matching "Get reviews", audience survey, A/B comparison, etc. launched from Get Discovered.
- Earner withdrawals: request, admin review, statuses, minimum amount from settings, no double withdrawal, no negative balance.
- In-app notifications completed and mark-as-read.
- Fraud controls: participation limits, duplicate evidence checks, manual review, disputes.
- **Done when:** each enabled service completes the loop (publish, participate, review, pay, results) and withdrawals work with admin confirmation.

### PHASE 6 - Grow analytics, full admin and hardening
- Grow tab / creator Analytics: participants, completion rates, genre and audience preferences, song comparison, ratings, feedback, cost per completed response, history; charts; privacy-safe aggregation.
- Profile statistics v2 for both modes (full stats described in 2.5).
- Full admin dashboard: users, creators, status/suspension, campaigns, competitions, submissions, disputes, deposits, withdrawals, fees, genres/categories, sponsored placements, reports, audit logs. Every sensitive action logged.
- Discover extras: search, creator profiles, sponsored placements clearly labelled.
- Security review of every RLS policy and function; run all 20 acceptance tests from the master spec; Android test pass; final README for maintaining the project on GitHub mobile.

---
## 4. WORKING RULES FOR EVERY PHASE
1. Read this brief and the master prompt first; do not add product concepts without approval.
2. Per feature: tables, then RLS, then functions, then frontend, then connect, then test, then explain phone steps.
3. Deliver complete, ordered, re-runnable SQL (`sql/03_...`, `04_...`) plus complete changed files with exact GitHub paths; also provide a zip of the full current project.
4. Phone-friendly instructions, in the order they can be done. Say "Success" in the SQL Editor is not proof; give a select to verify.
5. Never put secrets in the frontend. Never trust browser-supplied money values. Never leave a button that looks functional but does nothing; label unbuilt features.
6. Keep files small enough to paste on a phone; split into modules.
7. At the end of each phase update Section 1 (Status) of this brief.
