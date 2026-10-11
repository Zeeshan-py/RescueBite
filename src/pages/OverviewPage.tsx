import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../components/common/Icon'
import './overview.css'

const roles: { name: string; icon: IconName; title: string; description: string; points: string[] }[] = [
  { name: 'Food donors', icon: 'box', title: 'Your surplus can be someone’s next meal.', description: 'For restaurants, shops, event hosts, and anyone with food to share.', points: ['Post food details and a collection deadline.', 'Choose NGOs, individuals, or both.', 'Coordinate pickup with your accepted recipient.'] },
  { name: 'NGOs', icon: 'building', title: 'Connect good food with your community.', description: 'Find suitable donations for the people your organization supports.', points: ['Complete your organization profile for verification.', 'Review matches based on your needs.', 'Accept a donation and arrange collection.'] },
  { name: 'Individuals', icon: 'users', title: 'Find food shared in your community.', description: 'Request available donations and collect directly from the donor.', points: ['Explore donations available to individuals.', 'Send a request for the donor to review.', 'Arrange pickup after approval and confirm receipt.'] },
]
const steps: { icon: IconName; title: string; detail: string }[] = [
  { icon: 'box', title: 'Share what’s available', detail: 'Add food, portions, safety details, and a pickup window.' },
  { icon: 'users', title: 'Find the right recipient', detail: 'NGOs review matches. Individuals send requests for donor approval.' },
  { icon: 'location', title: 'Arrange a collection', detail: 'The accepted recipient coordinates pickup directly with the donor.' },
  { icon: 'check', title: 'Close the loop', detail: 'Confirm the handover and keep a record of the rescue.' },
]
function FoodIllustration() {
  return <div className="landing-art" role="img" aria-label="Illustration of surplus groceries becoming a shared meal">
    <svg viewBox="0 0 520 440" aria-hidden="true">
      <circle cx="269" cy="222" r="178" fill="#dcebc9" /><circle cx="269" cy="222" r="148" fill="none" stroke="#b5cca0" strokeDasharray="3 10" /><ellipse cx="270" cy="370" rx="132" ry="15" fill="#c3d4b1" />
      <g className="landing-groceries">
        <g transform="rotate(-18 214 200)"><rect x="184" y="61" width="57" height="200" rx="28" fill="#dfa85c" /><path d="m197 96 27 15m-27 22 27 15m-27 22 27 15" stroke="#fff0ce" strokeWidth="9" strokeLinecap="round" /></g>
        <path d="M290 220 326 89" stroke="#518654" strokeWidth="18" /><g fill="#397851"><circle cx="325" cy="87" r="31" /><circle cx="293" cy="102" r="29" /><circle cx="351" cy="111" r="33" /><circle cx="323" cy="122" r="34" /></g>
        <path d="m340 225 45-86q14-14 22 2l-25 101Z" fill="#ea9655" /><path d="m394 140 3-37m1 29 25-22" stroke="#3e7650" strokeWidth="9" strokeLinecap="round" />
        <circle cx="254" cy="187" r="35" fill="#c66445" /><path d="M253 151q0-25 26-24-4 23-26 24" fill="#356c42" />
        <path d="M150 207h233l-22 155H174Z" fill="#d9b17b" /><path d="M150 207h233l-15 25H163Z" fill="#edcca0" /><path d="m174 362 17-130h-28Z" fill="#c79b66" />
        <path d="M223 240v-30a43 43 0 0 1 86 0v30" fill="none" stroke="#906d43" strokeWidth="7" strokeLinecap="round" /><circle cx="266" cy="293" r="35" fill="#176b4d" /><path d="M282 274q-36-3-27 30 27 8 27-30Zm-33 39 24-28" fill="none" stroke="#e3efcd" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path className="landing-route" d="M111 134C31 194 71 316 135 320M393 302c79-10 93-104 46-135" fill="none" stroke="#568364" strokeWidth="2" strokeDasharray="6 7" /><path d="m124 310 13 11-16 5m310-148 7-13 13 10" fill="none" stroke="#568364" strokeWidth="2" strokeLinecap="round" />
      <g fill="#7c9a55"><path d="M116 79q-27-15-23 13 25 11 23-13" /><path d="M423 335q26-18 27 10-24 15-27-10" /></g>
    </svg>
    <span className="landing-art-label landing-art-label-top"><Icon name="box" /> Surplus worth sharing</span><span className="landing-art-label landing-art-label-bottom"><Icon name="check" /> A better destination.</span><span className="landing-art-caption">GOOD FOOD. NEW POSSIBILITIES.</span>
  </div>
}
export default function OverviewPage() {
  const [selectedRole, setSelectedRole] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const role = roles[selectedRole] ?? roles[0]!
  useEffect(() => {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('landing-entered'); observer.unobserve(entry.target) }
    }), { threshold: 0.12 })
    root.current?.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [])
  return <div id="overview" className="landing" ref={root}>
    <section className="landing-hero" aria-labelledby="welcome-heading"><div>
      <p className="landing-kicker">Less waste. More possibility.</p><h1 id="welcome-heading">Good food.<br />A better <em>next chapter.</em></h1>
      <p className="landing-intro">Connect surplus food with people who can use it. RescueBite brings donors, NGOs, and individual recipients together to make every portion count.</p>
      <div className="landing-actions"><Link className="landing-button" to="/register">Start sharing <Icon name="arrow" /></Link><a className="landing-text-link" href="#rescue-journey">See how it works <span aria-hidden="true">↓</span></a></div><p className="landing-hero-note">From a local kitchen to a community table.</p>
    </div><FoodIllustration /></section>
    <div className="landing-principles" aria-label="Our approach"><span><Icon name="leaf" /> Food with a purpose</span><span><Icon name="users" /> Community connections</span><span><Icon name="shield" /> Contact shared with care</span></div>
    <section className="landing-section" aria-labelledby="roles-heading" data-reveal>
      <div className="landing-section-heading"><div><p className="landing-kicker">A place for you</p><h2 id="roles-heading">One community.<br />Three ways to take part.</h2></div><p>Whether you have food to share or a community to support, start here.</p></div>
      <div className="landing-role-picker" role="group" aria-label="Choose how you participate">{roles.map((item, index) => <button key={item.name} type="button" aria-pressed={selectedRole === index} aria-controls="role-description" onClick={() => setSelectedRole(index)}><Icon name={item.icon} />{item.name}<Icon name="arrow" /></button>)}</div>
      <div className="landing-role-content" id="role-description" aria-live="polite"><div><span className="landing-role-icon"><Icon name={role.icon} width="30" height="30" /></span><h3>{role.title}</h3><p>{role.description}</p></div><div><ol>{role.points.map((point, index) => <li key={point}><span>0{index + 1}</span>{point}</li>)}</ol><Link to="/register" className="landing-text-link">Create your account <Icon name="arrow" /></Link></div></div>
    </section>
    <section id="rescue-journey" className="landing-journey landing-section" aria-labelledby="journey-heading" data-reveal><div className="landing-section-heading"><div><p className="landing-kicker">From surplus to shared</p><h2 id="journey-heading">A small action.<br />A complete journey.</h2></div><p>Clear steps from the first listing to the final handover.</p></div><ol className="landing-steps">{steps.map((step, index) => <li key={step.title}><div className="landing-step-top"><span><Icon name={step.icon} /></span><b>0{index + 1}</b></div><h3>{step.title}</h3><p>{step.detail}</p></li>)}</ol></section>
    <section className="landing-section landing-care" aria-labelledby="care-heading" data-reveal><div><p className="landing-kicker">Thoughtful by design</p><h2 id="care-heading">Good intentions.<br />Clear coordination.</h2><p>Know what’s available, who you’re collecting from, and when to arrive.</p><Link to="/food-safety" className="landing-text-link">Read our food safety guidance <Icon name="arrow" /></Link></div><div className="landing-care-list">
      <article><Icon name="clock" /><div><h3>Timing that matters</h3><p>Collection deadlines help recipients plan while food is still available.</p></div></article><article><Icon name="shield" /><div><h3>Contact with context</h3><p>Coordination details are shared with authorized participants, not published for everyone.</p></div></article><article><Icon name="check" /><div><h3>A handover you can follow</h3><p>Donation and collection updates keep everyone involved on the same page.</p></div></article>
    </div></section>
    <section className="landing-section landing-faq" aria-labelledby="questions-heading" data-reveal><div><p className="landing-kicker">Before you begin</p><h2 id="questions-heading">A few things to know.</h2><Link to="/faq" className="landing-text-link">More questions <Icon name="arrow" /></Link></div><div>
      <details><summary>Who can receive a donation?<Icon name="plus" /></summary><p>Donors can make food available to verified NGOs, individual recipients, or both. Individuals send a request for the donor to approve.</p></details><details><summary>Does RescueBite deliver the food?<Icon name="plus" /></summary><p>Recipients arrange collection directly with the donor after acceptance. Agree on the pickup time and location before travelling.</p></details><details><summary>Do I need to verify a phone number?<Icon name="plus" /></summary><p>No SMS verification is required. Sign in using email authentication; you can add a mobile number for authorized food coordination.</p></details>
    </div></section>
    <section className="landing-closing" aria-labelledby="closing-heading" data-reveal><Icon name="leaf" width="36" height="36" /><div><p className="landing-kicker">Make your next portion count</p><h2 id="closing-heading">The next rescue starts with you.</h2></div><div className="landing-actions"><Link to="/register" className="landing-button">Join RescueBite <Icon name="arrow" /></Link><Link to="/login" className="landing-text-link">Already a member? Sign in</Link></div></section>
  </div>
}
