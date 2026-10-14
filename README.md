# AI Chat Studio — Full-stack project

A responsive AI chat application built with **HTML, CSS, JavaScript, Node.js and Express**. It connects to the OpenAI Chat Completions API from the backend, so the secret API key is never sent to the browser.

## Features

- Four prompt templates: General assistant, Study tutor, Coding helper and Writing assistant.
- Live/streamed model responses.
- Friendly handling for empty messages, missing API key, invalid key, rate limits, provider failures and connection timeouts.
- Recent conversation context (up to 10 prior messages sent to the API).
- Responsive layout, new-chat button, suggestion cards and server health status.
- Basic API rate limiting, request-size validation and security headers.
- `/api/health` and `/api/templates` endpoints.

## Requirements

- Node.js 18 or later (Node 20+ recommended).
- npm (installed with Node.js).
- An API key and API access from your chosen model provider. This starter uses the OpenAI API; API usage may cost money and is separate from a ChatGPT subscription.

## Folder structure

```text
ai-chat-fullstack/
├── public/
│   ├── index.html       # Frontend structure
│   ├── style.css        # Responsive UI
│   └── app.js           # Browser logic and streaming reader
├── .env.example         # Environment variable template (safe to commit)
├── .gitignore           # Excludes .env and node_modules
├── package.json
├── server.js            # Express API + model connection
└── README.md
```

## Run it on Windows (PowerShell)

### 1. Extract and open the folder

Extract `ai-chat-fullstack.zip`, then open that folder in VS Code. In the VS Code terminal, make sure the current directory is the project root—the folder containing `package.json` and `server.js`.

```powershell
cd path\to\ai-chat-fullstack
```

### 2. Install dependencies

```powershell
npm install
```

### 3. Create your environment file

```powershell
Copy-Item .env.example .env
```

Open `.env` and replace the placeholder:

```env
OPENAI_API_KEY=your_real_api_key_here
OPENAI_MODEL=gpt-4o-mini
PORT=3000
```

Use the API key from your provider's developer platform. Do not put the key in `public/app.js`, HTML, screenshots, GitHub, or Google Classroom. Do not share your `.env` file. If a key is exposed, revoke it and create another one.

### 4. Start the server

```powershell
npm run dev
```

Or use `npm start` for the normal start command. You should see:

```text
AI Chat is running at http://localhost:3000
```

### 5. Open the app

Open **http://localhost:3000** in your browser. Keep the terminal/server running while using it. Do not open `public/index.html` directly with a `file://` URL because the app uses the Express server.

### 6. Check the API

Open these in a browser:
- `http://localhost:3000/api/health` — should return JSON with `"status":"ok"`.
- `http://localhost:3000/api/templates` — lists the four templates.

A successful health check confirms your local server is running; it does not confirm that your model API key has credit/access. Send a chat message to test the model connection.

## How frontend and backend connect

1. The browser loads `public/index.html`, `style.css` and `app.js` from Express.
2. When you send a message, `app.js` sends `POST /api/chat` with the message, selected template and recent conversation history.
3. `server.js` validates the request, adds the template's system instruction and calls the model provider using `OPENAI_API_KEY` from `.env`.
4. The provider sends Server-Sent-Events (SSE) data; the server extracts each text token and streams plain text to the browser.
5. The browser reads the response stream and appends text as it arrives.
6. If the request fails, the server returns a friendly error message for the frontend to show.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check server status |
| GET | `/api/templates` | List available prompt templates |
| POST | `/api/chat` | Stream an AI response |

Example request body:

```json
{
  "message": "Explain REST APIs simply",
  "template": "tutor",
  "history": []
}
```

The `history` list is intentionally limited to the last 10 valid prior messages by the server. This is a learning project, not a production-grade conversation store.

## 14-test manual test table

| # | Test | Steps | Expected result |
|---:|---|---|---|
| 1 | Server starts | Run `npm run dev` | Server prints its local URL |
| 2 | Health endpoint | Open `/api/health` | JSON status is `ok` |
| 3 | Templates endpoint | Open `/api/templates` | Four template choices are returned |
| 4 | Empty input | Submit blank input | Friendly validation message; no model call |
| 5 | General template | Select General and ask a question | General-purpose answer streams in |
| 6 | Tutor template | Select Study tutor and ask a concept | Step-by-step teaching style |
| 7 | Coding template | Select Coding helper and ask for code | Code-focused answer |
| 8 | Writing template | Select Writing assistant and request a rewrite | Writing-focused answer |
| 9 | Streaming | Ask a normal question | Text appears progressively, not all at once |
| 10 | Conversation context | Ask a follow-up referring to prior answer | Recent conversation context is included |
| 11 | Missing API key | Temporarily remove key and restart | Clear configuration error is shown |
| 12 | Invalid API key | Temporarily use a deliberately invalid key | Friendly API-key error is shown |
| 13 | Long message | Submit more than 8,000 characters via API | Request is rejected with a clear error |
| 14 | Rate limit | Send many requests quickly | API rate limit response is returned |

For tests 11–12, restore the real key afterward. Avoid repeatedly testing provider errors because requests can be rate-limited.

## Common issues

- **`npm` is not recognized:** install Node.js LTS, close and reopen VS Code, then run `node -v` and `npm -v`.
- **Port 3000 is in use:** change `PORT=3001` in `.env`, restart, and visit `http://localhost:3001`.
- **API key rejected:** verify the key and provider API access. Do not assume a ChatGPT plan includes API credits.
- **Quota / rate-limit error:** check the provider's API usage, billing and limits.
- **Changes not visible:** refresh the browser. Server code changes restart automatically with `npm run dev`; if not, stop with Ctrl+C and start it again.
- **Blank page:** make sure you visited `http://localhost:3000`, and check the terminal and browser DevTools console.

## Before deploying

Do not deploy with a real API key committed to Git. Set `OPENAI_API_KEY`, `OPENAI_MODEL` and `PORT` as environment variables in your hosting provider. Add authentication and stronger per-user limits before exposing the API publicly. This project is a learning starter and does not persist chat history to a database.
