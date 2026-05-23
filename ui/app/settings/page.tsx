"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Save,
  FlaskConical,
  Zap,
  Server,
  Cpu,
  FolderOpen,
  BookMarked,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────── */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://researchai.umarsyukri.com";

const MODEL_OPTIONS = [
  {
    value: "openrouter/anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    provider: "Anthropic",
  },
  {
    value: "openrouter/openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
  },
  {
    value: "openrouter/openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
  },
  {
    value: "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    label: "Llama 3.3 70B",
    provider: "Meta · Free",
  },
];

const LS_KEY = "researchai_settings";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */
interface HealthData {
  status: string;
  llm: string;
  summary_llm: string;
  papers_dir: string;
}

type ConnStatus = "idle" | "testing" | "ok" | "error";

/* ─────────────────────────────────────────────────────────
   Small sub-components
───────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="section-label">{children}</span>;
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="field-label">
      {children}
    </label>
  );
}

function ReadonlyField({
  value,
  href,
  ariaLabel,
}: {
  value: string;
  href?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="readonly-field">
      <span className="readonly-field__value">{value}</span>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="readonly-field__link"
          aria-label={ariaLabel}
        >
          <ExternalLink size={12} />
        </a>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ConnStatus }) {
  if (status === "testing") {
    return (
      <span className="badge badge--testing" role="status" aria-label="Testing connection">
        <Loader2 size={12} className="badge__spin" />
        Testing…
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="badge badge--ok" role="status">
        <CheckCircle2 size={12} />
        Connected
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="badge badge--error" role="status">
        <XCircle size={12} />
        Unreachable
      </span>
    );
  }
  return null;
}

function ModelInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  // Shorten the model string for display
  const short = value.replace(/^openrouter\//, "");
  return (
    <div className="model-info-row">
      <div className="model-info-row__icon">{icon}</div>
      <div className="model-info-row__body">
        <span className="model-info-row__label">{label}</span>
        <span
          className="model-info-row__value"
          title={value}
        >
          {short}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function SettingsPage() {
  /* ── Connection state ──────────────────────────── */
  const [connStatus, setConnStatus] = useState<ConnStatus>("idle");
  const [health, setHealth] = useState<HealthData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── Model preferences ─────────────────────────── */
  const [answerModel, setAnswerModel] = useState(MODEL_OPTIONS[0].value);
  const [summaryModel, setSummaryModel] = useState(MODEL_OPTIONS[2].value);
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Load from localStorage on mount ──────────── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.answerModel) setAnswerModel(s.answerModel);
        if (s.summaryModel) setSummaryModel(s.summaryModel);
      }
    } catch {
      /* ignore corrupt data */
    }
  }, []);

  /* ── Cleanup ────────────────────────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  /* ── Test connection ───────────────────────────── */
  const testConnection = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setConnStatus("testing");
    setHealth(null);

    try {
      const res = await fetch(`${API_BASE}/health`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthData = await res.json();
      setHealth(data);
      setConnStatus("ok");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setConnStatus("error");
    }
  };

  /* ── Save preferences ──────────────────────────── */
  const savePreferences = () => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ answerModel, summaryModel })
      );
      setSaved(true);
      toast.success("Preferences saved");
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error("Failed to save — localStorage may be unavailable");
    }
  };

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="settings-page">
      <div className="settings-inner">

        {/* ── Page header ─────────────────────────── */}
        <header className="page-header animate-fade-in-up">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Manage connection details, model preferences, and system information.
          </p>
        </header>

        {/* ══════════════════════════════════════════
            SECTION 1 — Connection
        ══════════════════════════════════════════ */}
        <Card
          className="settings-card animate-fade-in-up"
          style={{ animationDelay: "0.05s" }}
        >
          <CardHeader className="settings-card__header">
            <div className="settings-card__title-row">
              <Server size={14} className="settings-card__icon" />
              <CardTitle>
                <SectionLabel>Connection</SectionLabel>
              </CardTitle>
            </div>
            <CardDescription className="settings-card__desc">
              Backend API endpoint and live health status.
            </CardDescription>
          </CardHeader>

          <CardContent className="settings-card__body">
            {/* API URL */}
            <div className="field-group">
              <FieldLabel htmlFor="api-url">API Endpoint</FieldLabel>
              <ReadonlyField
                value={API_BASE}
                href={`${API_BASE}/health`}
                ariaLabel="Open health endpoint in new tab"
              />
            </div>

            {/* Test button + badge */}
            <div className="conn-row">
              <button
                id="test-connection-btn"
                className="btn-outline"
                onClick={testConnection}
                disabled={connStatus === "testing"}
                aria-busy={connStatus === "testing"}
              >
                {connStatus === "testing" ? (
                  <Loader2 size={13} className="btn-spin" />
                ) : (
                  <Zap size={13} />
                )}
                {connStatus === "testing" ? "Testing…" : "Test connection"}
              </button>

              <StatusBadge status={connStatus} />
            </div>

            {/* Health info card — shown after successful test */}
            {health && connStatus === "ok" && (
              <div className="health-card animate-fade-in-up">
                <ModelInfoRow
                  icon={<Cpu size={13} />}
                  label="Answer model"
                  value={health.llm}
                />
                <Separator className="health-sep" />
                <ModelInfoRow
                  icon={<Zap size={13} />}
                  label="Summary model"
                  value={health.summary_llm}
                />
                <Separator className="health-sep" />
                <ModelInfoRow
                  icon={<FolderOpen size={13} />}
                  label="Papers directory"
                  value={health.papers_dir}
                />
              </div>
            )}

            {/* Error hint */}
            {connStatus === "error" && (
              <p className="error-hint animate-fade-in">
                Could not reach{" "}
                <code className="inline-code">{API_BASE}</code>. Check that the
                Docker container is running and the subdomain is reachable.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════
            SECTION 2 — Model Defaults
        ══════════════════════════════════════════ */}
        <Card
          className="settings-card animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <CardHeader className="settings-card__header">
            <div className="settings-card__title-row">
              <BookMarked size={14} className="settings-card__icon" />
              <CardTitle>
                <SectionLabel>Model Defaults</SectionLabel>
              </CardTitle>
            </div>
            <CardDescription className="settings-card__desc">
              Local overrides used as defaults on the Ask page.
            </CardDescription>
          </CardHeader>

          <CardContent className="settings-card__body">
            {/* Answer model */}
            <div className="field-group">
              <FieldLabel htmlFor="answer-model">Answer model</FieldLabel>
              <select
                id="answer-model"
                className="model-select"
                value={answerModel}
                onChange={(e) => setAnswerModel(e.target.value)}
                aria-label="Default answer model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.provider}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Used for generating the final cited answer.
              </p>
            </div>

            {/* Summary model */}
            <div className="field-group">
              <FieldLabel htmlFor="summary-model">Summary model</FieldLabel>
              <select
                id="summary-model"
                className="model-select"
                value={summaryModel}
                onChange={(e) => setSummaryModel(e.target.value)}
                aria-label="Default summary model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.provider}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Called many times per query — keep this a cheaper model.
              </p>
            </div>

            {/* Note */}
            <div className="model-note">
              <ShieldCheck size={13} className="model-note__icon" />
              <p className="model-note__text">
                These are saved locally and used as defaults on the Ask page.
                The actual model used depends on your server{" "}
                <code className="inline-code">.env</code> configuration.
              </p>
            </div>
          </CardContent>

          <CardFooter className="settings-card__footer">
            <button
              className={`btn-save ${saved ? "btn-save--saved" : ""}`}
              onClick={savePreferences}
              aria-label="Save model preferences to local storage"
            >
              {saved ? (
                <>
                  <CheckCircle2 size={13} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save preferences
                </>
              )}
            </button>
          </CardFooter>
        </Card>

        {/* ══════════════════════════════════════════
            SECTION 3 — About
        ══════════════════════════════════════════ */}
        <Card
          className="settings-card animate-fade-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <CardHeader className="settings-card__header">
            <div className="settings-card__title-row">
              <FlaskConical size={14} className="settings-card__icon" />
              <CardTitle>
                <SectionLabel>About</SectionLabel>
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="settings-card__body">
            {/* Logo row */}
            <div className="about-logo">
              <div className="about-logo__icon">
                <FlaskConical size={22} strokeWidth={1.5} />
              </div>
              <div className="about-logo__body">
                <span className="about-logo__name">ResearchAI</span>
                <span className="about-logo__sub">
                  Self-hosted scientific Q&amp;A
                </span>
              </div>
            </div>

            <Separator className="about-sep" />

            {/* Description */}
            <p className="about-desc">
              Powered by{" "}
              <a
                href="https://github.com/Future-House/paper-qa"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                PaperQA2
              </a>{" "}
              by FutureHouse — a retrieval-augmented generation engine for
              scientific literature. Answers are grounded in your local paper
              library with proper inline citations and source references.
            </p>

            {/* Badge row */}
            <div className="about-badges">
              <a
                href="https://github.com/Future-House/paper-qa"
                target="_blank"
                rel="noopener noreferrer"
                className="about-badge about-badge--link"
                aria-label="PaperQA2 GitHub repository"
              >
                <ExternalLink size={11} />
                paper-qa on GitHub
              </a>

              <span className="about-badge">
                <span className="about-badge__dot" />
                {API_BASE.replace(/^https?:\/\//, "")}
              </span>

              <span className="about-badge about-badge--version">
                PaperQA2 ≥ 5
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* ══ Styles ════════════════════════════════════════ */}
      <style jsx>{`
        /* ── Page shell ─────────────────────────────── */
        .settings-page {
          padding: 2.5rem 2rem 4rem;
          min-height: 100vh;
        }

        .settings-inner {
          max-width: 640px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* ── Header ─────────────────────────────────── */
        .page-title {
          font-family: var(--font-serif);
          font-size: 26px;
          font-weight: 700;
          color: var(--text);
          margin-bottom: 0.25rem;
        }

        .page-subtitle {
          color: var(--muted);
          font-size: 13px;
        }

        /* ── Card overrides ──────────────────────────── */
        :global(.settings-card) {
          background: var(--surface) !important;
          border: 1px solid var(--border) !important;
          border-radius: 12px !important;
          box-shadow: none !important;
          gap: 0 !important;
          padding: 0 !important;
          /* shadcn uses ring, override: */
          ring: none;
        }

        :global(.settings-card__header) {
          padding: 0.9rem 1.25rem !important;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: 12px 12px 0 0;
          gap: 0.25rem !important;
        }

        :global(.settings-card__title-row) {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        :global(.settings-card__icon) {
          color: var(--muted);
          flex-shrink: 0;
        }

        :global(.settings-card__desc) {
          font-size: 12px !important;
          color: var(--muted) !important;
          margin-top: 0.1rem;
          padding-left: 1.4rem; /* align under title */
        }

        :global(.settings-card__body) {
          padding: 1.25rem !important;
          display: flex;
          flex-direction: column;
          gap: 1.1rem;
        }

        :global(.settings-card__footer) {
          padding: 0.85rem 1.25rem !important;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: 0 0 12px 12px;
        }

        /* Section label */
        .section-label {
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          font-weight: 600;
        }

        /* ── Field group ─────────────────────────────── */
        .field-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .field-label {
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }

        .field-hint {
          font-size: 11px;
          color: var(--muted);
          opacity: 0.7;
          line-height: 1.5;
        }

        /* ── Readonly field ──────────────────────────── */
        .readonly-field {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.5rem 0.8rem;
        }

        .readonly-field__value {
          flex: 1;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text);
          word-break: break-all;
        }

        .readonly-field__link {
          flex-shrink: 0;
          color: var(--muted);
          display: flex;
          align-items: center;
          padding: 2px;
          border-radius: 4px;
          transition: color 150ms ease, background 150ms ease;
        }

        .readonly-field__link:hover {
          color: var(--accent);
          background: var(--accent-dim);
        }

        /* ── Connection row ──────────────────────────── */
        .conn-row {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex-wrap: wrap;
        }

        /* ── Status badges ───────────────────────────── */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          border-radius: 999px;
          padding: 0.28rem 0.75rem;
          border: 1px solid transparent;
        }

        .badge--testing {
          color: var(--accent);
          background: var(--accent-dim);
          border-color: rgba(212, 168, 71, 0.25);
        }

        .badge--ok {
          color: var(--success);
          background: rgba(63, 185, 80, 0.08);
          border-color: rgba(63, 185, 80, 0.25);
          animation: fadeIn 0.3s ease;
        }

        .badge--error {
          color: var(--danger);
          background: rgba(248, 81, 73, 0.08);
          border-color: rgba(248, 81, 73, 0.25);
          animation: fadeIn 0.3s ease;
        }

        .badge__spin {
          animation: spin-slow 0.8s linear infinite;
        }

        /* ── Health info card ─────────────────────────── */
        .health-card {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 9px;
          overflow: hidden;
        }

        .model-info-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.65rem 0.9rem;
        }

        .model-info-row__icon {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--muted);
        }

        .model-info-row__body {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .model-info-row__label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          font-family: var(--font-mono);
        }

        .model-info-row__value {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        :global(.health-sep) {
          background-color: var(--border) !important;
          height: 1px !important;
        }

        /* ── Error hint ──────────────────────────────── */
        .error-hint {
          font-size: 12px;
          color: var(--danger);
          line-height: 1.65;
          background: rgba(248, 81, 73, 0.05);
          border: 1px solid rgba(248, 81, 73, 0.18);
          border-radius: 7px;
          padding: 0.65rem 0.9rem;
        }

        /* ── Buttons ─────────────────────────────────── */
        .btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 1rem;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 12px;
          cursor: pointer;
          transition:
            border-color 150ms ease,
            background 150ms ease,
            color 150ms ease;
          white-space: nowrap;
        }

        .btn-outline:hover:not(:disabled) {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-dim);
        }

        .btn-outline:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-spin {
          animation: spin-slow 0.8s linear infinite;
        }

        .btn-save {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 1.1rem;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: #0d1117;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition:
            background 150ms ease,
            box-shadow 150ms ease,
            transform 100ms ease;
        }

        .btn-save:hover {
          background: var(--accent-hover);
          box-shadow: 0 3px 14px var(--accent-glow);
          transform: translateY(-1px);
        }

        .btn-save:active {
          transform: translateY(0);
        }

        .btn-save--saved {
          background: var(--success);
          box-shadow: 0 3px 14px rgba(63, 185, 80, 0.3);
        }

        .btn-save--saved:hover {
          background: var(--success);
        }

        /* ── Model select ─────────────────────────────── */
        .model-select {
          width: 100%;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 0.5rem 0.75rem;
          outline: none;
          cursor: pointer;
          transition: border-color 150ms ease;
          appearance: auto;
        }

        .model-select:focus,
        .model-select:hover {
          border-color: rgba(212, 168, 71, 0.4);
        }

        /* ── Model note ──────────────────────────────── */
        .model-note {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.7rem 0.9rem;
        }

        .model-note__icon {
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--muted);
        }

        .model-note__text {
          font-size: 12px;
          color: var(--muted);
          line-height: 1.65;
        }

        .inline-code {
          display: inline;
          background: rgba(212, 168, 71, 0.1);
          border: 1px solid rgba(212, 168, 71, 0.2);
          border-radius: 4px;
          padding: 1px 5px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--accent);
        }

        /* ── About section ───────────────────────────── */
        .about-logo {
          display: flex;
          align-items: center;
          gap: 0.9rem;
        }

        .about-logo__icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          border-radius: 12px;
          background: var(--accent-dim);
          border: 1px solid rgba(212, 168, 71, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .about-logo__body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .about-logo__name {
          font-family: var(--font-serif);
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .about-logo__sub {
          font-size: 12px;
          color: var(--muted);
          font-family: var(--font-mono);
        }

        :global(.about-sep) {
          background-color: var(--border) !important;
          height: 1px !important;
          margin: 0 !important;
        }

        .about-desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.75;
        }

        .about-link {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid rgba(212, 168, 71, 0.3);
          transition: color 150ms ease, border-color 150ms ease;
        }

        .about-link:hover {
          color: var(--accent-hover);
          border-bottom-color: var(--accent-hover);
        }

        .about-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .about-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 3px 10px;
          white-space: nowrap;
        }

        .about-badge--link {
          text-decoration: none;
          transition:
            color 150ms ease,
            border-color 150ms ease,
            background 150ms ease;
        }

        .about-badge--link:hover {
          color: var(--accent);
          border-color: rgba(212, 168, 71, 0.3);
          background: var(--accent-dim);
        }

        .about-badge__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--success);
          animation: pulse-dot 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .about-badge--version {
          color: var(--accent);
          background: var(--accent-dim);
          border-color: rgba(212, 168, 71, 0.2);
        }

        /* ── Responsive ──────────────────────────────── */
        @media (max-width: 768px) {
          .settings-page {
            padding: 1.25rem 1rem 5rem;
          }
        }

        @media (max-width: 480px) {
          .conn-row {
            flex-direction: column;
            align-items: flex-start;
          }

          .about-badges {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
