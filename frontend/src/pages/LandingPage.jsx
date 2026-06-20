import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  HiCode, HiLightningBolt, HiUsers, HiShieldCheck,
  HiTerminal, HiCube, HiPlay, HiChevronRight,
  HiArrowRight, HiChip, HiDatabase, HiGlobe
} from 'react-icons/hi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import useScrollReveal from '../hooks/useScrollReveal';

/* ─── Features Data ─── */
const FEATURES = [
  {
    icon: HiCode,
    title: 'Monaco Editor',
    desc: 'Full VS Code editing engine with IntelliSense, multi-cursor, bracket matching, and syntax highlighting.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: HiUsers,
    title: 'Live Collaboration',
    desc: 'Real-time multi-user editing with presence awareness, cursors, and instant content synchronization.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: HiChip,
    title: 'Sandboxed Execution',
    desc: 'Run code in 10+ languages via isolated Judge0 containers. Get stdout, stderr, time, and memory metrics.',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    icon: HiShieldCheck,
    title: 'Workspace Security',
    desc: 'Row-Level Security on every table. Role-based access: owner, editor, viewer per workspace.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: HiCube,
    title: 'Virtual File System',
    desc: 'Nested folders, drag operations, rename, delete — a full directory tree persisted in the cloud.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: HiDatabase,
    title: 'Cloud Persistence',
    desc: 'Every edit auto-saves to Supabase. Resume your exact state from any device, any browser.',
    gradient: 'from-indigo-500 to-violet-500',
  },
];

/* ─── Languages Data ─── */
const LANGS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++',
  'Go', 'Rust', 'Ruby', 'C#', 'PHP', 'C',
];

/* ─── Code typing simulation ─── */
const DEMO_LINES = [
  { text: 'import { createServer } from "http";', cls: 'text-surface-300' },
  { text: '', cls: '' },
  { text: 'const server = createServer((req, res) => {', cls: 'text-surface-300' },
  { text: '  res.writeHead(200, { "Content-Type": "text/plain" });', cls: 'text-surface-400' },
  { text: '  res.end("Hello from DevSync! 🚀");', cls: 'text-emerald-400' },
  { text: '});', cls: 'text-surface-300' },
  { text: '', cls: '' },
  { text: 'server.listen(3000, () => {', cls: 'text-surface-300' },
  { text: '  console.log("Server running on port 3000");', cls: 'text-brand-300' },
  { text: '});', cls: 'text-surface-300' },
];

/* ─── Scroll Reveal Wrapper ─── */
function Reveal({ children, className = '', scale = false }) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`${scale ? 'reveal-scale' : 'reveal'} ${className}`}>
      {children}
    </div>
  );
}

