import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GoArrowRight, GoCheckCircle, GoCode, GoFileDirectoryFill, GoPeople, GoPlay, GoShieldCheck, GoSync, GoZap,
} from 'react-icons/go';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Avatar, { toneFor } from '../components/ui/Avatar';
import LangDot from '../components/ui/LangDot';
import { LogoMark } from '../components/ui/Logo';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import useScrollReveal from '../hooks/useScrollReveal';
import { LANGUAGES } from '../lib/languages';
import { SYNTAX } from '../lib/monacoTheme';

const FEATURES = [
  { icon: GoSync, title: 'Real-time editing', text: 'Every change reaches everyone in the workspace as you type, so the whole team works on the same code.' },
  { icon: GoPlay, title: 'Run code in the browser', text: 'Execute programs in an isolated sandbox and get output, errors, run time and memory in seconds.' },
  { icon: GoCode, title: 'A real code editor', text: 'Monaco, the engine behind VS Code: syntax highlighting, multi-cursor editing and smart suggestions.' },
  { icon: GoPeople, title: 'Share with roles', text: 'Invite teammates by email as editors, or as viewers who can read and run code but not change it.' },
  { icon: GoZap, title: 'Saved automatically', text: 'Files save to the cloud while you work. Close the tab and pick up exactly where you left off.' },
  { icon: GoShieldCheck, title: 'Private by default', text: 'Every workspace is isolated with row-level security. Only its members can see or change its files.' },
];

const STEPS = [
  { title: 'Create a workspace', text: 'Name it and pick a language. DevSync sets up a starter file so you can run something right away.' },
  { title: 'Invite your team', text: 'Add collaborators by email and decide who can edit and who can only view.' },
  { title: 'Code and run together', text: 'Edit the same files live, run them in the sandbox and see the results instantly.' },
];

function Reveal({ as: Tag = 'div', delay = 0, className = '', children }) {
  const ref = useScrollReveal();
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </Tag>
  );
}

/* ── Product preview ─────────────────────────────────────────── */

// Token kinds map onto the real editor's palette (SYNTAX), so the preview is honest in both themes
const [kw, id, str, num, pn] = ['keyword', 'text', 'string', 'number', 'punctuation'];
const CODE = [
  [['import', kw], [' express ', id], ['from', kw], [" 'express'", str], [';', pn]],
  [['import', kw], [' { rooms } ', id], ['from', kw], [" './rooms.js'", str], [';', pn]],
  [],
  [['const', kw], [' app ', id], ['=', pn], [' express', id], ['();', pn]],
  [],
  [['app', id], ['.', pn], ['get', id], ['(', pn], ["'/rooms/:id'", str], [', (', pn], ['req, res', id], [') ', pn], ['=>', kw], [' {', pn]],
  [['  ', id], ['const', kw], [' room ', id], ['=', pn], [' rooms', id], ['.', pn], ['get', id], ['(', pn], ['req.params.id', id], [');', pn]],
  'TYPING',
  [['  res', id], ['.', pn], ['json', id], ['({ room, online: room.members.length });', id]],
  [['});', pn]],
  [],
  [['app', id], ['.', pn], ['listen', id], ['(', pn], ['3000', num], [');', pn]],
];
const TYPED = '  // TODO: cache rooms for 30s';
const MAYA = toneFor('maya')[1];

function useTypewriter(text) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(text.length);
      return;
    }
    const done = count >= text.length;
    const timer = setTimeout(() => setCount(done ? 2 : count + 1), done ? 2600 : 55 + Math.random() * 70);
    return () => clearTimeout(timer);
  }, [count, text]);
  return text.slice(0, count);
}

// Collaborator caret with a name tag beside it, on its own line so it never hides code
function RemoteCursor({ name, color }) {
  return (
    <span className="relative inline-block h-[22px] w-0 align-top">
      <span className="absolute left-0 top-[2px] h-[18px] w-0.5" style={{ backgroundColor: color }} />
      <span
        className="absolute left-1.5 top-[3px] whitespace-nowrap rounded-sm px-1 font-sans text-[10px] font-semibold not-italic leading-4 text-canvas"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </span>
  );
}

