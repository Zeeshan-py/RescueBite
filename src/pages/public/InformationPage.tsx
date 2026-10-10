import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppLayout } from '../../components/common/AppLayout'

type Section = { title: string; content: ReactNode }
type Information = { title: string; description: string; sections: Section[]; policy?: boolean }
export type InformationPageName = 'about' | 'terms' | 'privacy' | 'faq' | 'food-safety' | 'contact'
const contact = <Link to="/contact" className="font-semibold text-forest underline">Contact page</Link>
const pages: Record<InformationPageName, Information> = {
  about: {
    title: 'About RescueBite', description: 'Good food. Shared purpose. A clearer path from surplus to community support.',
    sections: [
      { title: 'Why we exist', content: 'RescueBite connects food donors with verified organizations and individuals who can collect surplus meals.' },
      { title: 'How a rescue works', content: 'A donor posts accurate food details and a collection deadline. A verified NGO can accept a suggested donation, or an individual can request an eligible offer for donor approval. The donor shares collection details after acceptance, and the recipient confirms receipt.' },
      { title: 'People make the difference', content: 'Donors provide clear information and arrange collection. NGOs assess suitability and capacity. Individuals request only what they can collect. Administrators verify organizations and review activity.' },
      { title: 'What matching means', content: 'Suggestions consider distance, urgency, food compatibility, receiving capacity, and availability. A matching score is a coordination aid; it is not a food safety certification or a guarantee that a collection will happen.' },
      { title: 'Get involved', content: <p><Link className="font-semibold text-forest underline" to="/register">Create an account</Link> as a donor, NGO, or individual recipient. Already a member? <Link className="font-semibold text-forest underline" to="/login">Sign in</Link> to your workspace.</p> },
    ],
  },
  terms: {
    title: 'Terms of Use', description: 'The responsibilities that help everyone coordinate food rescues fairly and safely.', policy: true,
    sections: [
      { title: 'Using the platform', content: 'These terms describe use of RescueBite. Review them before participating. The platform helps coordinate surplus food redistribution; it does not itself inspect food, provide transport, or guarantee receipt. If you cannot follow these responsibilities, do not arrange a rescue through the service.' },
      { title: 'Accounts and organizations', content: 'Provide accurate account and organization information, keep your sign-in credentials secure, and use only accounts you are authorized to operate. An organization representative must have permission to act for that organization. Choose the role that reflects your participation; administrator access is provisioned separately.' },
      { title: 'Donor responsibilities', content: 'List only food you are authorized to offer. Describe its type, quantity, portions, condition, known allergens, handling needs, location, availability, and collection deadline accurately. Do not offer food you believe is unsafe. Update or cancel a donation if its condition or availability changes.' },
      { title: 'Recipient responsibilities', content: 'NGOs assess suitability, capacity, and the information supplied before accepting. Individuals request food for personal consumption and collect it at the agreed time. Recipients follow the donor’s handling instructions and confirm collection only when it actually occurs.' },
      { title: 'Respectful and permitted use', content: 'Do not harass participants, impersonate another person, post false records, expose someone else’s private information, interfere with the service, or attempt to bypass access controls. Use participant contact and location details only for the agreed rescue. Follow applicable food handling, transport, and other local requirements.' },
      { title: 'Your content and privacy', content: <p>You retain responsibility for information you submit and permit the platform to store and display it to support its workflows. Submit only information necessary for the rescue. Our <Link to="/privacy" className="font-semibold text-forest underline">Privacy Policy</Link> explains account, location, and activity data.</p> },
      { title: 'Availability and limits', content: 'The service, matching suggestions, maps, and impact reports may contain errors or become unavailable. Estimated impact is not an independently verified measurement. Participants remain responsible for their decisions and must confirm arrangements directly. Nothing in these terms removes rights or responsibilities that applicable law does not permit to be excluded.' },
      { title: 'Account restrictions and changes', content: 'Administrators may restrict accounts that misuse the service or disrupt rescues. These terms may change as the project evolves; updates will be published on this page with a revised date. Review the current terms before arranging a new rescue.' },
      { title: 'Questions', content: <p>For project questions and how to reach the maintainers, see our {contact}.</p> },
    ],
  },
  privacy: {
    title: 'Privacy Policy', description: 'How RescueBite uses information to connect donors, NGOs, and individual recipients.', policy: true,
    sections: [
      { title: 'Scope', content: 'This policy describes the current RescueBite website and its food rescue workflows. Third-party services have their own privacy practices.' },
      { title: 'Information you provide', content: 'Account records include your name, email, role, and optional mobile number. Donor business profiles include pickup address, business type, hours, and contact details. NGO profiles include organization details, capacity, categories, service area, and verification state. Individual profiles include a general area and contact preference; they do not require a home address or government ID. Donations, requests, collection arrangements, notifications, timestamps, and audit records are stored. Mobile numbers are not verified by SMS and are shared with the parties to an accepted donation for collection coordination, plus authorized administrators.' },
      { title: 'Authentication and Google', content: 'Supabase manages authentication and account sessions. Passwords are handled by Supabase Auth and are not duplicated in the application profile table. If Google sign-in is enabled and you choose it, Google shares account identity information such as your email and profile name with Supabase. RescueBite does not ask for access to your Gmail messages, Drive files, or contacts.' },
      { title: 'Why we use information', content: 'We use data to authenticate you, show eligible food, review requests and NGO matches, arrange collection, send in-app notifications, investigate misuse, and report recorded activity.' },
      { title: 'Who can see records', content: 'Individual meal browsing shows a general area, food type, portion count, and deadline. A matched NGO may see donation details needed to decide whether to accept; donor contact details are shared for an accepted collection. Donors can see requests for their donations, individuals see their own requests, and administrators can review project records. Do not put unnecessary personal or sensitive information in descriptions or notes.' },
      { title: 'Service providers and maps', content: <p>Supabase supplies database, authentication, and realtime services. Netlify hosts the deployed frontend and may process request metadata. Google processes its own sign-in requests when used. Opening maps requests tiles from OpenStreetMap servers, which can reveal your IP address, request metadata, and the map area being viewed. These providers may process data outside your country. Read the <a className="text-forest underline" href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase privacy notice</a>, <a className="text-forest underline" href="https://www.netlify.com/privacy/" target="_blank" rel="noreferrer">Netlify privacy notice</a>, <a className="text-forest underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy policy</a>, and <a className="text-forest underline" href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">OpenStreetMap Foundation privacy policy</a>.</p> },
      { title: 'Browser storage and analytics', content: 'The Supabase client stores session information in browser storage to keep you signed in. Signing out clears the local session. Clearing browser storage may also sign you out. The current application has no advertising trackers or third-party marketing analytics integration; its impact analytics are calculated from project records. Hosting and service providers may keep operational logs.' },
      { title: 'Retention and account requests', content: <p>Account and rescue records remain in the project database; the current app does not implement an automatic deletion schedule or a self-service account deletion button. Historical rescue records are protected from accidental deletion. You can update your name, phone, and location in your profile. For an access, correction, or deletion request, email <a href="mailto:zeeshanahmad0159@gmail.com" className="text-forest underline">zeeshanahmad0159@gmail.com</a>. Requests may require identity verification, and preserving historical records can limit deletion.</p> },
      { title: 'Security and your choices', content: 'Database access controls restrict project data, but no online service can promise absolute security. Keep your account secure, sign out on shared devices, and provide only necessary information. You may use email/password instead of Google sign-in, and browse the public information pages without registering.' },
      { title: 'Policy updates', content: 'We will update this page when the project’s data practices change. The date above identifies the current published version.' },
    ],
  },
  faq: {
    title: 'Frequently asked questions', description: 'A few practical answers before your next food rescue.',
    sections: [
      { title: 'Who can join?', content: 'Donors, NGO representatives, and individual recipients can register. Administrator accounts are managed separately. NGOs must be verified before they can receive matches.' },
      { title: 'Does registering guarantee a food collection?', content: 'No. An NGO must accept a suggestion or a donor must approve an individual request, then collection must be arranged. Food is offered as available; requests are not guaranteed.' },
      { title: 'How are NGOs matched?', content: 'The platform scores distance, urgency, food compatibility, capacity, and availability. Missing coordinates can reduce geographic precision. A suggestion does not automatically mean acceptance or certify food safety.' },
      { title: 'Can I edit or cancel a donation?', content: 'Open My donations and select the donation. A donor can edit only while it is posted and can cancel while the rescue remains active. Existing requests and matches update with the outcome.' },
      { title: 'When is a rescue completed?', content: 'After a donor arranges a collection time and the food is collected, the accepted NGO or individual confirms receipt. Confirmation marks the donation completed.' },
      { title: 'What do the impact numbers mean?', content: 'Reports summarize recorded rescue activity. Any estimated environmental or other impact depends on the stated assumptions and entered quantities; it should not be presented as an independently audited result.' },
      { title: 'Where can I report a problem?', content: <p>See our {contact} for technical issues. For an active pickup, use the relevant participant contact information. Do not put passwords, addresses, or other private account details into a public issue.</p> },
    ],
  },
  'food-safety': {
    title: 'Food safety & community guidelines', description: 'Clear information and responsible handling help participants make informed decisions.',
    sections: [
      { title: 'Share accurate food information', content: 'Describe the food, its condition, preparation or packaging information where known, allergens, storage needs, quantity, and collection deadline. Say when information is unknown instead of guessing. Do not donate food you suspect is contaminated or unsuitable for consumption.' },
      { title: 'Confirm before accepting', content: 'The receiving organization should review the donor’s information and assess whether it can collect, handle, and distribute the food appropriately. Clarify uncertain details with the donor before committing. A high matching score does not establish that food is safe.' },
      { title: 'Coordinate handling and transport', content: 'Agree on pickup timing, packaging, transport, and any storage requirements. Follow applicable local food safety requirements and the receiving organization’s procedures. The platform does not monitor food temperature or inspect food in transit.' },
      { title: 'When plans or conditions change', content: 'Update or cancel the donation when authorized, tell the other participants promptly, and avoid confirming a collection that did not happen. If there is a safety concern, pause the handover.' },
      { title: 'Respect participants and privacy', content: 'Treat donors, organizations, and individual recipients respectfully. Use shared contact details and precise locations only for the rescue. Do not publish identifiable recipient details or photos without permission.' },
      { title: 'Get appropriate help', content: 'This website is a coordination tool, not an emergency service or a source of professional food safety advice. For urgent danger, contact the appropriate local emergency service. For food safety decisions, consult the receiving organization and the relevant local authority.' },
    ],
  },
  contact: {
    title: 'Contact & support', description: 'Find the right place for a project question, technical issue, or account request.',
    sections: [
      { title: 'Email the project maintainer', content: <p>For general questions, account help, or privacy requests, email <a href="mailto:zeeshanahmad0159@gmail.com" className="font-semibold text-forest underline break-all">zeeshanahmad0159@gmail.com</a>. Describe your request and the page involved. Never send your password or sign-in tokens. This opens your email application; the website does not submit a contact form.</p> },
      { title: 'Technical issues and project questions', content: <p>Use the <a href="https://github.com/Zeeshan-py/RescueBite/issues" target="_blank" rel="noreferrer" className="font-semibold text-forest underline">RescueBite GitHub issue tracker</a> for non-sensitive bug reports. Include the page and a short description of what happened. GitHub may require an account.</p> },
      { title: 'Protect your private information', content: 'GitHub issues are public. Do not include passwords, sign-in tokens, client secrets, personal addresses, phone numbers, or identifiable recipient information. Send account and privacy requests to the maintainer by email instead of posting them publicly.' },
      { title: 'An active donation or collection', content: 'Coordinate with the donor or accepted recipient using the contact information available in your authorized workflow. The project issue tracker is not an emergency dispatch service.' },
      { title: 'Privacy and participation', content: <p>Read our <Link to="/privacy" className="text-forest underline">Privacy Policy</Link>, <Link to="/terms" className="text-forest underline">Terms of Use</Link>, and <Link to="/food-safety" className="text-forest underline">food safety guidelines</Link> before sharing information or arranging a rescue.</p> },
    ],
  },
}

