# DevSync – Real-Time Collaborative Cloud IDE

A developer-centric real-time collaborative cloud-based development platform. Write, execute, and manage code together inside shared workspaces.

## Tech Stack

### Frontend
- **React 18** + Vite 5
- **TailwindCSS v3** – Utility-first CSS
- **Monaco Editor** – VS Code editing engine
- **Zustand** – Lightweight state management
- **React Router v6** – Client-side routing

### Backend
- **Express.js** – REST API
- **Supabase** – Auth, PostgreSQL, Realtime, Storage
- **Judge0 API** – Sandboxed code execution (10+ languages)

## Getting Started

### Prerequisites
- Node.js >= 18
- A [Supabase](https://supabase.com) project (free tier)
- A [Judge0 API key](https://rapidapi.com/judge0-official/api/judge0-ce) from RapidAPI (free tier)

### 1. Clone & Install

```bash
git clone <repo-url>
cd DevSync

# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migrations in order:
   - Copy contents of `supabase/migrations/001_initial_schema.sql` and run it.
   - Copy contents of `supabase/migrations/002_fix_rls_recursion.sql` and run it.
   - Copy contents of `supabase/migrations/004_security_fixes.sql` and run it.
3. Go to **Authentication > Providers** and configure:
   - **Google**: Add your Client ID & Secret from Google Cloud Console.
   - **GitHub**: Add your Client ID & Secret from GitHub Developer Settings.
4. Go to **Settings > API** and copy your:
   - Project URL
   - `anon` public key
   - `service_role` key (for backend)

### 3. Environment Variables

**Frontend** (`frontend/.env`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://127.0.0.1:3001
# Optional: error reporting
VITE_SENTRY_DSN=
```

**Backend** (`backend/.env`):
```
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
FRONTEND_URL=http://localhost:5173

# Optional. Each feature stays off until its value is set.
RESEND_API_KEY=            # emails invites (resend.com)
EMAIL_FROM=DevSync <invites@your-domain.com>
UPSTASH_REDIS_REST_URL=    # shares the run rate limit across server instances
UPSTASH_REDIS_REST_TOKEN=
SENTRY_DSN=                # error reporting
```

### Database

Run every file in `supabase/migrations/` in the Supabase SQL Editor, in order (001 to 007).

### 4. Run Locally

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Frontend: http://localhost:5173
Backend: http://127.0.0.1:3001

## Checks

```bash
cd backend && npm run check    # real-time collaboration, end to end
cd frontend && npm run check   # search, zip, preview and challenge helpers
```

CI (`.github/workflows/ci.yml`) runs both plus the production build on every push.

## Features

- 🔐 **Authentication** — Google & GitHub OAuth via Supabase
- 📁 **Workspaces** — Create, manage, invite collaborators securely
- 📝 **Monaco Editor** — Full VS Code editing experience
- 🗂️ **File System** — Create, rename, delete files & folders
- ▶️ **Code Execution** — Run code in 10+ languages via Judge0 (Securely Proxied)
- 👥 **Real-Time Collaboration** — Live sync via Supabase Realtime
- 🟢 **Presence** — See who's online in your workspace
- 🔒 **Row-Level Security** — Secure data isolation per workspace bypassing RLS recursion
- ✍️ **Co-editing** — Yjs-based simultaneous editing, live cursors, offline edits, your-own undo
- ⌨️ **Editor** — Command palette, quick open, search & replace across files, split view, Vim keys, zen mode, settings
- 👀 **Preview** — Live HTML/CSS/JS preview with console, Markdown preview
- 🧪 **Running** — Multi-file runs, program arguments, test cases, shared run history
- 🕘 **History** — Automatic versions, checkpoints, diffs, restore, session replay, activity and access log
- 🔗 **Sharing** — Invite links, email invites for new users, public read-only links, templates, duplicate, pin, archive
- 💬 **Together** — Code comments, chat, @mentions, notifications, follow mode, pair (driver/navigator) mode
- 🎓 **Creative** — Interview mode, classroom copies, daily challenge, code-to-image
- 🖍️ **Live extras** — Who-wrote-what gutter, ping a line, draw over code, line reactions, "also editing this function" warning, paste detection, mob rotation
- 🔀 **Review** — Suggestion mode (anyone proposes, editors accept), live forks with 3-way merge, tests that rerun on every save and name whose edit broke them
- 🏫 **Classroom** — Teacher wall of every student's copy, pause everyone, push hints, raised hands, timed races with a leaderboard
- 📺 **Sharing live** — Spectator links with viewer chat and guest suggestions, embeddable code movies, live runnable embeds
- 🗺️ **Diagrams** — Mermaid files and blocks, clickable call graph that jumps to the code

## Supported Languages

JavaScript, TypeScript, Python, Java, C, C++, Go, Rust, Ruby, PHP, C#

## Project Structure

```
DevSync/
├── frontend/          # React + Vite + TailwindCSS
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route pages
│       ├── store/         # Zustand stores
│       ├── hooks/         # Custom React hooks
│       ├── services/      # API service layers
│       └── lib/           # Supabase client
├── backend/           # Express.js API
│   ├── controllers/      # Route handlers
│   ├── routes/           # Express routes
│   ├── middleware/        # Auth middleware
│   ├── services/         # Judge0 integration
│   └── config/           # Supabase config
└── supabase/
    └── migrations/       # SQL schema + RLS policies
```

## Author

**Kunal Kumar**

## License

MIT
