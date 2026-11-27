# Nativity: 18+ and Indian legal compliance

Prepared 27 November 2026. This report explains how Nativity was made strictly 18+, and how its documents and data handling were aligned with the Indian laws that apply to it.

**This is not legal advice.** Items marked **Requires legal review** should be checked by an Indian lawyer before relying on them.

---

## 1. Audit: what Nativity is and what it collects

| Area | Finding |
|---|---|
| **Frontend** | React + Vite single-page app. Hosted on Vercel at `nativity-sable.vercel.app`. Auto-deploys from GitHub `main`. |
| **Backend** | Supabase: Postgres with row-level security, Auth and Storage. Project region **ap-south-1 (Mumbai, India)**. No custom server. Every rule is enforced in the database. |
| **Sign-in** | Email magic link (the only provider enabled). Anonymous "guest" sessions are also enabled. Google is disabled in Supabase, so the app now hides its button unless `VITE_GOOGLE_SIGN_IN=on` is set. |
| **Third parties** | **Supabase:** database, auth emails, storage. **Vercel:** hosting, logs. **Google Fonts:** loaded from Google. **Uploaded games:** third-party code, sandboxed, and able to load remote resources. |
| **Personal data** | **Account:** email; profile (handle, name, bio, avatar colour); role and suspension status. **Content:** games and trailers (files); notes; cheers, crews and stamps. **Activity:** views, play starts, scores. **Safety:** reports and blocks. **Guest ID.** **New:** date of birth, consent records, correction requests, rules-reminder timestamp. **Technical logs:** IP address and user agent, held by Supabase and Vercel. |
| **On device** | Session token; preferences; onboarding, 18+ and moods flags; Mailbox read marker; game saves. No cookies, analytics or ads. |
| **Business model** | Free. No payments, ads, subscriptions or real-money games. |
| **Legal classification** | **IT Act / IT Rules:** an *intermediary*, and likely a *social media intermediary* because users upload and share with each other. It is far below the 50 lakh user threshold for *significant* status. **DPDP Act:** a *Data Fiduciary*, not significant. **PROGA 2025:** hosts free "online social games". |
| **Old legal text** | Inconsistent with the app. It said 13+; said you had to email to delete your account, although in-app deletion existed; promised deletion "within 30 days", although deletion is immediate; and had no Grievance Officer, jurisdiction or IT Rules content. |

---

## 2. Which laws apply, and when (as of 27 Nov 2026)

| Law | Status | Applies to Nativity? |
|---|---|---|
| **DPDP Act 2023 + DPDP Rules 2025** (notified 13 Nov 2025) | Rules 1, 2 and 17–21 (the Data Protection Board) have been in force since 13 Nov 2025. Rule 4 (Consent Managers) has been in force since 13 Nov 2026. **Rules 3 and 5–16, which hold the core fiduciary duties (notice, security, breach, retention, rights, children), start 13 May 2027.** | Yes. The documents and features were built to the core duties now, ahead of commencement. |
| **IT Act 2000**, s.43A + SPDI Rules 2011 | In force until DPDP commencement replaces s.43A. | Yes: privacy policy, reasonable security, grievance contact. |
| **IT Rules 2021** (intermediary due diligence), as amended 2022, 2023, and **Feb 2026** (in force 20 Feb 2026) | In force. The 2026 amendment shortened grievance deadlines: resolve in 7 days; 36 h for rule 3(1)(b) complaints; 2 h for intimate-image complaints; 3 h for takedowns on actual knowledge. It also requires informing users every 3 months. | Yes: Nativity hosts user content. |
| **CERT-In Directions** (28 Apr 2022) | In force. Report incidents within 6 h; keep logs for 180 days in India. | Very broad scope. **Requires legal review.** |
| **PROGA 2025 + Online Gaming Rules 2026** (in force 1 May 2026) | In force. Money games are banned. Social games need registration only if the government notifies their category. | Partly. **Requires legal review** on whether a platform hosting other people's free games is a "provider". |
| **Copyright Act 1957 + Copyright Rules 2013** | In force. | Yes: user-uploaded games and media. |
| **Consumer Protection Act 2019 + E-Commerce Rules 2020** | In force. | Not currently: nothing is sold. Revisit if Nativity is monetised. |
| **Indian Contract Act 1872 / Majority Act 1875** | In force. | Supports 18+ (minors cannot contract). |

---

## 3. How the 18+ restriction works