export default function InformationPage({ page }: { page: keyof typeof pages }) {
  const info = pages[page]
  useEffect(() => {
    const previous = document.title
    document.title = `${info.title} | RescueBite`
    return () => { document.title = previous }
  }, [info.title])
  return <AppLayout>
    <article className="max-w-3xl">
      <p className="text-xs font-semibold tracking-widest text-forest uppercase">RescueBite · Community information</p>
      <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{info.title}</h1>
      <p className="mt-4 text-base leading-7 text-muted">{info.description}</p>
      {info.policy && <p className="mt-3 text-xs text-muted">Last updated: <time dateTime="2026-10-10">10 October 2026</time></p>}
      <nav aria-label="On this page" className="my-8 rounded-xl border border-line bg-soft p-5">
        <p className="mb-3 text-sm font-semibold">On this page</p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">{info.sections.map((section, index) => <li key={section.title}><a href={`#section-${index + 1}`} className="text-forest underline-offset-4 hover:underline">{section.title}</a></li>)}</ul>
      </nav>
      <div className="space-y-8">{info.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title} className="scroll-mt-6">
        <h2 className="font-display text-2xl">{section.title}</h2>
        <div className="mt-3 text-sm leading-7 text-muted">{typeof section.content === 'string' ? <p>{section.content}</p> : section.content}</div>
      </section>)}</div>
    </article>
  </AppLayout>
}
