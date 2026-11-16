import { getLanguage } from '../../lib/languages';

export default function LangDot({ language, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`lang-dot ${className}`}
      style={{ backgroundColor: getLanguage(language).color }}
    />
  );
}
