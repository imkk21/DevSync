import { HiDocumentText, HiFolder } from 'react-icons/hi';

export default function Sidebar({ children }) {
  return (
    <aside className="w-60 bg-surface-950 border-r border-surface-800 flex flex-col h-full">
      {children}
    </aside>
  );
}
