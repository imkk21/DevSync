import { HiCode } from 'react-icons/hi';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] bg-surface-950 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-5 group">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center
                group-hover:shadow-lg group-hover:shadow-brand-500/20 transition-all duration-500">
                <HiCode className="text-white text-sm" />
              </div>
              <span className="text-lg font-bold font-display gradient-text">DevSync</span>
            </Link>
            <p className="text-surface-500 text-sm max-w-sm leading-relaxed">
              A developer-centric real-time collaborative cloud IDE. Write, execute, and manage code together in shared workspaces.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-xs font-semibold text-surface-300 uppercase tracking-widest mb-5">Product</h3>
            <ul className="space-y-3">
              {['Features', 'Pricing', 'Documentation', 'Changelog'].map((item) => (
                <li key={item}>
                  <span className="text-sm text-surface-500 hover:text-brand-400 transition-colors duration-300 cursor-pointer">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-surface-300 uppercase tracking-widest mb-5">Connect</h3>
            <ul className="space-y-3">
              {['GitHub', 'Discord', 'Twitter', 'Email'].map((item) => (
                <li key={item}>
                  <span className="text-sm text-surface-500 hover:text-brand-400 transition-colors duration-300 cursor-pointer">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-surface-600">
            © {new Date().getFullYear()} DevSync. Built by Kunal Kumar.
          </p>
          <div className="flex items-center gap-6 text-xs text-surface-600">
            <span className="hover:text-surface-400 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-surface-400 cursor-pointer transition-colors">Terms</span>
            <span className="hover:text-surface-400 cursor-pointer transition-colors">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
