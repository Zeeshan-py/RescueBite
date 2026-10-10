import type { SVGProps } from 'react'

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  chart: 'M4 4v16h17 M8 15l4-5 4 3 5-8',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10 M7.5 5l9 4',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  building: 'M4 21V5l8-3 8 3v16 M2 21h20 M9 21v-5h6v5 M8 7h1 M15 7h1 M8 11h1 M15 11h1',
  truck: 'M1 4h13v13H1z M14 9h4l4 4v4h-8 M8 17a3 3 0 1 1-6 0 M21 17a3 3 0 1 1-6 0',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  leaf: 'M20 3C9 2 3 7 6 15c8 4 14-2 14-12Z M3 21l12-12',
  check: 'M20 6 9 17l-5-5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5.1 8a7 7 0 0 1 11.6-3L20 8 M4 16l3.3 3a7 7 0 0 0 11.6-3',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  calendar: 'M4 5h16v16H4z M16 3v4 M8 3v4 M4 11h16',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  plus: 'M12 5v14 M5 12h14',
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  close: 'M6 6l12 12 M6 18 18 6',
  logout: 'M9 4H4v16h5 M13 8l4 4-4 4 M8 12h13',
  activity: 'M2 12h5l3-8 4 16 3-8h5',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0 M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6',
} as const
export type IconName = keyof typeof paths
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>
}
