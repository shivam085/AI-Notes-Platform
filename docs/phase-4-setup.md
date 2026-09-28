# Phase 4: first AI summary setup

This phase adds one simple AI path:

```text
React summary button → Express checks note ownership → FastAPI → Gemini → summary box
```

The browser never receives the Gemini key or the internal FastAPI token. Express first loads the note using the signed-in Clerk user ID. Only an owned, saved note is sent to the local AI service.

## 1. Install Python

Install Python 3.11 or newer from [python.org](https://www.python.org/downloads/windows/). During installation, select **Add Python to PATH**. Open a new PowerShell window and check that `python --version` works.

## 2. Set up the AI service once

Run these commands in PowerShell:

```powershell
cd D:\Projects\Notes_ai\ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/app/apikey), then add it to `ai-service/.env`. Do not put the key in React, Git, Notion, or chat.

Set one long, random `AI_SERVICE_TOKEN` in `ai-service/.env`. Put the **same value** in `server/.env`, together with `AI_SERVICE_URL=http://127.0.0.1:8000`.

## 3. Start and check it

Keep the virtual environment activated, then run:

```powershell
python -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` to see FastAPI's interactive local API page. `http://127.0.0.1:8000/health` should return `{"status":"ok"}`.

Restart Express after changing `server/.env`. In the signed-in workspace, save a short note, open it, and select **Summarize this note**.

## How to debug the request path

1. If the button says the AI service is unavailable, make sure FastAPI is running on port 8000.
2. If it says it cannot create a summary, confirm the same `AI_SERVICE_TOKEN` appears in both local `.env` files and that the Gemini key is valid.
3. If the note cannot be found, save it first and make sure you are signed in to its owner account.

The original note is never overwritten by this feature. The summary is displayed separately and is not stored yet; saving reusable summaries arrives with later study features.