**Visitors (no account)**
1. The first screen is "Adults only", with two buttons: *I'm 18 or older* and *I'm under 18*.
2. No guest ID is created until the visitor confirms 18+. `getUser(allowGuest)` only starts an anonymous session after confirmation, so no views or plays are recorded for anyone else.
3. Choosing "under 18" shows a "Nativity is for adults" screen and nothing is sent to the server. The only thing stored is a flag on the device.

**Accounts: every sign-in method**
1. **Press start** (sign-in) asks for email and the checkbox "I'm 18 or older and I agree to the Terms and Privacy Policy".
2. After *any* sign-in, the app calls `my_account_state()`. If no age record exists, it shows **One last step**: a date-of-birth field, the community rules, and the consent checkbox.
3. The person is shown "Is this right? 12 March 1995 (age 31)" before submitting, because the date can't be changed afterwards.
4. **On the server**, `confirm_birth_date(dob)` does the check:
   - It rejects guests and dates that are impossible, in the future, or before 1900.
   - It refuses a second attempt: one record per account.
   - It computes age against **today in Asia/Kolkata**.
   - **Adult:** stores the date of birth.
   - **Under 18:** stores only "ineligible", never the date. It removes the person's cheers, crews, stamps, views and plays, and hides their games and notes.
5. Because the check runs after sign-in and is provider-independent, it applies equally to email, Google (if enabled later) and any future provider.

**Enforcement (cannot be bypassed from the browser)**
- **`can_participate()`** is true only when all of these hold: signed in, not a guest, age status adult (or team demo account), current Terms *and* Privacy versions accepted, and not suspended.
- **Restrictive row-level security policies** require it for: cheering, joining crews, posting notes, stamps (insert and update), publishing or editing games, editing the profile, and uploading files to storage.
- Changing frontend code or calling the REST API directly cannot get around it.
- **Members cannot write their age record.** There are no insert or update grants on `account_age`; only the security-definer functions can write it.
- **Content visibility:** games and notes from accounts that are not confirmed adults are hidden from everyone else, both in row-level security and in `game_feed`.
- **Always available**, whatever the age status: deleting your own content, reporting, blocking, data download and account deletion.

**Date-of-birth corrections**
- Requests are made in Options → Date of birth. A request has a new date and a reason of 10–500 characters. Each person can have one pending request and at most 2 per year.
- Moderators review them in Ref desk, which shows the date on record and the requested date with the resulting age. They can approve or reject, with a note.
- A moderator cannot review their own request.
- An approved date that is under 18 makes the account ineligible.
- No ID documents are collected in the app. A moderator may email the person if needed.

**Under-18 accounts**
- Blocked screen with options to delete the account, request a correction (for typos), or sign out.
- If the account uploaded nothing, it is deleted automatically after 30 days by the retention job.
- If it uploaded games, a moderator must remove it, because the files are in Storage.

---

## 4. Database changes: `supabase/migrations/0008_adults_only.sql`

| Object | Purpose |
|---|---|
| `compliance` schema | Holds records the API can't reach. No grants to `anon` or `authenticated`. |
| `policy_versions` (public read) | Current Terms and Privacy versions (`v2`). |
| `policy_acceptances` (own read; written only by function) | Who accepted which version and when. Append-only. |
| `account_age` (own read; written only by function) | Status `adult`, `ineligible` or `operator`; `birth_date` (adults only); method; check time. |
| `dob_corrections` (own read) | Correction requests and moderator decisions. |
| `profiles.rules_notified_at` | Time of the last 3-monthly rules reminder. |
| `compliance.deleted_accounts` | Minimal registration record kept 180 days after deletion (IT Rules 3(1)(h)). |
| `compliance.preserved_content` | Content hidden after reports, plus the related reports, kept 180 days (IT Rules 3(1)(g)). |
| **Functions** | `today_ist`, `is_eligible_author`, `has_current_consent`, `can_participate`, `my_account_state`, `accept_policies`, `confirm_birth_date`, `restrict_ineligible`, `request_birth_date_correction`, `list_birth_date_corrections`, `review_birth_date_correction`, `ack_rules_notice`, `compliance.archive_account`, `compliance.run_retention`, and a new `delete_my_account` that archives first. |
| **Policies** | Nine restrictive "adults only" write policies. Updated read policies for `games` and `comments`. `game_feed` filters out content from non-adult authors. |
| `reports.reason` | Adds `intimate`, `minor`, `impersonation` and `privacy`. |
| **Retention job** | `nativity-retention` runs nightly at 03:30 IST through pg_cron. It purges 180-day records, guest IDs older than 90 days, and under-18 accounts without uploads after 30 days. |

**Migrating existing users.** No existing account is assumed to be an adult.

