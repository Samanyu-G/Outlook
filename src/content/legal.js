// Terms of Service and Privacy Policy shown inside Nativity, plus the facts they rely on.
//
// Every statement here describes what the app and database actually do (see
// docs/LEGAL-COMPLIANCE.md for where each one is implemented). If you change how
// Nativity handles data, change these documents too, bump the version below AND in
// supabase/migrations (policy_versions), and everyone will be asked to accept again.
//
// These documents were drafted carefully but are not legal advice. Items marked
// "Requires legal review" in docs/LEGAL-COMPLIANCE.md should be checked by an Indian lawyer.

export const OPERATOR = 'Samanyu G'
export const CONTACT_EMAIL = 'gsomg2023@gmail.com'
export const GRIEVANCE_OFFICER = { name: 'Samanyu G', email: 'gsomg2023@gmail.com', title: 'Grievance Officer, Nativity' }
export const JURISDICTION = 'New Delhi'
export const SITE = 'nativity-sable.vercel.app'

export const MIN_AGE = 18
// Must match public.policy_versions in the database.
export const TERMS_VERSION = 'v2'
export const PRIVACY_VERSION = 'v2'
export const EFFECTIVE = '27 November 2026'

// Report reasons (keys match the database). "intimate" and "minor" are urgent tracks.
export const REASONS = [
  ['intimate', 'Intimate or sexual image of a real person shared without consent'],
  ['sexual', 'Sexual or pornographic content'],
  ['minor', 'This account seems to belong to someone under 18'],
  ['violence', 'Violence, gore or self-harm'],
  ['harassment', 'Hate, bullying or harassment'],
  ['impersonation', 'Pretending to be someone else'],
  ['privacy', 'Shares someone’s personal information'],
  ['scam', 'Scam, phishing or harmful code'],
  ['copyright', 'Stolen game, art or music'],
  ['spam', 'Spam'],
  ['other', 'Something else (including anything illegal in India)'],
]

// How fast each kind of complaint must be handled (IT Rules 2021 as amended in 2026).
export const GRIEVANCE_TIMES = {
  acknowledge: '24 hours',
  resolve: '7 days',
  prohibited: '36 hours',
  intimate: '2 hours',
}

const G = GRIEVANCE_OFFICER

