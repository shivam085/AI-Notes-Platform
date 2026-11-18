# Vercel and Render deployment

This is the Phase 10 deployment setup. A working hosted deployment is not confirmed until the end-to-end checks below pass.

## Architecture

Browser → Vercel React app → Vercel `/api` rewrite → Render Express → Render FastAPI → Gemini and Qdrant. Express also connects to MongoDB Atlas, Cloudinary, and Clerk. The browser receives only the Clerk publishable key and session token; database, storage, Gemini, Qdrant, Clerk secret, and internal service tokens belong on the backend.

The repository-root `vercel.mjs` uses `EXPRESS_API_ORIGIN` to route `/api` requests to Express and serves the React app for client routes. Vite's local proxy remains for development. `render.yaml` describes two free web services, sets `HOST=0.0.0.0` for Express, generates the shared AI token, and references the AI service URL and token from Express. Free Render web services are public: the FastAPI internal routes still require the shared token. Use a paid Render private service and private networking if the AI service must be network-private.

## Before starting

- Push the verified changes to the repository/branch you want Render and Vercel to deploy. Do not commit `.env` files or API keys.
- Have access to the appropriate Render, Vercel, Clerk, MongoDB Atlas, Cloudinary, Qdrant Cloud, and Gemini accounts. Check plan and usage charges before enabling paid services.
- Use a Gemini generation model your API key can actually access. This checkout uses `GEMINI_MODEL`; it does not support the earlier `GENERATION_PROVIDER`/Claude adapter configuration.
- On 18 November 2026, live generation passed with `GEMINI_MODEL=gemini-3.1-flash-lite` after the previous model returned high-demand errors. Local Qdrant access needed `QDRANT_FORCE_TLS12=true`; keep the default false on Render unless that environment reproduces the TLS reset. See [AI service troubleshooting](ai-service-troubleshooting.md) for the verified fixes and their limits.
- The default embedding model and dimension must match the existing Qdrant collection. A changed embedding model or dimension requires a compatible collection and re-indexing.

## Render Blueprint

1. In Render choose **New → Blueprint**, connect this repository and select the branch containing `render.yaml`.
2. Provide the prompted values for `GEMINI_API_KEY`, `GEMINI_MODEL`, `QDRANT_URL`, `QDRANT_API_KEY`, Clerk keys, `CLERK_AUTHORIZED_PARTIES`, `MONGODB_URI`, and Cloudinary credentials. `QDRANT_COLLECTION` defaults to `ai_notes_chunks`; change it if your existing collection differs.
3. Set `CLERK_AUTHORIZED_PARTIES` to the exact deployed frontend origin, for example `https://your-app.vercel.app`. If the Vercel origin is not yet known, update it in Render and redeploy after Vercel is created. Preview URLs need their own explicitly allowed origins.
4. Render generates `AI_SERVICE_TOKEN` on the Python service and references that value from Express; do not put it in frontend configuration. Express references the Python service's Render-provided external URL.
5. Verify the Python `/health` and Express `/api/health` endpoints. Health checks show that the services respond, not that every external dependency or AI feature works.

`render.yaml` uses free web services for an initial demo. They spin down after inactivity, are publicly reachable and have limited resources. Python dependencies may exceed the available build/runtime resources; choose a paid plan if needed. Express must stay at one instance because startup recovery is not coordinated across instances. Do not use these free plans as a production reliability guarantee.

## Vercel

1. Import the same repository and branch into Vercel with the **repository root** as the project root. The checked-in `vercel.mjs` supplies the install, build, output and rewrite settings.
2. Add `EXPRESS_API_ORIGIN` as the complete HTTPS origin of the Render Express service, for example `https://example.onrender.com` (no path). Add `VITE_CLERK_PUBLISHABLE_KEY` from the same Clerk instance as the Render backend keys.
3. Deploy. After the Vercel origin is known, set the exact origin in Render's `CLERK_AUTHORIZED_PARTIES`, configure Clerk's allowed deployment/origin settings, and redeploy Express. Production Clerk setup requires the user's own domain and matching production keys; follow Clerk's current instructions. Preview deployments have different origins and may need explicit configuration.
4. Verify `/workspace`, `/sign-in`, and a refresh of each route. Check `/api/health` through the Vercel origin to confirm the external rewrite.

Vercel evaluates `vercel.mjs` at deployment time and requires `EXPRESS_API_ORIGIN`; it intentionally fails configuration when the origin is missing or not HTTPS. Verify the configured external-rewrite timeout and upload limits on the actual plan, particularly for long AI operations and document uploads.

## End-to-end smoke check

Sign in → create and edit a note → summarize → upload a small document → process it → index and search → ask a grounded document question → generate flashcards and a quiz → delete the test document. Use a second account to check that another user's resources remain hidden. These steps exercise live services and may consume API quota. Never print tokens or credentials while checking.

Free services may take roughly a minute to wake after inactivity; a request can time out before both backends are ready. The browser proxy's external timeout can also affect long operations. Health endpoints do not prove Clerk, Gemini, Qdrant, Cloudinary, or MongoDB are usable. Large collections currently need batching beyond the existing 100-chunk indexing request limit.

## Local verification

Run `npm run verify` from the repository root on Windows after installing dependencies and creating `ai-service/.venv`. This runs Node tests, Python tests, and the frontend production build. For the hosted start commands, run FastAPI with `uvicorn app.main:app --host 127.0.0.1 --port 8000` inside `ai-service`, run `npm run start --workspace server` at the root, and use `npm run preview` for the built frontend. Ensure `server/.env` points to the actual local FastAPI port.

References: [Vercel programmatic configuration](https://vercel.com/docs/project-configuration/vercel-ts), [Render Blueprints](https://render.com/docs/blueprint-spec), [Render free service limits](https://render.com/docs/free), and [Clerk production deployment](https://clerk.com/docs/guides/development/deployment/production).
