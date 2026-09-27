# Phase 2: connect your Clerk account

Status: completed 28 September 2026. Live Clerk sign-in reached the protected workspace, and Express verified the session token.

## 1. Create a development application

Open https://dashboard.clerk.com and create your own account if needed. Create an application named **AI Notes Platform**. Enable email sign-in; keep the other defaults for now. Use the **Development** instance for local work.

## 2. Save the keys locally

In that application's API keys page, find the publishable key (starts with `pk_test_`) and secret key (starts with `sk_test_`). Use keys from the same application.

The empty `.env` files are already created. Open them in your editor and fill in the values after `=`:

**client/.env**

```dotenv
VITE_CLERK_PUBLISHABLE_KEY=your_publishable_key
```

**server/.env**

```dotenv
CLERK_PUBLISHABLE_KEY=the_same_publishable_key
CLERK_SECRET_KEY=your_secret_key
CLERK_AUTHORIZED_PARTIES=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173
```

Do not copy the example words literally. Paste the actual values into these local files, not chat or Notion. The secret key belongs only in server/.env. Variables beginning with VITE_ can be exposed to the browser. Both .env files are ignored by Git.

## 3. Restart and open the app

Stop your existing development terminals with Ctrl+C, then run from the project folder:

```powershell
cd C:\Users\ASUS\OneDrive\Desktop\Notes_ai
npm.cmd run dev
```

Open http://127.0.0.1:5173. Vite loads client/.env. The server startup command loads server/.env. Restart both after changing keys. Use the same browser hostname consistently during sign-in.

## 4. Verify the complete flow

- Visit /workspace while signed out: it should redirect to /sign-in.
- Select sign-up, create your test account, and complete email verification if requested.
- You should arrive at /workspace. Click **Verify my session**: Express should return your verified account ID.
- Reload /workspace: your signed-in session should remain usable.
- Open the account avatar and sign out. The private workspace should no longer be accessible.
- Sign back in and verify the session again.
- A request to /api/auth/me without a session/token must return 401 once configured. Before server keys are present it returns 503, never a fake account.

Keep the keys local. Do not send them in chat or record them in Notion.

## What the code does

React → Clerk sign-in → session token → Express Clerk middleware → verified user ID.

Authentication asks **who are you?** Authorization asks **may you access this particular resource?** Phase 2 verifies identity. Phase 3 will check ownership of each note. A protected React route improves navigation, but only the backend can protect API data.

- client/src/Root.jsx: setup screen, Clerk provider, sign-in/sign-up routes, protected workspace, account menu and session check.
- client/src/App.jsx: original Phase 1 connection page, available at /connection.
- server/src/app.js: health endpoint plus protected GET /api/auth/me.
- server/test/auth.test.js: real SDK verification using temporary test-only RSA keys. These do not create a Clerk user and cannot authenticate against your Clerk application.

## Checks already run

Production frontend build passed. All nine HTTP tests passed: health, missing route, missing configuration, signed-out request, valid signed test token, malformed token, expired token, wrong origin and forged signature. Live Clerk account flow remains unverified.

## Troubleshooting

- Setup screen remains: check client/.env and restart Vite.
- Server returns 503: check both server keys and restart Express; it may also mean verification is temporarily unavailable.
- Server returns 401: sign in again; ensure both keys belong to the same Clerk development application and your origin is in the allowlist.
- Port already in use: stop your earlier development terminal before starting another.
- Never solve a sign-in failure by skipping backend verification.

Official references: https://clerk.com/docs/react/getting-started/quickstart and https://clerk.com/docs/reference/express/clerk-middleware