/* A document is a list of sections. Each block is a paragraph (string) or { list: [...] }. */
export const TERMS = {
  title: 'Terms of Service',
  version: TERMS_VERSION,
  effective: EFFECTIVE,
  sections: [
    ['1. About these Terms', [
      `Nativity (${SITE}) is a place to discover and play small browser games made by independent creators. It is run by ${OPERATOR}, an individual based in India (“we”, “us”).`,
      'These Terms, together with our Privacy Policy and Community Rules, are the agreement between you and us. They are also our rules and regulations, privacy policy and user agreement under rule 3(1)(a) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (“IT Rules”). By using Nativity you agree to them. If you do not agree, do not use Nativity.',
    ]],
    ['2. Adults only (18+)', [
      `Nativity is only for adults aged ${MIN_AGE} or older. You must not use Nativity, or create an account, if you are under ${MIN_AGE}.`,
      { list: [
        `Before you can browse, you must confirm that you are ${MIN_AGE} or older.`,
        'When you create an account, you must enter your real date of birth. We work out your age on our servers using today’s date in India. If you are under 18, your account cannot post anything, and it is removed (see our Privacy Policy).',
        'Your date of birth cannot be edited freely. If you entered it wrongly, request a correction in Options. A moderator reviews it, and may contact you by email before deciding.',
        'Giving a false date of birth is a serious breach of these Terms. We will close accounts that we reasonably believe belong to someone under 18.',
      ] },
    ]],
    ['3. Your account', [
      { list: [
        'One person per account. Use your own email address and keep access to it secure: anyone who can open your sign-in emails can use your account.',
        'Your handle and profile must not pretend to be someone else or mislead people about who you are.',
        'You are responsible for everything done from your account. Tell us straight away if you think someone else is using it.',
        'You can delete your account at any time in Options. What we keep afterwards, and for how long, is explained in our Privacy Policy.',
      ] },
    ]],
    ['4. What Nativity does, and what it doesn’t', [
      'Nativity hosts games, trailers, notes and other content uploaded by users. We are an intermediary: we do not create, select or edit what users upload, and we do not endorse it. Each creator is responsible for their own game.',
      'Nativity is free. There are no payments, subscriptions, in-app purchases, real-money games or prizes. If that ever changes, we will publish separate terms and ask you to agree before you pay anything.',
    ]],
    ['5. Your content and the licence you give us', [
      'You keep ownership of the games, trailers, notes and other content you upload (“your content”).',
      'By uploading, you give us a non-exclusive, royalty-free, worldwide licence to host, store, copy, display, run and share your content inside Nativity, only so that we can operate and promote Nativity. This licence ends when you delete the content or your account, except for copies we must keep by law (for example, records of content removed after a report, kept for 180 days) and copies already saved by other people’s browsers.',
      'You promise that you own your content, or have every permission needed for it (including its code, art, music, fonts and names), and that it follows these Terms and the law.',
    ]],
    ['6. Content you must not upload or share', [
      'You must not upload, share, display or send anything that:',
      { list: [
        'belongs to someone else and you have no right to share;',
        'is obscene or pornographic, is paedophilic, invades someone’s privacy (including bodily privacy), insults or harasses on the basis of gender, is racially or ethnically objectionable, relates to or encourages money laundering or gambling, or promotes enmity between groups on the grounds of religion or caste with the intent to incite violence;',
        'is harmful to children;',
        'infringes a patent, trademark, copyright or other proprietary right;',
        'deceives or misleads about where a message came from, or knowingly spreads information that is false or misleading;',
        'impersonates another person, including through synthetic (AI-generated or altered) images, audio or video of a real person presented as real;',
        'threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with foreign States, or public order, incites any offence, prevents the investigation of an offence, or insults another nation;',
        'contains software viruses or any code designed to interrupt, destroy or limit any computer resource;',
        'is a real-money game, gambling or betting, or advertises one;',
        'violates any law in force in India.',
      ] },
      'Also not allowed on Nativity: graphic gore, content that bullies a real person, spam, and anything that shares another person’s personal information.',
    ]],
    ['7. Rules for games', [
      'Games run in a sandbox that keeps them away from your Nativity account. Creators must not try to get around it. A game must not:',
      { list: [
        'collect, store or send personal information about players, or track players across sites;',
        'try to break out of the sandbox, trick players into revealing passwords or codes, or open pop-ups or redirects;',
        'mine cryptocurrency or use a player’s device for anything other than the game;',
        'take payments of any kind.',
      ] },
      'We may remove any game that we reasonably believe breaks these rules or puts players at risk.',
    ]],
    ['8. Notes, stamps and cheers', [
      'Be kind and specific. Criticise the game, never the person who made it. Stamp totals are public; which stamps you gave is visible only to you and that game’s creator.',
    ]],
    ['9. How we moderate', [
      { list: [
        'Anyone signed in can report a game, note or account. Reports are private: the person reported is not told who reported them.',
        'Anything reported by 3 different people is hidden automatically until a moderator reviews it.',
        'Moderators may hide or remove content, dismiss a report, or suspend an account. Suspended accounts can still play games but cannot post.',
        'When content is removed after a report, we keep a record of it for 180 days, as the IT Rules require, and then delete it.',
        'We may share information with Indian government agencies or courts when the law requires it.',
      ] },
    ]],
    ['10. Complaints and our Grievance Officer', [
      `You can complain about content, an account, or anything else about Nativity by reporting it in the app, or by emailing our Grievance Officer: ${G.name}, ${G.email}. People without an account can use the email address too.`,
      { list: [
        `We acknowledge complaints within ${GRIEVANCE_TIMES.acknowledge} and resolve them within ${GRIEVANCE_TIMES.resolve}.`,
        `If you complain that content falls into the list in section 6, we act within ${GRIEVANCE_TIMES.prohibited}.`,
        `If content shows a real person in an intimate or sexual way (including a morphed or synthetic image) without their consent, report it with the reason “Intimate or sexual image…”, or email us: we act within ${GRIEVANCE_TIMES.intimate}.`,
        'If you are not satisfied with our decision, you may appeal to the Grievance Appellate Committee set up by the Government of India (gac.gov.in) within 30 days of our decision.',
      ] },
    ]],
    ['11. Suspension, closing accounts and appeals', [
      'You can stop using Nativity and delete your account at any time. We may suspend or close an account that breaks these Terms or the law, or that we reasonably believe belongs to someone under 18. Where we can, we will tell you why.',
      `If you think we made a mistake, email ${G.email} within 30 days. A person will review it and reply within ${GRIEVANCE_TIMES.resolve}.`,
    ]],
    ['12. Copyright complaints', [
      `If you believe a game or trailer infringes your copyright, email ${G.email} with: your name and contact details, the work you own, a link to the content on Nativity, and a statement that you own the rights (or act for the owner). We will disable access to it as provided by the Copyright Act, 1957 and the Copyright Rules, 2013, and tell the creator.`,
    ]],
    ['13. Other services we rely on', [
      'Nativity runs on third-party services: Supabase (database, sign-in and file storage), Vercel (website hosting) and Google Fonts (typefaces). Games are made by independent creators and may load images, sounds or code from other websites. We are not responsible for third-party services or websites, which have their own terms.',
    ]],
    ['14. Our name and design', [
      'The Nativity name, logo, design and code belong to us. You may not copy or reuse them without permission, except to link to Nativity or share a game.',
    ]],
    ['15. No warranty, and limits on our liability', [
      'Nativity is provided “as is” and “as available”. We do our best to keep it safe and running, but we cannot promise it will always be available, error-free, or free of harmful content uploaded by others.',
      'To the extent the law allows, we are not liable for content uploaded by users, for indirect or consequential losses, or for losses caused by games or third-party services. Because Nativity is free, our total liability to you for any claim is limited to ₹1,000. Nothing in these Terms limits any liability that cannot be limited under Indian law, or your rights as a consumer.',
    ]],
    ['16. If you break these Terms', [
      'You agree to compensate us for reasonable losses and legal costs caused by content you upload, or by your breach of these Terms or the law.',
    ]],
    ['17. Law and disputes', [
      `These Terms are governed by the laws of India. Please contact the Grievance Officer first: most problems can be solved quickly. Subject to your right to approach the Grievance Appellate Committee and any other remedy the law gives you, the courts at ${JURISDICTION} have exclusive jurisdiction.`,
    ]],
    ['18. Changes to these Terms', [
      'We may update these Terms. When we do, we change the version number and date at the top, show you the new version in the app, and ask you to accept it before you can post again. At least once every three months we remind signed-in members of our rules, as the IT Rules require.',
    ]],
    ['19. Contact', [
      `Grievance Officer: ${G.name} · ${G.email}`,
      `General questions: ${CONTACT_EMAIL}`,
    ]],
  ],
}

