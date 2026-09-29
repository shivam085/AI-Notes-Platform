# AI Notes Platform: project instructions

## Scope and teaching style

This is the user's first AI/RAG project. Explain new concepts in simple language and build one phase at a time. The active plan is `docs/coding-implementation-plan.md`.

## Consistent engineering conventions

Before implementing a feature, review the existing codebase and follow its established conventions for folder structure, naming, formatting, error handling, API design, component organization, testing, and documentation. Keep code clean, modular, scalable, maintainable, and beginner-friendly. Reuse proven patterns from the user's other projects when they fit the current technology and requirements; do not introduce extra architecture or dependencies without a clear need.

Finish V1 as a complete private notes/documents application with all six AI features, tests, deployment, and documentation. Note sharing, viewer/editor roles, Yjs, WebSockets, and live collaboration are optional V2 only. A later user decision is required to add V2. Do not add collaboration infrastructure to V1.

## Notion documentation authorized by the user

The user explicitly requested that these existing pages be maintained after every development phase. Update them as part of phase work in this project; do not create duplicate logs or claim a background monitor exists.

- Hub: https://app.notion.com/p/3e8c1e94c8d181dbaa6dd282d3e0a40f
- Development Log: https://app.notion.com/p/3e8c1e94c8d181ffa4f0cb43a71caa0f
- Architecture & Concepts: https://app.notion.com/p/3e8c1e94c8d181cda0b3cc006c35018b

Initial state on 27 September 2026: the plan and Notion documentation exist; application code has not started. V1 phases 1–10 are Not Started. Inspect current code and Notion content for the latest state rather than treating this initialization note as permanent.

## Phase update procedure

1. Read the current plan and fetch the existing Notion pages before editing. Use the Notion knowledge-capture skill and available connector tools.
2. Mark the active phase In Progress when implementation begins. Record its actual start date. Status values are Not Started, In Progress, and Completed.
3. At the end of a phase, update only that phase's existing section, the relevant concepts, the hub's current status if changed, and Lessons Learned. Mark Completed only when required implementation and verification really pass. Record the actual completion date.
4. Preserve numerical/chronological history. Do not rewrite unchanged earlier phases. If earlier behavior changes, make a targeted correction with a date and explanation; preserve the original context.
5. Each phase must retain these fields: Status; Goal; What I implemented; Technologies/concepts used; Important files/components created or modified; API/DB changes; Key implementation decisions; Problems/errors faced; How I fixed them; Important concepts I learned; Commands/configuration worth remembering; Testing/verification; Next phase.
6. Record observed facts only. Planned files are not implemented files; proposed checks are not passed tests. Use exact useful file paths and verified commands. Never include secrets or fabricate errors, fixes, results, or personal learning experiences.
7. Keep each entry concise and practical. Explain AI terms when first used. Update concept locations from planned directories to actual verified files/components.
8. Keep Lessons Learned at the end of the Development Log. Add important concepts and actual mistakes/fixes with their phase references. Do not convert potential pitfalls from the reference page into claimed historical incidents.
9. After multi-section edits, fetch the pages again to verify structure and content. If Notion is unavailable, save the pending entry under `work/`, report that it is unsynced, and do not claim the page was updated.

## Concept reference format

For every important concept encountered, maintain one concise entry with: What it is; Why this project needs it; How it works in this project; Where it is implemented; Example; Common mistakes; What I should remember for interviews.

Link concepts to relevant phase history when useful. Keep model/API details current using official documentation. Label optional V2 concepts clearly and distinguish planned examples from actual implementation.


Current state (27 September 2026): Phase 1 completed and verified. Project moved to C:\Users\ASUS\OneDrive\Desktop\Notes_ai. Phases 2–10 remain Not Started. Notion log and concept reference updated.

Phase 2 update (28 September 2026): implementation in client/src/Root.jsx and server/src/app.js. Nine backend tests passed; live Clerk sign-in reached the protected workspace and Express verified the session token. Phase 2 is Completed. See docs/phase-2-setup.md. Never print .env values.
