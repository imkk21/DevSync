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
```

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

## Features

- 🔐 **Authentication** — Google & GitHub OAuth via Supabase
- 📁 **Workspaces** — Create, manage, invite collaborators securely
- 📝 **Monaco Editor** — Full VS Code editing experience
- 🗂️ **File System** — Create, rename, delete files & folders
- ▶️ **Code Execution** — Run code in 10+ languages via Judge0 (Securely Proxied)
- 👥 **Real-Time Collaboration** — Live sync via Supabase Realtime
- 🟢 **Presence** — See who's online in your workspace
- 🔒 **Row-Level Security** — Secure data isolation per workspace bypassing RLS recursion

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
