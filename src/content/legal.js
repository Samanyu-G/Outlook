// Terms of Service and Privacy Policy shown inside the app.
//
// ⚠️ These are plain-language DRAFTS written to match how Nativity actually
// works. They are not legal advice. Before a public launch, have them checked
// by a lawyer for the countries you launch in (for India, the Digital Personal
// Data Protection Act 2023; for the EU/UK, GDPR; for the US, COPPA for under-13s).
//
// Before launch: put your real contact email here.
export const CONTACT_EMAIL = 'gsomg2023@gmail.com'
export const TERMS_VERSION = '2026-11-27'
export const MIN_AGE = 13
// Set when someone ticks the box before signing in; used to record their agreement afterwards.
export const TERMS_PENDING_KEY = 'nativity:terms-pending'

// Reasons people can pick when reporting a game or comment (keys match the database).
export const REASONS = [
  ['sexual', 'Sexual or inappropriate content'],
  ['violence', 'Violence, gore or self-harm'],
  ['harassment', 'Hate, bullying or harassment'],
  ['scam', 'Scam, phishing or harmful code'],
  ['copyright', 'Stolen game, art or music'],
  ['spam', 'Spam'],
  ['other', 'Something else'],
]

export const TERMS = {
  title: 'Terms of Service',
  updated: '27 November 2026',
  sections: [
    ['Who can use Nativity', `You must be at least ${MIN_AGE} years old. If you’re under 18, check with a parent or guardian before uploading games. By creating an account you agree to these terms.`],
    ['Your account', 'Keep your sign-in email secure. You’re responsible for what is posted from your account. Your handle must not pretend to be someone else.'],
    ['Uploading games', 'You may only upload games you made, or have the right to share, including their art, music and code. You keep ownership of your game. By uploading it, you give Nativity permission to host it, show its trailer in the feed, and let people play it for free inside Nativity. You can delete your game at any time from your profile, which removes it from the app.'],
    ['What’s not allowed', 'No sexual content, no graphic violence or gore, no hate or harassment, no content that targets or bullies a real person, no scams, phishing, malware or code that tries to break out of the game sandbox, no gambling with real money, no collecting personal information from players, and no spam. Games and comments must be suitable for everyone aged 13 and up.'],
    ['Comments and feedback', 'Be kind and useful. Criticise the game, not the person who made it.'],
    ['Reports and moderation', 'Anyone signed in can report a game or comment. Content reported by several people may be hidden automatically until we review it. We may hide content, remove it, or suspend accounts that break these rules. If you think we got it wrong, contact us.'],
    ['Playing games', 'Games are made by independent creators, not by Nativity. They run in a sandbox that keeps them away from your account, but we can’t check every game, so play at your own risk and report anything that looks wrong.'],
    ['Changes and ending', 'We may update these terms; we’ll ask you to agree again if the changes matter. You can stop using Nativity at any time. We may close accounts that seriously or repeatedly break the rules.'],
    ['No warranty', 'Nativity is provided “as is”. We’ll do our best to keep it running and safe, but we can’t promise it will always be available or error-free.'],
    ['Contact', `Questions or appeals: ${CONTACT_EMAIL}`],
  ],
}

export const PRIVACY = {
  title: 'Privacy Policy',
  updated: '27 November 2026',
  sections: [
    ['What we collect', 'Your email address (to sign you in). Your handle, name and bio (public). The games, trailers and comments you post (public). Your likes and follows (public). Which games you viewed and played, your scores and your quick feedback (private: feedback is shared only with that game’s creator). Reports you send (seen only by moderators). If you browse without signing in, we create an anonymous guest ID so your views count; it isn’t linked to your name or email.'],
    ['What we don’t collect', 'No passwords (you sign in with an email link). No location, contacts, camera or microphone. No advertising trackers. Games you play run in a sandbox and can’t see who you are.'],
    ['How we use it', 'To run your account, show the feed, count views fairly, show creators how their games are doing (as totals, not names), stop spam and abuse, and keep the community safe.'],
    ['Who we share it with', 'We don’t sell your data. It’s stored with our hosting provider, Supabase, which processes it on our behalf. Public things (your handle, games, comments, likes, follows) can be seen by anyone using Nativity.'],
    ['Saved game data', 'If a game saves progress or high scores, that’s stored only in your browser on your device.'],
    ['Your choices', 'You can edit your profile, delete your games and comments, and unfollow or block people at any time. To delete your account and data, or to get a copy of it, contact us and we’ll do it within 30 days.'],
    ['Children', `Nativity is not for children under ${MIN_AGE}. If we learn an account belongs to someone under ${MIN_AGE}, we’ll delete it.`],
    ['How long we keep it', 'As long as your account is open. When you delete your account, your data is removed within 30 days, except where we must keep something to deal with abuse or the law.'],
    ['Contact', `Privacy questions: ${CONTACT_EMAIL}`],
  ],
}