- Real accounts get no age record. They see "One last step" the next time they open Nativity.
- They can't post until they've confirmed their date of birth and accepted the v2 documents.
- Their existing games and notes are hidden from others until then. Nothing is deleted, so it all reappears as soon as they confirm.
- The five seed personas (`@demo.invalid`, the IDs in `seed.sql`) are marked `operator`: they are fictional demo accounts run by the operator.
- Consent is recorded as `(user_id, doc, version, accepted_at)` for both documents.

**Tests:** `supabase/tests/0008_adults_only_test.sql`. 29 checks run inside one block that rolls everything back (see section 7).

---

## 5. Modified files

| File | Change |
|---|---|
| `supabase/migrations/0008_adults_only.sql` | **New.** Everything in section 4. |
| `supabase/tests/0008_adults_only_test.sql` | **New.** Server-side enforcement tests (self-rolling-back). |
| `src/lib/age.js` | **New.** Age rule matching the server: India date; 29 Feb turns 18 on 1 Mar; validation and formatting. |
| `src/screens/Age.jsx` | **New.** `AgeDeclaration`, `NotForYou`, `AccountGate` (DOB + consent), `IneligibleAccount`, `DobSheet` (corrections), `RulesReminder`. |
| `src/content/legal.js` | Rewritten. Operator, Grievance Officer, jurisdiction, versions, deadlines, 11 report reasons, new Terms of Service, new Privacy Policy, community rules. |
| `src/components/LegalSheet.jsx` | Structured documents: version, effective date, contents, lists. |
| `src/App.jsx` | Wires the gates, consent, the quarterly reminder, data download, the correction queue and report acknowledgements. |
| `src/lib/supabaseApi.js` | `getUser(allowGuest)`, `startGuest`, `getAccountState`, `acceptPolicies`, `confirmBirthDate`, correction functions, `ackRulesNotice`, `exportMyData`. Reports return a reference. Google flag. |
| `src/lib/demoApi.js` | The same functions for demo mode. |
| `src/screens/Me.jsx` | Options: Date of birth, Download my data, separate Terms and Privacy rows, Grievance Officer, versions. Delete-account text explains the 180-day records. |
| `src/screens/RefDesk.jsx` | Deadline badges per IT Rules (2 h / 36 h / 7 days, overdue in red), urgent styling, correction review queue. |
| `src/screens/Entry.jsx` | 18+ wording on Press start. Google button hidden while the provider is off. |
| `src/components/ReportSheet.jsx` | Acknowledgement with reference and deadline. Grievance email for people without an account. |
| `src/index.css` | Styles for the 18+ screens, legal documents and Ref desk deadlines. |
| `src/components/TermsGate.jsx` | **Removed.** Replaced by `AccountGate`. |
| `README.md` | 18+ notes and Phase 6. |

---

## 6. Compliance checklist

Status key: ✅ Compliant · 🟡 Partially compliant · ⛔ Not implemented · ⚖️ Requires legal review · — Not applicable

### DPDP Act 2023 and DPDP Rules 2025 (core duties from 13 May 2027)

| Requirement | Status | Notes |
|---|---|---|
| s.5 / r.3: itemised notice (data, purpose, rights, Board complaint) | ✅ ⚖️ | Privacy Policy sections 3–9 itemise each data type and purpose. |
| s.5(3): notice in Eighth Schedule languages | 🟡 | Offered on request; no translations prepared yet. |
| s.6: free, specific, informed consent by clear affirmative action; records | ✅ | Unticked checkbox. Versioned, timestamped `policy_acceptances`. Re-consent is required when the version changes. |
| s.6(4): withdraw consent as easily as giving it | 🟡 | Withdrawal is by account deletion (in-app, immediate). There is no partial withdrawal, because processing is needed for the service. |
| s.8(5) / r.6: reasonable security safeguards | 🟡 | RLS on every table; private compliance schema; TLS; provider encryption at rest; game sandbox. No formal security programme. One-year log retention not implemented. |
| s.8(6) / r.7: breach notice to the Board and users (72-hour report) | 🟡 | Committed in the Privacy Policy. **No written incident-response runbook yet.** |
| s.8(7) / r.8: erase when purpose ends; retention schedule | ✅ | Immediate deletion; 90-day guest purge; 180-day legal records then purge. Depends on pg_cron being active (see section 8). |
| r.8 / Third Schedule: 3-year inactivity erasure | — | Below the user thresholds. |
| r.8(3) / r.6: one-year minimum log retention (from May 2027) | ⛔ ⚖️ | Provider log retention is shorter. Plan before May 2027. |
| s.9 / r.10: children's data (verifiable parental consent) | ✅ ⚖️ | Avoided by excluding under-18s with a server-checked date of birth. Whether self-declared DOB is enough "due diligence" needs legal review. |
| s.11: right to access a summary | ✅ | Options → Download my data (JSON of everything RLS lets the user read). |
| s.12: correction and erasure | ✅ | Profile edits; DOB correction review; in-app account deletion. |
| s.13: grievance redressal | ✅ | Grievance Officer published in the app and documents. |
| s.14: nomination | 🟡 | Handled by email, manually. |
| s.16: cross-border transfer | ✅ ⚖️ | Data stored in Mumbai. Vercel and Google transfers are disclosed. No country is restricted by notification as far as we know. |
| s.10: Significant Data Fiduciary duties | — | Not notified as significant. |

