import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#how-it-works', label: 'How it works' },
      { href: '#languages', label: 'Languages' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/login', label: 'Sign in' },
      { to: '/dashboard', label: 'Dashboard' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-body-sm text-ink-muted">
              A real-time collaborative cloud IDE. Write, run and ship code together, right in your browser.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-label-md text-ink">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.to ? (
                        <Link to={l.to} className="text-body-sm text-ink-muted transition-colors hover:text-ink">{l.label}</Link>
                      ) : (
                        <a href={l.href} className="text-body-sm text-ink-muted transition-colors hover:text-ink">{l.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-body-sm text-ink-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} DevSync</p>
          <p>Built by Kunal Kumar</p>
        </div>
      </div>
    </footer>
  );
}