export const PRIVACY = {
  title: 'Privacy Policy',
  version: PRIVACY_VERSION,
  effective: EFFECTIVE,
  sections: [
    ['1. Who we are', [
      `Nativity (${SITE}) is run by ${OPERATOR}, an individual based in India (“we”, “us”). We decide why and how your personal data is processed, so we are the “Data Fiduciary” under India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”).`,
      'This policy explains, item by item, what we collect, why, who can see it, how long we keep it, and your rights. You can ask us for this notice in English or in any language listed in the Eighth Schedule to the Constitution of India.',
    ]],
    ['2. Nativity is for adults only', [
      'We do not knowingly process personal data of anyone under 18.',
      { list: [
        'Before you browse, you confirm you are 18 or older. If you say you are under 18, Nativity stops and does not create any ID for you.',
        'When you create an account, you enter your date of birth. Our server checks it against today’s date in India.',
        'If the check shows you are under 18: we do not store your date of birth (only the result), we remove your cheers, crews, stamps, views and plays, we hide your games and notes, and your account cannot post. If you did not upload any games, the account is deleted automatically 30 days later; otherwise a moderator removes it.',
        'If you believe an account belongs to someone under 18, report it with the reason “This account seems to belong to someone under 18”.',
      ] },
    ]],
    ['3. What we collect', [
      'Account details',
      { list: [
        'Email address: used to send sign-in links. Not shown to other users.',
        'Handle, name, bio and avatar colour: public. Your handle starts as a random “player…” name and your name starts as the part of your email before the “@”; you can change both.',
        'When your account was created, whether you are a moderator, and whether your account is suspended.',
      ] },
      'Age and consent records',
      { list: [
        'Date of birth (adults only), whether you passed the check, how it was checked, and when. Only you can see this.',
        'Date-of-birth correction requests: the date you asked for, your reason, and the moderator’s decision and note.',
        'Which version of the Terms and this Privacy Policy you accepted, and when. When we last showed you the community rules.',
      ] },
      'Things you create',
      { list: [
        'Games and trailers you upload (files and videos), with their titles, descriptions and tags: public.',
        'Notes (comments): public. Cheers (likes) and crews (follows): public.',
        'Stamps (Fun!, Clever, Pretty, Tough, Want more): visible to you and that game’s creator; everyone sees the totals.',
        'Reports you send (seen by moderators only) and people you block (seen by you only).',
      ] },
      'Activity',
      { list: [
        'Games whose trailer you watched for 3 seconds, games you started playing and how often, and your score in each round. Creators see totals only, never who played.',
      ] },
      'Guests',
      { list: [
        'If you browse without an account, we create a random guest ID after you confirm you are 18+. Your views and plays are linked to that ID, not to your name or email. Guest IDs and their history are deleted after 90 days.',
      ] },
      'Technical data',
      { list: [
        'Our providers automatically process your IP address, browser type and request times when you use Nativity, to deliver the site and protect it from abuse (see section 6). We do not use analytics, advertising or tracking tools.',
      ] },
      'On your device (not sent to us)',
      { list: [
        'Your browser stores your sign-in session, your settings (autoplay, reduce motion, data saver, night mode, sound), whether you finished onboarding and confirmed you are 18+, the moods you picked, which Mailbox items you have read, and each game’s own save data. Nativity does not set cookies.',
      ] },
      'What we do not collect',
      { list: [
        'Passwords (you sign in with an email link), ID documents, payment details, contacts or location.',
        'Camera: only if you choose “Record” when making a trailer. Your browser opens your camera; the video stays on your device unless you publish it.',
      ] },
    ]],
    ['4. Why we use it', [
      'We process personal data on the basis of the consent you give when you create an account, and, where the law requires it, to comply with legal obligations (section 7 of the DPDP Act). We use it only to:',
      { list: [
        'create and run your account and sign you in;',
        'check that you are an adult, and record your agreement to these documents;',
        'show games, notes, cheers and crews, and count views and players fairly;',
        'show creators totals about how their games are doing;',
        'run your Mailbox (stamps, crews and notes about you and your games);',
        'prevent spam and abuse, handle reports and grievances, and enforce our Terms;',
        'keep records the law requires (section 8) and respond to lawful requests from authorities.',
      ] },
      'We do not sell personal data, show ads, or use your data to profile you.',
    ]],
    ['5. Who can see your data', [
      { list: [
        'Everyone using Nativity: your handle, name, bio, avatar colour, games, trailers, notes, cheers, crews, and stamp totals on games.',
        'A game’s creator: which stamps you gave their game.',
        'Only you: your email, date of birth, age-check result, consent records, correction requests, stamps you gave, views, plays, scores, reports and blocks.',
        'Moderators (currently only the operator): reports and the content reported; date-of-birth correction requests, with the date currently on record, when reviewing them.',
      ] },
      'These rules are enforced by the database itself, not only by the app.',
    ]],
    ['6. Service providers and where data is stored', [
      { list: [
        'Supabase Inc.: database, sign-in emails and file storage. Our database and files are stored in Mumbai, India (region ap-south-1).',
        'Vercel Inc.: hosts and delivers the website through servers around the world. It processes IP addresses and request logs, which may be handled outside India, including in the United States.',
        'Google LLC: Nativity loads its fonts from Google Fonts, so your browser sends your IP address and browser details to Google when the page loads.',
        'Game creators: games are third-party code. They run in a sandbox and cannot see your account, but a game can load images, sounds or code from other websites, which then receive your IP address.',
      ] },
      'These providers process data on our behalf under their own terms. Transfers outside India are made as permitted under section 16 of the DPDP Act. We may also disclose information to government agencies or courts when Indian law requires it.',
    ]],
    ['7. Security', [
      'Connections to Nativity use HTTPS. Our providers state that they encrypt stored data. Database rules decide who can read and change each piece of data, and age and compliance records are kept where the website cannot read them. Games run in a sandbox, away from your account. No system is completely secure, so please keep access to your email safe.',
    ]],
    ['8. How long we keep it', [
      { list: [
        'Your account data, content and activity: until you delete them or your account.',
        'After you delete your account: everything is deleted straight away, except a minimal registration record (your email, handle, when the account was created, and your age-check result), kept for 180 days because the IT Rules require it, and then deleted.',
        'Content that was hidden after a report, and the reports about it: kept for 180 days after you delete your account, because the IT Rules require it. Uploaded files are not kept.',
        'Guest IDs and their history: 90 days.',
        'Under-18 accounts: see section 2.',
        'Logs kept by Supabase and Vercel: for the periods those providers set.',
        'Data on your device: until you clear it in your browser.',
      ] },
      'A scheduled job deletes records once their period ends.',
    ]],
    ['9. Your rights and how to use them', [
      { list: [
        'Access: download a copy of your data at any time in Options → Download my data.',
        'Correction: edit your handle, name and bio in Options. To correct your date of birth, request a correction in Options.',
        'Erasure: delete your account in Options. It happens immediately, apart from the records in section 8.',
        'Withdraw consent: you can withdraw consent at any time by deleting your account. Withdrawing does not affect anything lawfully done before.',
        'Nominate: you can nominate someone to exercise your rights if you die or become unable to; email us with their details.',
        `Grievances: contact our Grievance Officer, ${G.name}, at ${G.email}. We reply within 30 days, or sooner where the law requires.`,
        'If you are not satisfied, you may complain to the Data Protection Board of India.',
      ] },
    ]],
    ['10. Data breaches', [
      'If a breach affects your personal data, we will tell you without delay, along with what happened, the likely effects, what we are doing and who to contact. We will report it to the authorities as Indian law requires, including CERT-In and, once the relevant rules are in force, the Data Protection Board of India.',
    ]],
    ['11. Changes to this policy', [
      'When we change this policy, we update the version and date at the top and ask you to accept the new version in the app before you can post again.',
    ]],
    ['12. Contact', [
      `Grievance Officer and privacy questions: ${G.name} · ${G.email}`,
    ]],
  ],
}

// The community rules shown at sign-up and in the quarterly reminder.
export const RULES = [
  'Nativity is for adults 18 and over.',
  'Only upload games you made or have the right to share.',
  'Nothing sexual, hateful, violent, illegal or harmful, and no real-money games.',
  'Criticise the game, never the person.',
  'Never share anyone’s personal information or intimate images.',
  'Report anything that breaks the rules: we act within the times set by Indian law.',
]
