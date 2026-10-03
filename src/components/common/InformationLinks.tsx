import { Link } from 'react-router-dom'

const informationLinks = [
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/food-safety', label: 'Food safety' },
  { to: '/contact', label: 'Contact' },
  { to: '/terms', label: 'Terms of Use' },
  { to: '/privacy', label: 'Privacy Policy' },
]

export function InformationLinks() {
  return <nav aria-label="Information and policies" className="flex flex-wrap gap-x-4 gap-y-2">
    {informationLinks.map(({ to, label }) => <Link key={to} to={to} className="underline-offset-4 hover:text-forest hover:underline">{label}</Link>)}
  </nav>
}
