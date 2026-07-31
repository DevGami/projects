# FortisExam — Frontend Design (Post Architecture Review)

> **Last Updated:** 2026-06-08 (Updated with Clerk + Architecture Review)

---

## Two Frontend Applications

### 1. Admin Portal (`web/`)
- **Purpose:** Exam authority management interface
- **Stack:** React 18, TypeScript, Vite, **Clerk** (`@clerk/clerk-react`)
- **Auth:** Clerk-managed (login, sessions, MFA, user management)
- **Target:** Modern web browser
- **Key Pages:** Login (Clerk), Dashboard, Questions, Exams, Audit

### 2. Candidate Kiosk (`desktop/`)
- **Purpose:** Locked-down exam terminal
- **Stack:** Electron 28+, React 18, TypeScript
- **Auth:** Custom (QR scan + face verification, offline)
- **Target:** Windows desktop (kiosk mode)
- **Key Pages:** Authentication, Exam Execution, Summary, Completion

---

## Admin Portal — Clerk Integration

### App Structure
```tsx
// web/src/App.tsx
<ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <Router>
    <SignedOut>
      <Route path="*" element={<SignIn />} />
    </SignedOut>
    <SignedIn>
      <Layout>
        <Route path="/" element={<Dashboard />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/audit" element={<Audit />} />
      </Layout>
    </SignedIn>
  </Router>
</ClerkProvider>
```

### Clerk Components Used
| Component | Purpose |
|---|---|
| `<ClerkProvider>` | Wraps entire app with Clerk context |
| `<SignIn />` | Pre-built login page |
| `<UserButton />` | User avatar + dropdown (profile, sign out) |
| `<SignedIn>` / `<SignedOut>` | Conditional rendering based on auth state |
| `useAuth()` | Get session token for API calls |
| `useUser()` | Get current user info (role, name) |

### API Call Pattern
```tsx
// All API calls include Clerk session token
const { getToken } = useAuth();
const token = await getToken();
const response = await fetch('/api/v1/questions', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## Admin Portal Features

| Feature | Priority | Description | Clerk Involvement |
|---|---|---|---|
| Login / Auth | P0 | User login, MFA, session management | **Clerk handles entirely** |
| User Management | P2 | Invite users, assign roles | **Clerk Dashboard** |
| Question Management | P1 | Create, edit, view questions (encrypted) | Token for API auth |
| Exam Configuration | P1 | Blueprint setup, compile, release key | Token for API auth |
| Audit Viewer | P2 | Browse and verify audit chains | Token for API auth |
| Dashboard | P1 | Overview stats, recent activity | Token for API auth |

---

## Candidate Kiosk Features

| Feature | Priority | Description |
|---|---|---|
| QR Scanner | P0 | Webcam-based QR code scanning |
| Face Capture | P0 | Webcam face capture for verification |
| Question Display | P0 | Render question with options |
| Navigation | P0 | Previous, Next, Jump to question |
| Timer | P0 | Countdown timer with pause on recovery |
| Auto-Save | P0 | Immediate answer persistence |
| Answer Summary | P0 | Pre-submission review of all answers |
| Kiosk Lockdown | P0 | No alt-tab, no devtools, no browser |

> ⚠️ **The candidate kiosk does NOT use Clerk.** It authenticates via custom QR + face verification against the local edge server. No internet is required.

---

## Environment Variables

### Admin Portal (`web/.env`)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### Candidate Kiosk (`desktop/.env`)
```
EDGE_SERVER_URL=http://localhost:8001/api/v1
```

---

## Related Documents

- [[ADR-002-ClerkAuthentication]] — Clerk decision record
- [[BackendDesign]] — API endpoints consumed + Clerk middleware
- [[Module03_Authentication]] — Full auth specification
- [[RepositoryStructure]] — File organization
- [[CodingStandards]] — Code style and conventions