/* ─── Animated Counter ─── */
function Counter({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const numTarget = parseInt(target) || 0;
          if (numTarget === 0) { setCount(target); return; }
          const duration = 1800;
          const start = performance.now();
          const animate = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            setCount(Math.floor(eased * numTarget));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Main Page ─── */
export default function LandingPage() {
  const heroRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [visibleLines, setVisibleLines] = useState(0);

  /* Mouse spotlight tracking on hero */
  const handleMouseMove = useCallback((e) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  /* Typing simulation */
  useEffect(() => {
    if (visibleLines >= DEMO_LINES.length) return;
    const timer = setTimeout(() => {
      setVisibleLines((v) => v + 1);
    }, 600 + Math.random() * 400);
    return () => clearTimeout(timer);
  }, [visibleLines]);

  /* Restart typing loop */
  useEffect(() => {
    if (visibleLines >= DEMO_LINES.length) {
      const resetTimer = setTimeout(() => setVisibleLines(0), 5000);
      return () => clearTimeout(resetTimer);
    }
  }, [visibleLines]);

  return (
    <div className="min-h-screen bg-surface-950 noise">
      <Navbar />

      {/* ════════════════════ HERO ════════════════════ */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
      >
        {/* Mesh gradient background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 dot-grid opacity-40" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[900px] rounded-full bg-brand-500/[0.07] blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[700px] h-[700px] rounded-full bg-accent-500/[0.05] blur-[100px]" />
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-brand-400/[0.04] blur-[80px] animate-float" />
        </div>

        {/* Mouse spotlight */}
        <div
          className="absolute pointer-events-none transition-opacity duration-300"
          style={{
            left: mousePos.x - 300,
            top: mousePos.y - 300,
            width: 600,
            height: 600,
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)',
            borderRadius: '50%',
            opacity: mousePos.x ? 1 : 0,
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center pt-24 pb-32">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-surface-300 mb-8 animate-fade-up" style={{ animationDelay: '200ms' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Now in Public Beta
            <HiChevronRight className="text-surface-500" size={12} />
          </div>

          {/* Headline */}
          <h1 className="font-display font-bold text-[clamp(2.5rem,7vw,5.5rem)] leading-[1.05] tracking-tight mb-8">
            <span className="block text-white animate-fade-up" style={{ animationDelay: '300ms' }}>
              Development,
            </span>
            <span className="block gradient-text-shimmer animate-fade-up" style={{ animationDelay: '500ms' }}>
              Synchronized.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-surface-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed mb-12 animate-fade-up opacity-0" style={{ animationDelay: '700ms' }}>
            A high-performance collaborative cloud IDE. Edit code simultaneously, execute in isolated sandboxes, and persist workspaces instantly — all directly in your browser.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up opacity-0" style={{ animationDelay: '900ms' }}>
            <Link to="/login">
              <button className="group relative px-8 py-4 rounded-2xl text-base font-semibold bg-white text-black hover:bg-surface-100 transition-all duration-300 active:scale-[0.97] shadow-2xl shadow-white/10 hover:shadow-white/20 flex items-center gap-2">
                Start Building
                <HiArrowRight className="group-hover:translate-x-1 transition-transform duration-300" size={18} />
              </button>
            </Link>
            <Link to="/login">
              <button className="px-8 py-4 rounded-2xl text-base font-medium border border-white/10 text-surface-300 hover:text-white hover:border-white/20 hover:bg-white/[0.03] transition-all duration-300 active:scale-[0.97]">
                Sign In
              </button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in opacity-0" style={{ animationDelay: '1400ms' }}>
          <span className="text-[10px] uppercase tracking-[0.2em] text-surface-600">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-surface-700 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-surface-500 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ════════════════════ LANGUAGE MARQUEE ════════════════════ */}
      <section className="py-12 border-y border-white/[0.04] overflow-hidden relative z-10">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-surface-600 mb-8">
          Supports 10+ programming languages
        </p>
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-surface-950 to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-surface-950 to-transparent z-10" />

          <div className="marquee-track animate-marquee">
            {[...LANGS, ...LANGS].map((lang, i) => (
              <div
                key={i}
                className="shrink-0 px-6 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-surface-400 font-medium hover:border-brand-500/20 hover:text-brand-300 hover:bg-brand-500/[0.04] transition-all duration-300 cursor-default whitespace-nowrap"
              >
                {lang}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ FEATURES GRID ════════════════════ */}
      <section className="py-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-20">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400 mb-4">Features</p>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-5">
                Everything you need to<br />
                <span className="gradient-text">build together</span>
              </h2>
              <p className="text-surface-400 max-w-lg mx-auto text-base">
                A complete development environment engineered for teams,
                students, and developers who want to collaborate in real-time.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat, i) => (
              <Reveal key={feat.title}>
                <div
                  className="card group relative overflow-hidden h-full"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  {/* Top edge shine on hover */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center mb-5 shadow-lg
                    group-hover:scale-110 group-hover:rotate-2 transition-all duration-500`}>
                    <feat.icon className="text-white text-lg" />
                  </div>

                  <h3 className="text-base font-semibold text-white mb-2.5 group-hover:text-brand-300 transition-colors duration-300">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-surface-500 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ LIVE EDITOR DEMO ════════════════════ */}
      <section className="py-32 relative z-10 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-brand-500/[0.04] blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400 mb-4">Live Preview</p>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-white mb-5">
                See it in <span className="gradient-text">action</span>
              </h2>
              <p className="text-surface-400 max-w-md mx-auto">
                Watch as two developers write code simultaneously with live syntax highlighting and shared execution.
              </p>
            </div>
          </Reveal>

          <Reveal scale>
            <div className="relative group">
              {/* Outer glow */}
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-500/20 via-accent-500/10 to-brand-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-700" />

              <div className="relative bg-surface-900 rounded-2xl border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/50">
                {/* Window chrome */}
                <div className="flex items-center justify-between px-5 py-3.5 bg-surface-900 border-b border-white/[0.06]">
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                      <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                      <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-surface-500 font-mono bg-surface-800 px-3 py-1 rounded-lg">
                      <HiTerminal className="text-brand-400" size={12} />
                      server.js
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Presence dots */}
                    <div className="flex items-center gap-1.5 text-[10px] text-surface-500 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      2 online
                    </div>
                    <div className="flex -space-x-1.5">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-cyan-500 flex items-center justify-center text-[9px] font-bold border-2 border-surface-900">A</div>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent-400 to-pink-500 flex items-center justify-center text-[9px] font-bold border-2 border-surface-900">B</div>
                    </div>
                  </div>
                </div>

                {/* Editor body */}
                <div className="flex">
                  {/* Mini file tree */}
                  <div className="hidden lg:block w-44 border-r border-white/[0.04] bg-surface-950/50 p-4 text-xs font-mono text-surface-600 space-y-2.5">
                    <div className="text-[10px] uppercase tracking-widest text-surface-500 font-semibold mb-3">Explorer</div>
                    <div className="flex items-center gap-2 text-brand-400"><HiCode size={12} /> server.js</div>
                    <div className="flex items-center gap-2 hover:text-surface-400 cursor-pointer transition-colors"><HiCube size={12} /> package.json</div>
                    <div className="flex items-center gap-2 hover:text-surface-400 cursor-pointer transition-colors"><HiDatabase size={12} /> schema.sql</div>
                    <div className="flex items-center gap-2 hover:text-surface-400 cursor-pointer transition-colors opacity-60"><HiGlobe size={12} /> .env</div>
                  </div>

                  {/* Code area */}
                  <div className="flex-1 p-6 font-mono text-[13px] leading-7 min-h-[320px] bg-surface-950/30">
                    {DEMO_LINES.slice(0, visibleLines).map((line, i) => (
                      <div key={i} className="flex">
                        <span className="w-8 text-right mr-6 text-surface-700 text-xs select-none">{i + 1}</span>
                        <span className={line.cls}>
                          {line.text
                            .replace(/(import|from|const|let)/g, '<kw>')
                            .split('<kw>')
                            .map((part, pi) => {
                              if (['import', 'from', 'const', 'let'].some((k) => line.text.includes(k) && pi > 0)) {
                                return part;
                              }
                              return part;
                            })
                          }
                          {/* Show cursor on last visible line */}
                          {i === visibleLines - 1 && visibleLines < DEMO_LINES.length && (
                            <span className="typing-cursor text-brand-400" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terminal output */}
                <div className="border-t border-white/[0.04] bg-surface-950/60 p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 text-surface-600 mb-2">
                    <HiTerminal size={12} />
                    <span className="text-[10px] uppercase tracking-widest">Terminal</span>
                  </div>
                  {visibleLines >= DEMO_LINES.length ? (
                    <div className="animate-fade-in">
                      <div className="text-emerald-400">node server.js</div>
                      <div className="text-surface-400 mt-1">Server running on port 3000</div>
                      <div className="text-brand-300 mt-0.5">✓ Compiled successfully in 0.24s</div>
                    </div>
                  ) : (
                    <div className="text-surface-700 italic">Waiting for code...</div>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════ STATS ════════════════════ */}
      <section className="py-24 border-y border-white/[0.04] relative z-10">
        <div className="max-w-5xl mx-auto px-4">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '10', suffix: '+', label: 'Languages' },
                { value: '100', suffix: 'ms', label: 'Sync Latency' },
                { value: '∞', suffix: '', label: 'Workspaces' },
                { value: 'Free', suffix: '', label: 'Cost', extra: 'Free forever' },
              ].map((stat) => (
                <div key={stat.label} className="group cursor-default">
                  <p className="text-4xl sm:text-5xl font-display font-bold gradient-text mb-2 group-hover:scale-105 transition-transform duration-300">
                    {stat.value === '∞' ? '∞' : stat.value === 'Free' ? 'Free' : (
                      <Counter target={stat.value} suffix={stat.suffix} />
                    )}
                    {stat.value !== '∞' && stat.value !== 'Free' && stat.suffix && (
                      <span className="text-2xl sm:text-3xl">{stat.suffix === 'ms' ? 'ms' : stat.suffix}</span>
                    )}
                  </p>
                  <p className="text-xs font-medium text-surface-500 uppercase tracking-widest">{stat.extra || stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════ FINAL CTA ════════════════════ */}
      <section className="py-32 relative z-10 overflow-hidden">
        {/* Background radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-brand-500/[0.06] blur-[120px] pointer-events-none" />

        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <Reveal>
            <h2 className="font-display text-4xl sm:text-6xl font-bold text-white mb-6 tracking-tight">
              Ready to build<br />
              <span className="gradient-text">something great?</span>
            </h2>
            <p className="text-surface-400 mb-10 max-w-md mx-auto">
              Create your first workspace in seconds. Invite your team. Start shipping code together.
            </p>
            <Link to="/login">
              <button className="group relative px-10 py-5 rounded-2xl text-base font-semibold bg-white text-black hover:bg-surface-100 transition-all duration-300 active:scale-[0.97] shadow-2xl shadow-white/10 hover:shadow-white/20">
                Get Started — It's Free
                <span className="absolute inset-0 rounded-2xl animate-glow pointer-events-none" />
              </button>
            </Link>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