### IT Act 2000 and SPDI Rules 2011

| Requirement | Status | Notes |
|---|---|---|
| s.43A / SPDI r.4: published privacy policy | ✅ | |
| SPDI r.8: reasonable security practices (e.g. IS/ISO 27001) | ⛔ ⚖️ | No certified programme. Usual for a solo project, but a legal exposure. |
| SPDI r.5(9): grievance officer | ✅ | |
| s.79: safe harbour (needs IT Rules due diligence) | 🟡 | Depends on meeting the timelines below in practice. |

### IT Rules 2021 (as amended to Feb 2026)

| Requirement | Status | Notes |
|---|---|---|
| 3(1)(a): publish rules, privacy policy and user agreement | ✅ | |
| 3(1)(b): tell users not to host listed content | ✅ ⚖️ | Terms section 6 paraphrases the categories in plain English. |
| 3(1)(c): remind users every 3 months | ✅ | Server-recorded quarterly reminder for members. Visitors see the rules via the Terms link. |
| 3(1)(d): remove on actual knowledge / orders within 3 hours | 🟡 | Moderators can hide instantly. **Needs someone reachable around the clock.** |
| 3(1)(g): preserve removed content and records 180 days | 🟡 | Hidden content and reports are preserved when the author deletes their account. Uploaded files and content the user deleted themselves are not. |
| 3(1)(h): keep registration info 180 days after deletion | ✅ | `compliance.deleted_accounts`. |
| 3(1)(j): give information to authorised agencies within 72 hours | ⛔ | Process only (email). No written procedure. |
| 3(2): publish Grievance Officer; acknowledge in 24 h; resolve in 7 days / 36 h / 2 h | 🟡 | Officer published. In-app acknowledgement with a reference. Ref desk shows deadlines and overdue items. **Meeting them depends on the operator checking Ref desk; there are no alerts.** |
| Grievance Appellate Committee information | ✅ | Terms section 10. |
| 3(3): synthetically generated information duties | — | Nativity offers no AI-generation tools. Deceptive synthetic media is prohibited in the Terms. |
| Rule 4: significant social media intermediary duties | — | Below 50 lakh users. |

### Other laws

| Requirement | Status | Notes |
|---|---|---|
| PROGA 2025: no online money games | ✅ | Prohibited; no payments at all. |
| PROGA Rules 2026: social game registration or determination | ⚖️ | Only if the category is notified; the platform's status is unclear. |
| CERT-In: 6-hour incident reporting, 180-day logs in India | ⛔ ⚖️ | Applicability to a solo free app needs review. |
| Copyright Act 1957 / Rules 2013: notice and takedown | 🟡 | Procedure in Terms section 12 and a "copyright" report reason. The 21-day handling under Rule 75 is manual. |
| Consumer Protection Act / E-Commerce Rules | — | No sales. Revisit if monetised. |
| Terms clauses: liability cap ₹1,000, indemnity, New Delhi courts | ⚖️ | Standard, but enforceability against consumers should be checked. |

---

## 7. Testing

**App flows (demo mode, 360×760). All passed:**

| Flow | Result |
|---|---|
| First visit shows "Adults only" | ✅ No guest ID is created (no session) before confirmation. |
| "I'm under 18" | ✅ "Nativity is for adults". Only a device flag is stored. "I made a mistake" returns to the choice. |
| "I'm 18 or older" | ✅ Onboarding, then Discover. |
| Sign-in checkbox | ✅ Reads "I'm 18 or older and I agree to the Terms and Privacy Policy". |
| Under-18 date (17 years old) | ✅ Confirmation step, then the blocked screen. Date not kept; activity removed. |
| Under-18 "I entered the wrong date" | ✅ Correction filed; the screen shows "Correction under review". |
| Adult date | ✅ "Welcome to Nativity!". Options shows the date of birth. |
| Download my data | ✅ JSON file with the age record, 2 consent records, notes, cheers, crews and so on. |
| Terms viewer | ✅ v2, effective date, 19 sections with contents links, lists readable on a phone. |
| Intimate-image report | ✅ "Report received (ref …). We'll act within 2 hours." |
| Age maths | ✅ Exactly 18 today is an adult; one day short is not. 30 Feb, 1899 and future dates are rejected. |
| Lint and production build | ✅ |

