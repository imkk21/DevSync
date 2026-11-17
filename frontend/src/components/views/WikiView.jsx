import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { GoBook, GoPencil, GoPlus, GoSearch } from 'react-icons/go';
import useEditorStore from '../../store/editorStore';
import useThemeStore from '../../store/themeStore';
import { resolvePath } from '../../lib/workspaceFiles';
import { inlineMermaid } from '../../lib/diagrams';
import { languageForFile } from '../../lib/languages';
import { timeAgo } from '../workspace/WorkspaceCard';
import { toast } from '../../store/toastStore';
import Button from '../ui/Button';

const titleOf = (f) => f.name.replace(/\.md$/i, '');
const esc = (s) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// [[Page]] and [[Page|label]] become links between pages
const wikiLinks = (md) => md.replace(/\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g, (_, page, label) => `<a href="#" data-wiki="${esc(page.trim())}">${esc((label || page).trim())}</a>`);
const linksTo = (text, page) => {
  const t = titleOf(page).toLowerCase();
  return new RegExp(`\\[\\[\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\|[^\\]]*)?\\]\\]`, 'i').test(text) || text.includes(`(${page.path.slice(1)})`) || text.includes(`(./${page.name})`);
};

// Every Markdown file in the workspace, read as a wiki
export default function WikiView({ workspaceId, userId, readOnly, onEdit }) {
  const files = useEditorStore((s) => s.files);
  const contentOf = useEditorStore((s) => s.contentOf);
  const createFile = useEditorStore((s) => s.createFile);
  const theme = useThemeStore((s) => s.resolved);
  const pages = useMemo(() => files.filter((f) => !f.is_folder && languageForFile(f.name) === 'markdown').sort((a, b) => a.path.localeCompare(b.path)), [files]);
  const [pageId, setPageId] = useState(null);
  const [query, setQuery] = useState('');
  const [html, setHtml] = useState('');
  const [newName, setNewName] = useState(null);
  const page = pages.find((p) => p.id === pageId) || pages.find((p) => /^readme\.md$/i.test(p.name)) || pages[0];
  const text = page ? contentOf(page.id) : '';

  useEffect(() => {
    let alive = true;
    if (!page) return;
    (async () => {
      const { marked } = await import('marked');
      const withDiagrams = await inlineMermaid(wikiLinks(text), theme);
      if (alive) setHtml(DOMPurify.sanitize(marked.parse(withDiagrams), { ADD_ATTR: ['data-wiki', 'target'] }));
    })();
    return () => { alive = false; };
  }, [text, page?.id, theme]);

  const open = (title) => pages.find((p) => titleOf(p).toLowerCase() === title.toLowerCase());
  const create = async (name) => {
    const clean = name.trim().replace(/[\\/]/g, '-');
    if (!clean) return;
    const existing = open(clean);
    if (existing) return setPageId(existing.id);
    const { data, error } = await createFile(workspaceId, `${clean}.md`, null, false, userId, `# ${clean}\n\n`);
    if (error) return toast(error.message, { tone: 'error' });
    setPageId(data.id);
    toast(`Created ${clean}. Use Edit to write it.`, { tone: 'success' });
  };

  const onClick = (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const wiki = a.getAttribute('data-wiki');
    const href = a.getAttribute('href') || '';
    if (wiki) {
      e.preventDefault();
      const target = open(wiki);
      if (target) setPageId(target.id);
      else if (!readOnly) create(wiki);
      else toast(`There's no page called ${wiki} yet`);
    } else if (/\.md(#.*)?$/i.test(href) && !/^[a-z]+:/i.test(href)) {
      e.preventDefault();
      const path = resolvePath(page.path, href);
      const target = pages.find((p) => p.path === path);
      if (target) setPageId(target.id);
    } else if (/^https?:/i.test(href)) {
      e.preventDefault();
      window.open(href, '_blank', 'noopener');
    }
  };

  const q = query.trim().toLowerCase();
  const listed = q ? pages.filter((p) => titleOf(p).toLowerCase().includes(q) || contentOf(p.id).toLowerCase().includes(q)) : pages;
  const backlinks = page ? pages.filter((p) => p.id !== page.id && linksTo(contentOf(p.id), page)) : [];

  return (
    <div className="flex h-full min-h-0">
      <nav aria-label="Wiki pages" className="flex w-60 shrink-0 flex-col border-r border-line bg-canvas-subtle">
        <div className="space-y-2 border-b border-line p-3">
          <div className="relative">
            <GoSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-subtle" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages" aria-label="Search pages" className="input h-8 pl-8" />
          </div>
          {!readOnly && (newName === null ? (
            <Button size="sm" variant="secondary" className="w-full" onClick={() => setNewName('')}><GoPlus size={14} /> New page</Button>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); create(newName); setNewName(null); }}>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => setNewName(null)} placeholder="Page name" aria-label="New page name" className="input h-8" />
            </form>
          ))}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {listed.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setPageId(p.id)}
                aria-current={p.id === page?.id || undefined}
                className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-body-sm ${p.id === page?.id ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted hover:bg-canvas-muted hover:text-ink'}`}
                title={p.path}
              >
                <GoBook size={13} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{titleOf(p)}</span>
              </button>
            </li>
          ))}
          {listed.length === 0 && <li className="px-2 py-4 text-body-sm text-ink-muted">{pages.length ? 'No pages match.' : 'No pages yet.'}</li>}
        </ul>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">
        {!page ? (
          <div className="mx-auto max-w-md px-6 py-20 text-center">
            <GoBook size={24} className="mx-auto text-ink-subtle" aria-hidden="true" />
            <h2 className="mt-4 text-headline-sm font-semibold text-ink">Start your wiki</h2>
            <p className="mt-2 text-body-sm text-ink-muted">Any Markdown file in this workspace is a wiki page. Link pages with [[Page name]].</p>
            {!readOnly && <Button className="mt-6" onClick={() => create('Home')}><GoPlus size={14} /> Create the Home page</Button>}
          </div>
        ) : (
          <article className="mx-auto max-w-3xl px-6 py-8">
            <div className="mb-6 flex items-center gap-3 border-b border-line pb-4">
              <span className="truncate font-mono text-code-sm text-ink-subtle">{page.path.slice(1)}</span>
              <span className="text-label-sm text-ink-subtle">· Updated {timeAgo(page.updated_at || page.created_at)}</span>
              {!readOnly && <Button size="sm" variant="secondary" className="ml-auto" onClick={() => onEdit(page)}><GoPencil size={14} /> Edit</Button>}
            </div>
            <div className="wiki-prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
            {backlinks.length > 0 && (
              <footer className="mt-10 border-t border-line pt-4">
                <h3 className="text-label-md text-ink-muted">Linked from</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {backlinks.map((p) => (
                    <li key={p.id}><button type="button" onClick={() => setPageId(p.id)} className="chip hover:border-line-strong">{titleOf(p)}</button></li>
                  ))}
                </ul>
              </footer>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