function EditorPreview() {
  const typed = useTypewriter(TYPED);
  const palette = SYNTAX[useThemeStore((s) => s.resolved)];
  const files = [
    { name: 'src', folder: true },
    { name: 'server.js', lang: 'javascript', depth: 1, active: true },
    { name: 'rooms.js', lang: 'javascript', depth: 1 },
    { name: 'package.json', lang: 'json' },
    { name: 'README.md', lang: 'markdown' },
  ];

  return (
    <div
      role="img"
      aria-label="The DevSync editor: two people editing server.js together, with the program's output underneath"
      className="overflow-hidden rounded-xl border border-line bg-canvas text-left"
    >
      {/* Top bar */}
      <div className="flex h-11 items-center gap-3 border-b border-line px-3 sm:px-4">
        <LogoMark size={20} />
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <span className="font-semibold text-ink">team-api</span>
          <span className="text-ink-subtle">/</span>
          <span className="truncate text-ink-muted">src/server.js</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex -space-x-1.5">
            <Avatar name="Maya Chen" id="maya" size={24} ring />
            <Avatar name="Alex Rivera" id="alex" size={24} ring />
          </div>
          <span className="hidden text-label-sm text-ink-muted sm:inline">2 online</span>
          <span className="btn btn-primary pointer-events-none h-7 gap-1.5 px-2.5 text-[13px]">
            <GoPlay size={12} /> Run
          </span>
        </div>
      </div>

      <div className="flex">
        {/* File tree */}
        <div className="hidden w-48 shrink-0 border-r border-line bg-canvas-subtle px-2 py-2.5 md:block">
          <p className="px-2 pb-2 text-label-sm text-ink-muted">Files</p>
          {files.map((f) => (
            <div
              key={f.name}
              className={`relative flex h-7 items-center gap-2 rounded-md pr-2 text-[13px] ${
                f.active ? 'bg-brand-soft font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-brand' : 'text-ink-muted'
              }`}
              style={{ paddingLeft: 10 + (f.depth || 0) * 14 }}
            >
              {f.folder ? (
                <GoFileDirectoryFill size={14} className="text-[#8C959F]" aria-hidden="true" />
              ) : (
                <LangDot language={f.lang} />
              )}
              {f.name}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {/* Tabs */}
          <div className="flex h-9 bg-canvas-subtle text-[13px]">
            <div className="relative flex items-center gap-2 border-r border-line bg-canvas px-3 text-ink before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-brand">
              <LangDot language="javascript" /> server.js
            </div>
            <div className="flex items-center gap-2 border-b border-r border-line px-3 text-ink-muted">
              <LangDot language="javascript" /> rooms.js
            </div>
            <div className="flex-1 border-b border-line" />
          </div>

          {/* Code */}
          <div className="overflow-hidden py-3 font-mono text-[12px] leading-[22px] sm:text-[13px]">
            {CODE.map((line, i) => {
              const typing = line === 'TYPING';
              return (
                <div key={i} className={`flex whitespace-pre pr-4 ${typing ? 'bg-canvas-subtle' : ''}`}>
                  <span className={`w-10 shrink-0 select-none pr-4 text-right sm:w-12 ${typing ? 'text-ink' : 'text-ink-subtle'}`}>{i + 1}</span>
                  {typing ? (
                    <span style={{ color: palette.comment }} className="italic">
                      {typed}
                      <RemoteCursor name="Maya" color={MAYA} />
                    </span>
                  ) : (
                    line.map(([text, kind], j) => (
                      <span key={j} style={{ color: palette[kind] }}>{text}</span>
                    ))
                  )}
                  {i === CODE.length - 1 && <span className="ml-px inline-block h-[18px] w-0.5 translate-y-[2px] animate-blink bg-brand" />}
                </div>
              );
            })}
          </div>

          {/* Output */}
          <div className="border-t border-line">
            <div className="flex h-9 items-center gap-3 border-b border-line px-3 text-[13px]">
              <span className="relative flex h-full items-center px-1 font-medium text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand">
                Output
              </span>
              <span className="text-ink-muted">Input</span>
              <span className="badge ml-auto border-brand/25 bg-brand-soft text-brand-fg">
                <GoCheckCircle size={12} /> Accepted
              </span>
              <span className="hidden font-mono text-code-sm text-ink-muted sm:inline">0.04s</span>
            </div>
            <div className="px-4 py-3 font-mono text-[12px] leading-[20px] sm:text-[13px]">
              <div className="text-ink-subtle">$ node src/server.js</div>
              <div className="text-ink">Listening on http://localhost:3000</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { user } = useAuthStore();
  const start = user ? { to: '/dashboard', label: 'Open your workspaces' } : { to: '/login', label: 'Start building' };

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:px-8 lg:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="chip animate-fade-up">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
              Real-time collaborative cloud IDE
            </p>
            <h1 className="mt-6 animate-fade-up text-display text-ink [animation-delay:60ms]">
              Development, synchronized<span className="text-brand">.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl animate-fade-up text-body-lg text-ink-muted [animation-delay:120ms]">
              Open a shared workspace, edit the same files live with your team, and run code in {LANGUAGES.length} languages.
              All in the browser, with nothing to install.
            </p>
            <div className="mt-9 flex animate-fade-up flex-col items-stretch justify-center gap-3 [animation-delay:180ms] sm:flex-row sm:items-center">
              <Link to={start.to} className="btn btn-lg btn-primary sm:min-w-[220px]">
                {start.label} <GoArrowRight size={18} />
              </Link>
              <a href="#features" className="btn btn-lg btn-secondary sm:min-w-[220px]">
                See how it works
              </a>
            </div>
            {!user && (
              <p className="mt-4 animate-fade-up text-body-sm text-ink-subtle [animation-delay:220ms]">
                Free to use. Sign in with Google or GitHub.
              </p>
            )}
          </div>

          <div className="mx-auto mt-14 max-w-5xl animate-fade-up [animation-delay:280ms] sm:mt-16">
            <EditorPreview />
          </div>
        </section>

        {/* Languages */}
        <section id="languages" className="border-y border-line bg-canvas-subtle">
          <Reveal className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-center text-label-lg text-ink">Run code in {LANGUAGES.length} languages</h2>
            <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
              {LANGUAGES.map((lang) => (
                <li key={lang.id} className="chip">
                  <LangDot language={lang.id} /> {lang.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-headline-lg text-ink">Everything your team needs to code together</h2>
            <p className="mt-4 text-body-lg text-ink-muted">
              A complete development environment for teams, classrooms and pair programming. No setup, no syncing files around.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal key={title} delay={(i % 3) * 80}>
                <div className="card h-full p-6 transition-colors hover:border-line-strong">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand-fg">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-label-lg font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-body-sm text-ink-muted">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="border-t border-line bg-canvas-subtle">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-32">
            <Reveal className="mx-auto max-w-2xl text-center">
              <h2 className="text-headline-lg text-ink">From zero to coding together in a minute</h2>
              <p className="mt-4 text-body-lg text-ink-muted">Three steps, no downloads.</p>
            </Reveal>
            <ol className="mt-14 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <Reveal as="li" key={step.title} delay={i * 80} className="card p-6">
                  <span className="font-mono text-code-sm text-brand-fg">0{i + 1}</span>
                  <h3 className="mt-3 text-label-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-body-sm text-ink-muted">{step.text}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Final call to action */}
        <section className="border-t border-line">
          <Reveal className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:py-32">
            <h2 className="text-headline-lg text-ink">Ready to build together?</h2>
            <p className="mx-auto mt-4 max-w-xl text-body-lg text-ink-muted">
              Create your first workspace in seconds, invite your team and start shipping code.
            </p>
            <Link to={start.to} className="btn btn-lg btn-primary mt-9 w-full sm:w-auto sm:min-w-[272px]">
              {user ? 'Open your workspaces' : 'Get started'} <GoArrowRight size={18} />
            </Link>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
