import { Link } from 'react-router-dom';
import { HiCode, HiLightningBolt, HiUsers, HiGlobe, HiShieldCheck, HiTerminal, HiCube, HiPlay } from 'react-icons/hi';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Button from '../components/ui/Button';

const FEATURES = [
  {
    icon: HiCode,
    title: 'Monaco Editor',
    desc: 'Full VSCode editing experience with IntelliSense, syntax highlighting, and bracket matching for 10+ languages.',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    icon: HiUsers,
    title: 'Real-Time Collaboration',
    desc: 'Edit code together in real-time. See who is online, what they are editing, and sync changes instantly.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: HiLightningBolt,
    title: 'Instant Execution',
    desc: 'Run code in 10+ languages with sandboxed execution via Judge0. Get output, errors, and performance metrics.',
    gradient: 'from-yellow-500 to-orange-500',
  },
  {
    icon: HiShieldCheck,
    title: 'Secure Workspaces',
    desc: 'Create private workspaces with role-based access control. Invite collaborators as editors or viewers.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: HiCube,
    title: 'File Management',
    desc: 'Full file system with folders, create, rename, and delete. Organized project structure in the cloud.',
    gradient: 'from-red-500 to-rose-500',
  },
  {
    icon: HiGlobe,
    title: 'Cloud Powered',
    desc: 'Access your projects from anywhere. Auto-save, persistent storage, and seamless sync across devices.',
    gradient: 'from-indigo-500 to-violet-500',
  },
];

const LANGUAGES_SHOWCASE = [
  { name: 'JavaScript', icon: '🟨' },
  { name: 'TypeScript', icon: '🔷' },
  { name: 'Python', icon: '🐍' },
  { name: 'Java', icon: '☕' },
  { name: 'C++', icon: '⚡' },
  { name: 'Go', icon: '🐹' },
  { name: 'Rust', icon: '🦀' },
  { name: 'C#', icon: '🎯' },
  { name: 'Ruby', icon: '💎' },
  { name: 'PHP', icon: '🐘' },
];

const CODE_PREVIEW = `// DevSync — Real-Time Collaborative IDE
import { createWorkspace } from '@devsync/core';

const workspace = createWorkspace({
  name: 'My Project',
  language: 'javascript',
  collaborators: ['alice', 'bob'],
});

workspace.onSync((changes) => {
  editor.applyChanges(changes);
  console.log('✨ Changes synced!');
});

workspace.run('main.js');
// → Output: Hello, World! 🚀`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow animate-delay-500" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Now in Public Beta
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 animate-slide-up">
              <span className="text-white">Code Together,</span>
              <br />
              <span className="gradient-text">Build Together</span>
            </h1>

            <p className="text-lg sm:text-xl text-surface-400 max-w-2xl mx-auto mb-10 animate-slide-up animate-delay-100 leading-relaxed">
              A developer-centric real-time collaborative cloud IDE. Write, execute, and manage
              code together inside shared workspaces — all from your browser.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up animate-delay-200">
              <Link to="/register">
                <Button size="lg" className="text-base px-10">
                  <HiPlay size={20} />
                  Start Coding Free
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" size="lg" className="text-base px-10">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Code Preview */}
          <div className="max-w-3xl mx-auto animate-slide-up animate-delay-300">
            <div className="gradient-border">
              <div className="bg-surface-900 rounded-xl overflow-hidden shadow-2xl shadow-brand-500/10">
                {/* Window controls */}
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-800/50 border-b border-surface-800">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <span className="text-xs text-surface-500 bg-surface-800 px-3 py-0.5 rounded-md">
                      main.js — DevSync IDE
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400">2 online</span>
                  </div>
                </div>

                {/* Code */}
                <pre className="p-6 text-sm code-font overflow-x-auto">
                  <code className="text-surface-300 leading-relaxed">
                    {CODE_PREVIEW.split('\n').map((line, i) => (
                      <div key={i} className="flex">
                        <span className="text-surface-700 select-none w-8 text-right mr-4 text-xs leading-6">{i + 1}</span>
                        <span
                          className="leading-6"
                          dangerouslySetInnerHTML={{
                            __html: line
                              .replace(/(\/\/.*)/g, '<span class="text-surface-600">$1</span>')
                              .replace(/('.*?')/g, '<span class="text-emerald-300">$1</span>')
                              .replace(/(import|from|const|export|default)/g, '<span class="text-purple-400">$1</span>')
                              .replace(/(\{|\}|\(|\))/g, '<span class="text-surface-500">$1</span>')
                              .replace(/(=&gt;|=>)/g, '<span class="text-brand-400">$1</span>'),
                          }}
                        />
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Language Bar */}
      <section className="py-12 border-y border-surface-800/50">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-surface-500 mb-6">Supports 10+ programming languages</p>
          <div className="flex flex-wrap justify-center gap-3">
            {LANGUAGES_SHOWCASE.map((lang) => (
              <div
                key={lang.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-900/50 border border-surface-800
                  hover:border-surface-700 hover:bg-surface-800/50 transition-all text-sm text-surface-400 cursor-default"
              >
                <span>{lang.icon}</span>
                {lang.name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything you need to <span className="gradient-text">collaborate</span>
            </h2>
            <p className="text-surface-400 max-w-xl mx-auto">
              A complete development environment designed for teams, students, and developers who want to code together.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="card group hover:scale-[1.02] hover:shadow-xl"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center
                  mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="text-white text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-surface-800/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10+', label: 'Languages' },
              { value: '<250ms', label: 'Sync Latency' },
              { value: '∞', label: 'Workspaces' },
              { value: '100%', label: 'Free to Use' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl font-bold gradient-text mb-1">{stat.value}</p>
                <p className="text-sm text-surface-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to start coding together?
          </h2>
          <p className="text-surface-400 mb-8 max-w-lg mx-auto">
            Join DevSync today and experience the future of collaborative development. Free forever.
          </p>
          <Link to="/register">
            <Button size="lg" className="text-base px-12 animate-glow">
              Get Started — It's Free
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
