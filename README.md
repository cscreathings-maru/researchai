# ResearchAI — PaperQA2 on VPS

A self-hosted scientific paper Q&A system powered by **PaperQA2**, running on a
personal Ubuntu VPS with Docker, exposed via Nginx, and backed by **OpenRouter**
as the LLM provider.

---

## Table of Contents

1. [Project Goal](#1-project-goal)
2. [Repositories & Credits](#2-repositories--credits)
3. [Architecture Overview](#3-architecture-overview)
4. [VPS Infrastructure](#4-vps-infrastructure)
5. [Directory Structure](#5-directory-structure)
6. [Services & Port Map](#6-services--port-map)
7. [Subdomains](#7-subdomains)
8. [Docker Setup](#8-docker-setup)
9. [API Endpoints](#9-api-endpoints)
10. [LLM Configuration (OpenRouter)](#10-llm-configuration-openrouter)
11. [Adding Papers](#11-adding-papers)
12. [Frontend UI (Planned)](#12-frontend-ui-planned)
13. [Nginx & TLS](#13-nginx--tls)
14. [Environment Variables](#14-environment-variables)
15. [Useful Commands](#15-useful-commands)
16. [Roadmap](#16-roadmap)

---

## 1. Project Goal

The goal of this project is to run a **private, self-hosted AI research assistant**
that can answer questions about a personal library of scientific PDFs — with proper
inline citations, evidence gathering, and source references.

Rather than uploading sensitive research papers to a third-party SaaS, everything
runs on a personal VPS. Only the LLM inference is delegated to external providers
(via OpenRouter), keeping costs flexible and model choice open.

**Core use case:**
> Upload a collection of scientific PDFs → ask natural language questions →
> receive cited, evidence-backed answers grounded only in those papers.

---

## 2. Repositories & Credits

| Component | Repository | License |
|---|---|---|
| PaperQA2 (RAG engine) | [github.com/Future-House/paper-qa](https://github.com/Future-House/paper-qa) | Apache 2.0 |
| FastAPI (API server) | [fastapi.tiangolo.com](https://fastapi.tiangolo.com) | MIT |
| OpenRouter (LLM routing) | [openrouter.ai](https://openrouter.ai) | — |
| Frontend UI (planned) | Next.js 14 — to be built | MIT |

PaperQA2 is developed by **FutureHouse**. It is installed as a Python package
(`pip install "paper-qa>=5"`) inside the Docker image — the source repo does not
need to be cloned.

---

## 3. Architecture Overview

```
                        Internet
                           │
                    ┌──────▼──────┐
                    │    Nginx    │  :80 / :443
                    │ (TLS proxy) │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │                         │
   ┌──────────▼──────────┐   ┌──────────▼──────────┐
   │   researchai.       │   │   researchai-app.   │
   │   umarsyukri.com    │   │   umarsyukri.com    │
   │   (REST API)        │   │   (Frontend UI)     │
   │   → 127.0.0.1:8765  │   │   → 127.0.0.1:3200  │
   └──────────┬──────────┘   └──────────┬──────────┘
              │                         │
   ┌──────────▼──────────┐   ┌──────────▼──────────┐
   │  Docker: paperqa    │   │  Docker: paperqa-ui │
   │  (FastAPI + PQA2)   │   │  (Next.js 14)       │
   │  port 8765          │   │  port 3200          │
   └──────────┬──────────┘   └─────────────────────┘
              │
              │  LiteLLM / OpenRouter
              ▼
   ┌─────────────────────┐
   │   openrouter.ai     │
   │   claude-3.5-sonnet │
   │   gpt-4o-mini       │
   └─────────────────────┘
              │
              │  Metadata APIs
              ▼
   ┌─────────────────────┐
   │  Semantic Scholar   │
   │  Crossref           │
   └─────────────────────┘
```

---

## 4. VPS Infrastructure

| Property | Value |
|---|---|
| Hostname | `srv1344902` |
| OS | Ubuntu 24.04 LTS |
| Public IP | `76.13.194.117` |
| VPN | Tailscale (`100.77.205.97`) |
| Web server | Nginx 1.24.0 |
| TLS | Let's Encrypt (Certbot, auto-renew) |
| Container runtime | Docker + Docker Compose V2 |

**Other services already running on this VPS** (pre-existing, not part of this project):

| Service | Port | Notes |
|---|---|---|
| Nginx | 80, 443 | Shared reverse proxy |
| slidemu.umarsyukri.com | 3000 | Next.js + Presenton fork |
| reimbursement.terralogical.space | — | PHP/Laravel app |
| PostgreSQL | 5432 (localhost) | |
| MySQL | 3306 (localhost) | |
| Redis | 6379 (localhost) | |
| qBittorrent-nox | 9000, 8090 | |
| SABnzbd | 8070 | |
| n8n | 5678 (localhost) | |
| Gunicorn app | 8081 | |
| Streamlit app | 8501 | |

---

## 5. Directory Structure

```
~/paperqa/
├── .env                  # secrets — never commit
├── Dockerfile            # builds the PaperQA2 + FastAPI image
├── docker-compose.yml    # defines the paperqa service
├── server.py             # FastAPI application
├── papers/               # PDF library (host volume → /app/papers)
└── pqa_data/             # persistent index & cache (host volume → /app/pqa_data)
```

### `.env`

```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENAI_API_BASE=https://openrouter.ai/api/v1
OPENAI_API_KEY=${OPENROUTER_API_KEY}

PQA_LLM=openrouter/anthropic/claude-3.5-sonnet
PQA_SUMMARY_LLM=openrouter/openai/gpt-4o-mini

SEMANTIC_SCHOLAR_API_KEY=...   # optional but recommended for 100+ papers
CROSSREF_API_KEY=...           # optional

PQA_HOME=/app/pqa_data
```

### `Dockerfile`

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl libpoppler-cpp-dev poppler-utils libmagic1 file \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    "paper-qa>=5" fastapi "uvicorn[standard]" python-multipart

RUN mkdir -p /app/papers /app/pqa_data

COPY server.py /app/server.py

EXPOSE 8765

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8765"]
```

### `docker-compose.yml`

```yaml
services:
  paperqa:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: paperqa
    restart: unless-stopped
    ports:
      - "127.0.0.1:8765:8765"
    env_file:
      - .env
    environment:
      - PAPER_DIR=/app/papers
      - PQA_HOME=/app/pqa_data
    volumes:
      - ./papers:/app/papers
      - ./pqa_data:/app/pqa_data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8765/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 6. Services & Port Map

Ports confirmed free and assigned to this project:

| Service | Internal Port | Bound To | Notes |
|---|---|---|---|
| PaperQA2 API | `8765` | `127.0.0.1:8765` | Docker container, localhost only |
| Frontend UI | `3200` | `127.0.0.1:3200` | Planned — Next.js UI |

All other ports on the server (`3000`, `3100`, `5001`, `8080`, `8081`, `8090`,
`8501`, `18791`, `9000`, `5432`, `3306`, `6379`, `6800`, `5678`, `5679`) are
occupied by pre-existing services.

---

## 7. Subdomains

| Subdomain | Purpose | Backend Port | Status |
|---|---|---|---|
| `researchai.umarsyukri.com` | PaperQA2 REST API | 8765 | ✅ Live |
| `researchai-app.umarsyukri.com` | Frontend UI | 3200 | 🔜 Planned |

### TLS Certificates

Both subdomains use **Let's Encrypt** certificates issued via Certbot:

```
/etc/letsencrypt/live/researchai.umarsyukri.com/fullchain.pem
/etc/letsencrypt/live/researchai.umarsyukri.com/privkey.pem
```

Auto-renewal is handled by the Certbot systemd timer — no manual renewal needed.

### Nginx config — `/etc/nginx/sites-available/paperqa`

```nginx
server {
    listen 80;
    server_name researchai.umarsyukri.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name researchai.umarsyukri.com;

    ssl_certificate     /etc/letsencrypt/live/researchai.umarsyukri.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/researchai.umarsyukri.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://127.0.0.1:8765;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }
}
```

---

## 8. Docker Setup

### Build and start

```bash
cd ~/paperqa
docker compose build
docker compose up -d
```

### Check status

```bash
docker compose ps
docker compose logs -f paperqa
```

### Restart after `.env` changes

```bash
docker compose restart paperqa
```

### Rebuild from scratch

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Open a shell inside the container

```bash
docker compose exec paperqa bash
```

---

## 9. API Endpoints

Base URL: `https://researchai.umarsyukri.com`

### `GET /health`
Returns the current server status and configured models.

```bash
curl https://researchai.umarsyukri.com/health
```

```json
{
  "status": "ok",
  "llm": "openrouter/anthropic/claude-3.5-sonnet",
  "summary_llm": "openrouter/openai/gpt-4o-mini",
  "papers_dir": "/app/papers"
}
```

### `GET /papers`
Lists all indexed PDF files.

```bash
curl https://researchai.umarsyukri.com/papers
```

```json
{
  "count": 3,
  "papers": ["paperqa2.pdf", "attention.pdf", "bert.pdf"]
}
```

### `POST /upload`
Upload a PDF file to the library.

```bash
curl -X POST https://researchai.umarsyukri.com/upload \
  -F "file=@paper.pdf"
```

```json
{
  "filename": "paper.pdf",
  "size_bytes": 1048576,
  "status": "uploaded"
}
```

### `POST /ask`
Ask a question against all indexed papers.

```bash
curl -X POST https://researchai.umarsyukri.com/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What methods are used for protein folding prediction?"}' \
  --max-time 120
```

```json
{
  "question": "What methods are used for protein folding prediction?",
  "answer": "Based on the indexed papers, several approaches are used... [1]",
  "references": "1. Author et al. (2024). Journal Name. doi:..."
}
```

Optional fields in the request body:
- `llm` — override the answer model for this request only
- `summary_llm` — override the summary model for this request only

> **Note:** The first `/ask` call after uploading new papers triggers indexing,
> which can take 30–120 seconds depending on PDF count and size.

---

## 10. LLM Configuration (OpenRouter)

PaperQA2 uses **LiteLLM** internally, which supports OpenRouter natively via
the `openrouter/<provider>/<model>` prefix convention.

OpenRouter is configured by pointing LiteLLM's base URL at OpenRouter's endpoint
and using the OpenRouter API key as the auth token.

**Recommended model combinations:**

| Profile | `PQA_LLM` | `PQA_SUMMARY_LLM` | Cost |
|---|---|---|---|
| Best quality | `openrouter/anthropic/claude-3.5-sonnet` | `openrouter/openai/gpt-4o-mini` | $$$ |
| Balanced | `openrouter/openai/gpt-4o` | `openrouter/openai/gpt-4o-mini` | $$ |
| Budget | `openrouter/openai/gpt-4o-mini` | `openrouter/openai/gpt-4o-mini` | $ |
| Free tier | `openrouter/meta-llama/llama-3.3-70b-instruct:free` | `openrouter/meta-llama/llama-3.1-8b-instruct:free` | Free |

Browse all available models at [openrouter.ai/models](https://openrouter.ai/models).

To switch models, edit `~/paperqa/.env` and restart:

```bash
docker compose restart paperqa
```

---

## 11. Adding Papers

**Option A — Copy directly to the volume:**

```bash
cp /path/to/paper.pdf ~/paperqa/papers/
```

**Option B — Upload via API:**

```bash
curl -X POST https://researchai.umarsyukri.com/upload \
  -F "file=@paper.pdf"
```

**Option C — Download from arXiv:**

```bash
curl -L -o ~/paperqa/papers/paperqa2.pdf "https://arxiv.org/pdf/2409.13740"
```

**Option D — Bulk copy:**

```bash
cp /some/folder/*.pdf ~/paperqa/papers/
```

PaperQA2 detects new files automatically on the next `/ask` call. The index
is built incrementally — only new or changed files are re-processed. The index
persists in `~/paperqa/pqa_data/` across container restarts.

To force a full re-index:

```bash
rm -rf ~/paperqa/pqa_data/*
docker compose restart paperqa
```

---

## 12. Frontend UI (Planned)

A web frontend is planned, to be built with **Next.js 14** using Claude Code.

**Planned subdomain:** `researchai-app.umarsyukri.com`
**Planned port:** `3200`

Pages planned:

| Page | Path | Purpose |
|---|---|---|
| Ask | `/ask` | Main Q&A interface with markdown answer rendering |
| Papers | `/papers` | Drag-and-drop PDF upload + indexed paper library |
| Settings | `/settings` | Model selection, connection test, preferences |

Design direction: dark academic — navy/charcoal base, warm gold accents,
Playfair Display serif headings, JetBrains Mono body. Feels like a serious
research tool, not a generic chatbot.

Build instructions are in `paperqa2-ui-prompt.md` — a set of structured prompts
designed to be pasted sequentially into a Claude Code session.

Deployment plan — add a second service to `docker-compose.yml`:

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

Then create `/etc/nginx/sites-available/paperqa-ui` pointing to port `3200`
and run `sudo certbot --nginx -d researchai-app.umarsyukri.com`.

---

## 13. Nginx & TLS

All subdomains on this VPS are managed through Nginx as a shared reverse proxy.

**Relevant config files:**

```
/etc/nginx/sites-available/paperqa        ← ResearchAI API config
/etc/nginx/sites-enabled/paperqa          ← symlink to above
/etc/nginx/sites-enabled/slidemu          ← slidemu.umarsyukri.com (pre-existing)
/etc/nginx/sites-enabled/terralogical     ← reimbursement.terralogical.space (pre-existing)
```

**Common commands:**

```bash
# Test config
sudo nginx -t

# Reload (no downtime)
sudo systemctl reload nginx

# View error log
sudo tail -f /var/log/nginx/error.log

# Issue/renew a cert
sudo certbot --nginx -d your-subdomain.umarsyukri.com

# Check cert expiry dates
sudo certbot certificates
```

**Important lesson learned:** When adding a new subdomain, always create the
nginx config with HTTP only first, run certbot to get the cert, then certbot
will inject the SSL config automatically. Never add SSL cert paths to the nginx
config before the cert exists — nginx will fail to start.

---

## 14. Environment Variables

Full reference for `~/paperqa/.env`:

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ | Your OpenRouter API key |
| `OPENAI_API_BASE` | ✅ | Set to `https://openrouter.ai/api/v1` |
| `OPENAI_API_KEY` | ✅ | Set to `${OPENROUTER_API_KEY}` (LiteLLM uses this) |
| `PQA_LLM` | ✅ | Main answer model (e.g. `openrouter/anthropic/claude-3.5-sonnet`) |
| `PQA_SUMMARY_LLM` | ✅ | Summarization model — called many times per query, keep cheap |
| `PQA_HOME` | ✅ | Set to `/app/pqa_data` — where the index is stored |
| `PAPER_DIR` | ✅ | Set to `/app/papers` — where PDFs are read from |
| `SEMANTIC_SCHOLAR_API_KEY` | optional | Recommended for libraries of 100+ papers |
| `CROSSREF_API_KEY` | optional | Improves citation metadata quality |

---

## 15. Useful Commands

### Container management

```bash
# Start
docker compose -f ~/paperqa/docker-compose.yml up -d

# Stop
docker compose -f ~/paperqa/docker-compose.yml down

# Restart
docker compose -f ~/paperqa/docker-compose.yml restart paperqa

# Live logs
docker compose -f ~/paperqa/docker-compose.yml logs -f paperqa

# Resource usage
docker stats paperqa

# Shell inside container
docker compose -f ~/paperqa/docker-compose.yml exec paperqa bash
```

### CLI inside the container

```bash
docker compose exec paperqa bash
pqa ask 'What are the main findings in the papers?'
pqa -s fast ask 'Quick summary'
pqa -s high_quality ask 'Detailed analysis'
pqa view    # show all current settings
```

### API quick tests

```bash
# Health check
curl https://researchai.umarsyukri.com/health

# List papers
curl https://researchai.umarsyukri.com/papers

# Upload a paper
curl -X POST https://researchai.umarsyukri.com/upload -F "file=@paper.pdf"

# Ask a question (allow up to 2 minutes)
curl -X POST https://researchai.umarsyukri.com/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "your question here"}' \
  --max-time 120
```

### Nginx

```bash
sudo nginx -t                          # test config
sudo systemctl reload nginx            # reload without downtime
sudo tail -f /var/log/nginx/error.log  # live error log
sudo certbot certificates              # list certs and expiry dates
```

---

## 16. Roadmap

- [x] Deploy PaperQA2 as a Docker container
- [x] Expose REST API via FastAPI (`/health`, `/papers`, `/upload`, `/ask`)
- [x] Configure OpenRouter as the LLM provider
- [x] Set up `researchai.umarsyukri.com` with TLS via Let's Encrypt
- [x] Persist index and papers across container restarts via volume mounts
- [ ] Build Next.js frontend UI (`researchai-app.umarsyukri.com`)
- [ ] Add basic API key auth to protect the endpoints
- [ ] Add Semantic Scholar + Crossref API keys for richer metadata
- [ ] Set up a cron job to auto-ingest papers from a watched folder
- [ ] Explore local embedding models to reduce OpenRouter costs

---

*Self-hosted on `srv1344902` · Ubuntu 24.04 · Docker · Nginx · Let's Encrypt*
*Powered by [PaperQA2](https://github.com/Future-House/paper-qa) by FutureHouse*
