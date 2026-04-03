import { HiCode } from 'react-icons/hi';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-surface-800/50 bg-surface-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <HiCode className="text-white text-lg" />
              </div>
              <span className="text-xl font-bold gradient-text">DevSync</span>
            </Link>
            <p className="text-surface-400 text-sm max-w-md leading-relaxed">
              A developer-centric real-time collaborative cloud IDE. Write, execute, and manage code
              together in a shared workspace environment.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-2">
              {['Features', 'Pricing', 'Documentation', 'Changelog'].map((item) => (
                <li key={item}>
                  <span className="text-sm text-surface-400 hover:text-brand-400 transition-colors cursor-pointer">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Connect</h3>
            <ul className="space-y-2">
              {['GitHub', 'Discord', 'Twitter', 'Email'].map((item) => (
                <li key={item}>
                  <span className="text-sm text-surface-400 hover:text-brand-400 transition-colors cursor-pointer">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-surface-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500">
            © {new Date().getFullYear()} DevSync. Built by Kunal Kumar.
          </p>
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <span className="hover:text-surface-300 cursor-pointer">Privacy</span>
            <span className="hover:text-surface-300 cursor-pointer">Terms</span>
            <span className="hover:text-surface-300 cursor-pointer">Cookies</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
