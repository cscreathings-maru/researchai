# PaperQA2 UI — Claude Code Prompt

Copy and paste each section below as a separate prompt into Claude Code.
Build them in order — each section depends on the previous.

---

## Context to paste at the start of every session

```
I'm building a web UI for PaperQA2, a scientific paper Q&A system.
The backend API is running at https://researchai.umarsyukri.com with these endpoints:

GET  /health              → { status, llm, summary_llm, papers_dir }
GET  /papers              → { count, papers: string[] }
POST /upload              → multipart form-data with field "file" (PDF only)
POST /ask                 → { question: string, llm?: string, summary_llm?: string }
                            returns { question, answer, references }

The app is a Next.js 14 project using TypeScript, Tailwind CSS, and shadcn/ui.
Use the App Router. All API calls go to the backend URL above — no need for a
Next.js API route proxy.

Design direction: refined academic / research tool aesthetic. Think a high-end
journal or a serious research dashboard. Dark navy/charcoal base with warm amber
or gold accents. Typography: a serif display font (like Playfair Display or
Libre Baskerville) for headings paired with a clean mono or sans for body.
Feels like a tool a serious researcher would trust.
```

---

## Prompt 1 — Project scaffold & layout

```
Set up the Next.js 14 project with the following:

1. Install dependencies:
   - shadcn/ui (init with dark theme, slate base color)
   - @fontsource/playfair-display
   - @fontsource/jetbrains-mono
   - lucide-react
   - react-markdown
   - react-dropzone
   - sonner (toast notifications)

2. Global CSS (app/globals.css):
   - CSS variables for the color palette:
     --bg: #0d1117 (near-black)
     --surface: #161b22 (card background)
     --border: #2d333b
     --text: #e6edf3
     --muted: #8b949e
     --accent: #d4a847 (warm gold)
     --accent-hover: #e6bc5a
   - Import Playfair Display (weights 400, 700) and JetBrains Mono
   - Apply base font as JetBrains Mono for body, Playfair Display for h1/h2
   - Subtle noise texture on the background using an SVG filter

3. Root layout (app/layout.tsx):
   - Dark background matching --bg
   - Toaster from sonner at the bottom-right
   - No header — the sidebar handles navigation

4. Main shell (app/page.tsx + components/Shell.tsx):
   - Two-column layout: narrow fixed sidebar (240px) + main content area
   - Sidebar contains: app logo/name "ResearchAI", nav links (Ask, Papers,
     Settings), and a status badge showing the connected LLM model name
     (fetched from GET /health on mount)
   - Main area is a scrollable content region
   - On mobile: sidebar collapses to a bottom tab bar with icons only

Make sure the layout renders correctly before moving on.
```

---

## Prompt 2 — Papers page (upload + library)

```
Build the Papers page at app/papers/page.tsx.

This page has two sections:

── SECTION 1: Upload Zone ──
- A full-width drag-and-drop zone using react-dropzone
- Accepts PDF files only (multiple at once)
- Visual states:
  - Idle: dashed border in --border color, upload icon, text "Drop PDFs here
    or click to browse"
  - Drag-over: border turns --accent gold, subtle glow, scale up slightly
  - Uploading: progress indicator per file (file name + spinner)
  - Success: file name with a green checkmark, fades after 3 seconds
  - Error: red border + error message from API
- On drop/select, call POST /upload for each file with multipart form-data
- Show a toast via sonner for each success/failure

── SECTION 2: Paper Library ──
- Below the upload zone, fetch GET /papers on mount and on every successful upload
- Display results as a clean list:
  - Each row: PDF icon, filename, a subtle "indexed" badge
  - Empty state: illustration (simple SVG of stacked papers) + text
    "No papers yet. Upload your first PDF above."
  - Loading state: 3 skeleton rows
- Show total count as "N papers indexed" in a muted label above the list

Style everything to match the dark academic theme. The upload zone should feel
premium — not a generic dashed box.
```

---

## Prompt 3 — Ask page (main Q&A interface)

