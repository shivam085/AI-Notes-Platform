# Authentication and private workspace

Reviewed against the local source on 25 October 2026. [Feature index](README.md).

## Purpose and user experience

Clerk manages sign-up, sign-in, and sessions. The application uses the verified session to keep each account's notes, documents, conversations, and study sets private.

Open the app at `http://127.0.0.1:5173`. The root redirects to `/workspace`; signed-out visitors are sent to sign-in. The workspace contains Notes, Documents, Semantic Search, Ask your documents, Flashcards, and Quizzes. The account button provides Clerk account controls and sign-out.

## Request flow

1. React's `ClerkProvider` receives the public Clerk application key.
2. `ProtectedRoute` waits for Clerk to finish loading before deciding whether to render or redirect.
3. Each feature receives `getToken`. The shared API helper obtains the current session token for each request.
4. The helper adds `Authorization: Bearer <session-token>`.
5. Express's Clerk middleware verifies the token; controllers derive `userId` from verified authentication.
6. Services use that ID as `ownerId` in database queries. A browser-supplied owner ID cannot replace it.
7. Workspace state remounts when the session ID changes, helping prevent one session's UI state from carrying into another.

Authentication answers “Who are you?” Ownership checks answer “May you access this record?” Both are needed: hiding a React route does not protect the HTTP API.

## Routes and responses

| Route | Behavior |
| --- | --- |
| Browser `/` | Redirect to workspace |
| Browser `/sign-in/*` | Clerk sign-in |
| Browser `/sign-up/*` | Clerk sign-up |
| Browser `/workspace` | Protected feature panels |
| `GET /api/auth/me` | Return the verified user's ID |
| `GET /api/health` | Public process health, no personal data |

A successful identity response is `{"userId":"user_verified"}`. Protected requests without a valid session receive 401. Missing authentication configuration returns 503. Owner-scoped object lookups generally return 404 when the object is absent or belongs to another account.

## Configuration

| File | Variables |
| --- | --- |
| `D:/Projects/Notes_ai/client/.env` | `VITE_CLERK_PUBLISHABLE_KEY` |
| `D:/Projects/Notes_ai/server/.env` | `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES` |

Authorized parties must include the browser origin being used. The example includes localhost development/preview origins. Only the publishable key belongs in React; a `VITE_` variable is included in browser code and is unsuitable for secrets.

## Important implementation files

- [Root.jsx](D:/Projects/Notes_ai/client/src/Root.jsx): providers, routes, protection, session-scoped workspace.
- [api.js](D:/Projects/Notes_ai/client/src/services/api.js): current token and authenticated requests.
- [clerk.js](D:/Projects/Notes_ai/server/src/config/clerk.js): Clerk configuration and middleware.
- [auth.routes.js](D:/Projects/Notes_ai/server/src/routes/auth.routes.js) and [authController.js](D:/Projects/Notes_ai/server/src/controllers/authController.js): identity endpoint.
- [noteService.js](D:/Projects/Notes_ai/server/src/services/noteService.js): a small example of owner-scoped CRUD.

## Failures and limitations

If Clerk is not configured, the UI shows setup guidance rather than a working authenticated workspace. A lost session is reported by the shared request helper. A backend 401 should be resolved by signing in again, not by adding a user ID to the request.

V1 has no sharing, viewer/editor roles, team workspaces, WebSockets, or collaborative editing. Session authentication is separate from the Express-to-FastAPI internal token described in the [architecture guide](14-architecture-configuration-and-testing.md).

## Verification and interview notes

Existing coverage: [auth.test.js](D:/Projects/Notes_ai/server/test/auth.test.js) checks configuration failures, signed-out access, verified identity, and invalid tokens; [clientApi.test.js](D:/Projects/Notes_ai/server/test/clientApi.test.js) checks token attachment and lost-session handling. Feature tests check account isolation.

Manual check to perform: sign in as A, save a note, then use B and verify A's ID cannot be read or changed. Sign out and verify direct API access is denied. These are instructions, not a claim of a new browser run.

**Interview takeaway:** “Clerk verifies identity, Express derives the owner, and every private database lookup includes that owner. Frontend protection improves navigation; backend checks enforce privacy.”
