# StudyBuddy

StudyBuddy is a multi-page study productivity app built with Next.js that combines:

- a live study timer,
- task tracking with priority-aware ordering and drag-and-drop reordering,
- a countdown schedule,
- and optional account-based sync across devices.

The app supports both local-only usage (Demo Mode) and authenticated cloud sync using Google Sign-In + Firebase.

## Features

- **Dashboard**: At-a-glance progress, task completion, upcoming schedule, and weekly study analytics chart.
- **Timer**: Start/stop study sessions and persist daily totals.
- **Tasks**: Add, prioritize, complete, delete, and reorder tasks with drag-and-drop.
- **Schedule**: Create upcoming events with date/time and view live countdowns.
- **Auth + Sync**: Google authentication via NextAuth and Firestore-backed data sync.
- **Offline-first behavior**: Local storage is used for fast UI and unauthenticated usage.

## Project Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS v4, Lucide icons
- **Auth**: NextAuth (Google provider)
- **Data**:
  - Client state + `localStorage` for fast/offline-first interactions
  - Firebase Firestore (via Firebase Admin) for authenticated persistence
- **Visualization**: Chart.js + `react-chartjs-2`
- **Interactions**: `@hello-pangea/dnd` for drag-and-drop task ordering

## Local Development

### 1) Prerequisites

- Node.js 20+ recommended
- npm (project ships with `package-lock.json`)
- A Firebase project (for cloud sync)
- A Google OAuth client (for login)

### 2) Install dependencies

```bash
npm install
```

### 3) Create environment variables

Create a `.env.local` file in the repo root:

```bash
cp .env.local.example .env.local
```

If `.env.local.example` does not exist, create `.env.local` manually with:

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Firebase client SDK (public vars)
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-firebase-app-id

# Firebase Admin SDK (choose one approach)
# Option A: Single JSON string (service account object)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Option B: Separate fields (if not using FIREBASE_SERVICE_ACCOUNT_KEY)
# FIREBASE_PROJECT_ID=your-project-id
# FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 4) Configure Google OAuth redirect URI

In Google Cloud Console, set your authorized redirect URI to:

- `http://localhost:3000/api/auth/callback/google`

### 5) Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6) Useful scripts

- `npm run dev` - Start local dev server
- `npm run build` - Production build
- `npm run start` - Run production server
- `npm run lint` - ESLint checks

## How Data Flows

StudyBuddy intentionally follows an offline-first sync strategy:

1. Load from `localStorage` first for immediate UI responsiveness.
2. If authenticated, fetch cloud data from `/api/sync`.
3. Overwrite local state with cloud data (authoritative source for signed-in users).
4. Only allow cloud writes after initial cloud load completes.

This prevents a new or stale device from accidentally overwriting valid cloud data during startup.

## Architecture and File Structure

```text
.
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # NextAuth route handlers
│   │   └── sync/route.ts                 # User data GET/POST sync endpoint
│   ├── components/
│   │   └── AppShell.tsx                  # SessionProvider wrapper
│   ├── hooks/
│   │   └── useStudyData.ts               # Shared app state + local/cloud persistence
│   ├── dashboard/page.tsx                # Main overview page
│   ├── timer/page.tsx                    # Timer and session tracking
│   ├── todos/page.tsx                    # Task management + reordering
│   ├── schedule/page.tsx                 # Countdown event planner
│   ├── page.tsx                          # Landing/login/demo entry
│   ├── layout.tsx                        # Root layout + providers
│   ├── globals.css
│   └── styles/colors.css                 # Theme tokens
├── lib/
│   ├── auth.ts                           # NextAuth options
│   ├── firebase.ts                       # Client Firebase init
│   └── firestore.ts                      # Server Admin Firestore helpers
├── types/
│   └── next-auth.d.ts                    # Session type augmentation
├── package.json
└── tsconfig.json
```

## Engineering Decisions and Rationale

### 1) Multi-device race condition mitigation

To handle concurrent usage across many users/devices, synchronization is centralized in `useStudyData`. Key safeguards:

- Loads cloud state before permitting authenticated writes.
- Uses a `hasLoadedFromCloud` gate to block premature sync pushes.
- Persists local changes immediately, then syncs remotely when authenticated.
- Uses a single `saveData` pathway to reduce inconsistent writes across pages.

This pattern reduces data clobbering risk when users sign in from fresh devices or switch between sessions quickly.

### 2) Priority-driven task insertion (min-heap intent)

Task priority is modeled using numeric weights (`Critical` highest priority). New tasks are inserted at the correct position based on weight so the queue remains naturally ordered for action.

Even though the current implementation uses ordered-array insertion (instead of a formal heap structure), it captures the same product goal: faster student decision-making by surfacing high-impact tasks first.

### 3) Native iOS access via SwiftUI + WebKit

The product has also been designed to support native access patterns for iOS users using a SwiftUI `WKWebView` wrapper so students can launch StudyBuddy as a native app experience without relying on a browser shortcut.

In this web repo, that complements:

- standalone web manifest configuration, and
- responsive UI behavior for mobile-sized layouts.

## Opportunities for Improvement and Scale

### Reliability and consistency

- Add conflict-resolution metadata (`updatedAt`, per-entity versioning) to support true last-write-wins or merge strategies.
- Move from full-document writes to partial/field-level updates for lower overwrite risk.
- Add retry + exponential backoff queue for failed sync calls.

### Performance at larger scale

- Split user data into subcollections (tasks, sessions, events) to avoid growing single-document payloads.
- Batch writes/debouncing for high-frequency timer updates.
- Add caching/edge strategies for read-heavy dashboard views.

### Security and governance

- Harden Firestore security rules with stricter schema validation.
- Rotate credentials and enforce environment segregation per stage (dev/staging/prod).
- Add server-side input validation for `/api/sync` payloads.

### Product and platform improvements

- Implement a true min-heap priority queue abstraction if task volume grows significantly.
- Add PWA service worker for deeper offline support and background sync.
- Introduce notifications/reminders (web push and iOS-native bridge).
- Add accessibility audits (keyboard DnD interactions, contrast checks, screen reader labels).

### Quality and maintainability

- Add unit tests for hook sync logic and API routes.
- Add integration/e2e tests for auth, cross-page state updates, and offline/online transitions.
- Introduce telemetry dashboards for sync latency, failures, and user retention metrics.

## Notes

- You can run StudyBuddy without signing in (Demo Mode), but data remains local to the browser.
- Authenticated mode enables persistence across devices via Firestore.
- If cloud sync is not configured, the app still runs locally, but API sync/auth flows will fail until environment variables are set.