```
Build the Ask page at app/ask/page.tsx. This is the primary interface.

Layout: single column, centered, max-width 780px.

── INPUT AREA ──
- Large textarea (auto-resizing, min 3 rows) for the question
  - Placeholder: "Ask anything about your papers..."
  - Font: Playfair Display italic for a distinguished look
- Below the textarea: a row with
  - Left: a subtle model selector dropdown (shadcn Select) showing the current
    LLM. Pre-populate with these OpenRouter options:
      • anthropic/claude-3.5-sonnet (default)
      • openai/gpt-4o
      • openai/gpt-4o-mini
      • meta-llama/llama-3.3-70b-instruct:free
    Format them as "openrouter/<model>" when sending to the API.
  - Right: "Ask" button with a gold accent background, arrow-right icon
- Keyboard shortcut: Cmd/Ctrl+Enter submits

── LOADING STATE ──
While waiting for the API response (can take 30-120 seconds):
- Replace the Ask button with a subtle animated "Researching..." indicator
- Show a progress-style message that cycles every 4 seconds through:
  "Searching papers..." → "Gathering evidence..." → "Synthesizing answer..."
- Do NOT disable the textarea so the user can prepare the next question

── ANSWER DISPLAY ──
After the API returns, display the answer below the input:
- Answer card with a thin gold left border
- Render answer.answer using react-markdown with proper typography:
  - Inline citations styled as superscript gold numbers
  - Code blocks in JetBrains Mono on a slightly lighter background
  - Bold and italic preserved
- Below the answer: a collapsible "References" section (collapsed by default)
  - Shows answer.references as a numbered list
  - Toggle with a chevron icon
- Action row: "Copy answer" button, "Copy references" button, "Ask follow-up"
  button (pre-fills textarea with "Following up on the above: ")

── HISTORY ──
- Keep the last 10 Q&A pairs in React state (no persistence needed)
- Show them below the current answer as collapsed cards
  - Each shows the question truncated to 1 line + a timestamp
  - Click to expand and see the full answer
- A "Clear history" button at the bottom

Make the answer reading experience feel like reading a well-typeset journal
article — generous line height, comfortable measure, clear hierarchy.
```

---

## Prompt 4 — Settings page

```
Build the Settings page at app/settings/page.tsx.

Sections:

── CONNECTION ──
- Read-only field showing the API base URL (https://researchai.umarsyukri.com)
- A "Test connection" button that calls GET /health and shows:
  - Green badge "Connected" with the LLM name if 200
  - Red badge "Unreachable" if the request fails
- Current model info card: shows llm and summary_llm from /health response

── MODEL DEFAULTS ──
- Two dropdowns (same OpenRouter model list as the Ask page):
  - "Answer model" (maps to llm)
  - "Summary model" (maps to summary_llm)
- Note below: "These are saved locally and used as defaults on the Ask page.
  The actual model used depends on your server .env configuration."
- Save to localStorage

── ABOUT ──
- Small info card:
  - "Powered by PaperQA2 by FutureHouse"
  - Link to https://github.com/Future-House/paper-qa
  - API endpoint badge

Style as a clean settings panel — no clutter. Use shadcn Card components
for each section.
```

---

## Prompt 5 — Polish & finishing touches

```
Polish the entire app with these finishing touches:

1. Page transitions:
   - Fade + slight upward slide when navigating between pages
   - Use CSS animations with animation-fill-mode: both

2. Sidebar enhancements:
   - Active nav item gets a gold left border + slightly lighter background
   - Paper count badge on the "Papers" nav item (live, from /papers)
   - A small pulsing green dot next to the LLM name if /health returns ok

3. Empty state for Ask page:
   - When no question has been asked yet, show a centered illustration area:
     - A large, lightly rendered quote mark in --accent color (opacity 0.08)
     - Text: "Start by uploading papers, then ask your first question."
     - A shortcut hint: "⌘↵ to submit"

4. Error handling:
   - If /ask returns an error (e.g. no papers indexed), show an inline
     error card with the message and a direct link to the Papers page
   - If the request times out (>120s), show a timeout message with a
     "Try again" button

5. Responsive:
   - Below 768px: sidebar becomes a bottom tab bar (Ask, Papers, Settings icons)
   - Below 480px: answer card goes full width, no padding

6. Accessibility:
   - All interactive elements have focus-visible styles using --accent color
   - Textarea has aria-label="Research question"
   - Loading states have aria-live="polite" announcements

7. Fix the slidemu nginx warning (separate task, not UI):
   This is already resolved — ignore.

Run a final check: navigate through all pages, upload a PDF, ask a question,
and verify the answer renders with proper markdown. Fix any issues found.
```

---

## Deployment note for Claude Code

After building, deploy as a static export or a Node server alongside the existing
stack. Since ports 3000 and 3100 are taken on the VPS, use **port 3200**:

```bash
# In package.json scripts, add:
"start": "next start -p 3200"

# Build and run
npm run build
npm run start

# Or add to docker-compose.yml in ~/paperqa/ as a second service:
```

```yaml
  paperqa-ui:
    build:
      context: ./ui
      dockerfile: Dockerfile.ui
    container_name: paperqa-ui
    restart: unless-stopped
    ports:
      - "127.0.0.1:3200:3200"
    environment:
      - NEXT_PUBLIC_API_URL=https://researchai.umarsyukri.com
```

Then add an nginx site for the UI at a second subdomain (e.g. `researchai-app.umarsyukri.com`)
pointing to port 3200, and get a cert with:

```bash
sudo certbot --nginx -d researchai-app.umarsyukri.com
```

---

*Use these prompts in order inside a single Claude Code session for best results.*
*Each prompt builds on the previous — don't skip ahead.*