**Database enforcement (live Supabase, 27 Nov 2026): 29 passed, 0 failed.** The migration was applied, then `supabase/tests/0008_adults_only_test.sql` was run against the live database and rolled back. A follow-up query confirmed 0 test users, 0 test games and 0 deletion records left behind. pg_cron is installed and `nativity-retention` is scheduled (`0 22 * * *` UTC = 03:30 IST). The checks cover:

- **Guests:** blocked from cheering and from setting a date of birth.
- **Unconfirmed members:** blocked from cheering, commenting, editing their profile and uploading. They can't write their own age record, and can't accept an outdated policy version.
- **Visibility:** an unconfirmed author's note and game are hidden from others.
- **Date validation:** future and implausible dates are rejected. Exactly 18 today is an adult. The date can't be changed afterwards.
- **Consent:** an adult is blocked until the policies are accepted, then can cheer. The consent record is saved with its version and time. Nobody can read other people's age records.
- **Moderation:** non-moderators can't list corrections.
- **Under-18:** one day short is ineligible, the DOB is not stored, the account can't cheer, can't retry with another date, a correction request is filed, and the request alone changes nothing.
- **Deletion:** a 180-day registration record is kept, the account is gone, and its cheers are removed.
- **Privacy:** compliance records are unreachable from the API.

---

## 8. Remaining risks and next steps

1. **Self-declared age.** A determined minor can enter a false date or make a new email address. That is industry-standard for free platforms without ID checks, but whether it is adequate under DPDP s.9 needs legal review.
2. **Accounts exist before the date-of-birth check.** Supabase creates the auth user (the email) when the sign-in link is used. Under-18 emails are therefore held until the 30-day purge, then 180 days in the legal record.
3. **The retention job runs on pg_cron.** It is installed and scheduled (checked 27 Nov 2026). If the job is ever removed, the Privacy Policy's retention statements stop being true.
4. **Under-18 accounts with uploads need manual removal.** Their files stay reachable at direct Storage URLs until a moderator deletes them.
5. **Games can contact other websites** (exposing players' IP addresses). This is disclosed. A content security policy in the game frame would stop it, but could break games that load libraries from CDNs.
6. **Google Fonts sends IP addresses to Google.** Self-hosting the fonts would remove that.
7. **Grievance deadlines (2 h / 36 h / 3 h) need someone watching.** There are no push or email alerts for new reports yet.
8. **Not yet in place:** an incident-response runbook, CERT-In reporting, 180-day logs in India, the May 2027 one-year log rule, and a formal security programme.
9. **The legal documents haven't been reviewed by a lawyer.** Consider adding a postal address for the Grievance Officer.
10. **Your own account** (and any other real account) must confirm its date of birth before its games show again.
11. **Version changes.** Change `TERMS_VERSION` / `PRIVACY_VERSION` in `legal.js` *and* `policy_versions` together.

### Sources

- [DPDP Rules 2025, phased commencement](https://en.wikipedia.org/wiki/Digital_Personal_Data_Protection_Rules,_2025) · [timeline](https://protectcomply.com/blog/dpdp-rules-2025-timeline/) · [Rules 7, 8 and 10 summary](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/) · [Third Schedule](https://www.taxmann.com/post/blog/data-retention-erasure-dpdp-act)
- [IT Amendment Rules 2026: overview and new timelines](https://www.argus-p.com/updates/updates/update-overview-of-the-it-intermediary-amendment-rules-2026/) · [MediaNama](https://www.medianama.com/2026/02/223-meity-amendments-it-rules-synthetic-media-deepfakes/)
- [IT Rules 2021, rule 3(1) text](https://indiankanoon.org/doc/45988656/) · [MeitY FAQ on IT Rules](https://taxguru.in/corporate-law/faqs-address-queries-it-rules-2021-part-ii.html)
- [CERT-In Directions 2022](https://www.internetsociety.org/resources/doc/2022/internet-impact-brief-india-cert-in-cybersecurity-directions-2022/)
- [Online Gaming Rules 2026](https://www.medianama.com/2026/04/223-online-gaming-rules-notified-may-1-major-changes/) · [Lexology summary](https://www.lexology.com/library/detail.aspx?g=822e9f46-659b-4c32-aa76-6045645a9351)
