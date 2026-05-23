"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Clock,
  Trash2,
  MessageSquareQuote,
  BookOpenText,
  CornerDownLeft,
  AlertTriangle,
  TimerOff,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────
   Constants & Types
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

const LOADING_STAGES = [
  { text: "Searching papers…", pct: 20 },
  { text: "Gathering evidence…", pct: 55 },
  { text: "Synthesizing answer…", pct: 85 },
  { text: "Formatting citations…", pct: 95 },
];

interface QAPair {
  id: string;
  question: string;
  answer: string;
  references: string;
  model: string;
  timestamp: Date;
}

type ErrorKind = "api" | "timeout" | null;

interface AskError {
  kind: ErrorKind;
  message: string;
}

/* ─────────────────────────────────────────────────────────
   Utility helpers
───────────────────────────────────────────────────────── */
function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function modelShortLabel(val: string) {
  return MODEL_OPTIONS.find((m) => m.value === val)?.label ?? val;
}

/* ─────────────────────────────────────────────────────────
   Copy button with transient "Copied!" feedback
───────────────────────────────────────────────────────── */
function CopyButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button className="action-btn" onClick={handleCopy} aria-label={`Copy ${label}`}>
      {copied ? (
        <Check size={12} style={{ color: "var(--success)" }} />
      ) : (
        <Copy size={12} />
      )}
      {copied ? "Copied!" : label}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────
   Markdown renderer components
───────────────────────────────────────────────────────── */
const mdComponents: Components = {
  // Paragraphs
  p: ({ children }) => <p className="md-p">{children}</p>,

  // Bold
  strong: ({ children }) => (
    <strong className="md-strong">{children}</strong>
  ),

  // Italic
  em: ({ children }) => <em className="md-em">{children}</em>,

  // Inline code — detect citation pattern like [1], [2]
  code: ({ children, className }) => {
    // Block code from fenced blocks has a className like "language-*"
    if (className) {
      return <code className={`md-code-block-inner ${className}`}>{children}</code>;
    }
    // Inline code
    return <code className="md-code-inline">{children}</code>;
  },

  // Fenced code block
  pre: ({ children }) => (
    <pre className="md-pre">{children}</pre>
  ),

  // Headings — use serif for h1/h2
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,

  // Lists
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,

  // Blockquote
  blockquote: ({ children }) => (
    <blockquote className="md-blockquote">{children}</blockquote>
  ),

  // Superscript — citations like ^1^
  sup: ({ children }) => <sup className="md-sup">{children}</sup>,
};

/* ─────────────────────────────────────────────────────────
   Loading indicator component
───────────────────────────────────────────────────────── */
function ResearchingIndicator({ stage }: { stage: number }) {
  const current = LOADING_STAGES[stage] ?? LOADING_STAGES[0];
  return (
    <div className="researching-wrap" aria-live="polite" role="status">
      {/* Stage dots */}
      <div className="stage-dots">
        {LOADING_STAGES.map((_, i) => (
          <span
            key={i}
            className={`stage-dot ${i <= stage ? "stage-dot--active" : ""}`}
          />
        ))}
      </div>

      {/* Animated spinner + text */}
      <div className="researching-row">
        <span className="researching-spinner" aria-hidden="true" />
        <span className="researching-text">{current.text}</span>
      </div>

      {/* Progress bar */}
      <div className="researching-bar">
        <div
          className="researching-bar-fill"
          style={{ width: `${current.pct}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Answer card component
───────────────────────────────────────────────────────── */
function AnswerCard({
  pair,
  onFollowUp,
}: {
  pair: QAPair;
  onFollowUp: (q: string) => void;
}) {
  const [refsOpen, setRefsOpen] = useState(false);

  return (
    <article className="answer-card animate-fade-in-up" aria-label="Research answer">
      {/* Question echo */}
      <div className="answer-card__question">
        <MessageSquareQuote size={14} aria-hidden="true" />
        <span>{pair.question}</span>
        <span className="answer-card__model">{modelShortLabel(pair.model)}</span>
      </div>

      {/* Answer body */}
      <div className="answer-card__body">
        <div className="prose-answer">
          <ReactMarkdown components={mdComponents}>
            {pair.answer}
          </ReactMarkdown>
        </div>
      </div>

      {/* References */}
      {pair.references && (
        <div className="refs-section">
          <button
            className="refs-toggle"
            onClick={() => setRefsOpen((p) => !p)}
            aria-expanded={refsOpen}
            aria-controls="refs-content"
          >
            <BookOpenText size={13} aria-hidden="true" />
            References
            <span className="refs-toggle__chevron">
              {refsOpen ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
            </span>
          </button>

          {refsOpen && (
            <div
              id="refs-content"
              className="refs-content animate-fade-in"
            >
              {pair.references.split("\n").filter(Boolean).map((line, i) => (
                <p key={i} className="refs-line">{line}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="answer-card__actions">
        <CopyButton text={pair.answer} label="Copy answer" />
        {pair.references && (
          <CopyButton text={pair.references} label="Copy refs" />
        )}
        <button
          className="action-btn action-btn--followup"
          onClick={() => onFollowUp("Following up on the above: ")}
        >
          <CornerDownLeft size={12} />
          Ask follow-up
        </button>
      </div>
    </article>
  );
}

/* ─────────────────────────────────────────────────────────
   Inline error card
───────────────────────────────────────────────────────── */
function ErrorCard({
  error,
  onRetry,
}: {
  error: AskError;
  onRetry: () => void;
}) {
  const isTimeout = error.kind === "timeout";
  return (
    <div
      className="error-card animate-fade-in-up"
      role="alert"
      aria-live="assertive"
    >
      <div className="error-card__icon">
        {isTimeout ? (
          <TimerOff size={18} strokeWidth={1.5} />
        ) : (
          <AlertTriangle size={18} strokeWidth={1.5} />
        )}
      </div>

      <div className="error-card__body">
        <p className="error-card__title">
          {isTimeout ? "Request timed out" : "Something went wrong"}
        </p>
        <p className="error-card__msg">{error.message}</p>

        <div className="error-card__actions">
          <button
            className="error-retry-btn"
            onClick={onRetry}
            aria-label="Retry the last question"
          >
            <RefreshCw size={13} />
            Try again
          </button>

          {!isTimeout && (
            <Link href="/papers" className="error-papers-link">
              <BookOpen size={13} />
              Go to Papers page
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}


function HistoryCard({ pair, index }: { pair: QAPair; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="history-card animate-fade-in-up"
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <button
        className="history-card__header"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
      >
        <span className="history-card__q">{pair.question}</span>
        <div className="history-card__meta">
          <Clock size={11} aria-hidden="true" />
          <span>{formatTime(pair.timestamp)}</span>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {open && (
        <div className="history-card__body animate-fade-in">
          <div className="prose-answer prose-answer--compact">
            <ReactMarkdown components={mdComponents}>
              {pair.answer}
            </ReactMarkdown>
          </div>
          {pair.references && (
            <details className="history-refs">
              <summary className="history-refs__toggle">References</summary>
              <pre className="history-refs__text">{pair.references}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────── */
export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [current, setCurrent] = useState<QAPair | null>(null);
  const [history, setHistory] = useState<QAPair[]>([]);
  const [askError, setAskError] = useState<AskError | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [, startTransition] = useTransition();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stageIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── auto-resize textarea ──────────────────────── */
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [question, resize]);

  /* ── keyboard shortcut ─────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, model, loading]);

  /* ── cleanup on unmount ────────────────────────── */
  useEffect(() => {
    return () => {
      if (stageIntervalRef.current) clearInterval(stageIntervalRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /* ── submit ────────────────────────────────────── */
  const submit = async (overrideQ?: string) => {
    const q = (overrideQ ?? question).trim();
    if (!q || loading) return;

    setLoading(true);
    setLoadingStage(0);
    setAskError(null);
    setLastQuestion(q);

    // Cycle through loading stages every 4 s
    stageIntervalRef.current = setInterval(() => {
      setLoadingStage((s) => Math.min(s + 1, LOADING_STAGES.length - 1));
    }, 4000);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, llm: model }),
        signal: AbortSignal.timeout(135_000),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.detail ?? `Server error ${res.status}`;
        setAskError({ kind: "api", message: msg });
        return;
      }

      const data = await res.json();
      const pair: QAPair = {
        id: crypto.randomUUID(),
        question: q,
        answer: data.answer ?? "",
        references: data.references ?? "",
        model,
        timestamp: new Date(),
      };

      startTransition(() => {
        if (current) {
          setHistory((h) => [current, ...h].slice(0, 9));
        }
        setCurrent(pair);
        setAskError(null);
        setQuestion("");
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (err instanceof Error) {
        const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
        setAskError({
          kind: isTimeout ? "timeout" : "api",
          message: isTimeout
            ? "The request took longer than 2 minutes. The server may be indexing papers or under load."
            : err.message,
        });
      } else {
        setAskError({ kind: "api", message: "Unexpected error. Please try again." });
      }
    } finally {
      setLoading(false);
      setLoadingStage(0);
      if (stageIntervalRef.current) {
        clearInterval(stageIntervalRef.current);
        stageIntervalRef.current = null;
      }
    }
  };

  const retry = () => submit(lastQuestion);


  const handleFollowUp = (prefix: string) => {
    setQuestion(prefix);
    setAskError(null);
    textareaRef.current?.focus();
    setTimeout(resize, 10);
  };

  const clearHistory = () => {
    setHistory([]);
    setCurrent(null);
    setAskError(null);
    toast.success("History cleared");
  };

  const isEmpty = !current && !loading && !askError && history.length === 0;

  /* ── render ────────────────────────────────────── */
  return (
    <div className="ask-page">
      <div className="ask-inner">

        {/* ══ INPUT SECTION ════════════════════════════ */}
        <section
          className="input-section animate-fade-in-up"
          aria-label="Ask a research question"
        >
          {/* Textarea */}
          <div className="textarea-wrap">
            <textarea
              ref={textareaRef}
              id="research-question"
              className="research-textarea"
              placeholder="Ask anything about your papers…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onInput={resize}
              rows={3}
              aria-label="Research question"
              aria-describedby="submit-hint"
            />
          </div>

          {/* Toolbar */}
          <div className="toolbar">
            {/* Model selector */}
            <div className="model-selector">
              <label htmlFor="model-select" className="sr-only">
                Select language model
              </label>
              <select
                id="model-select"
                className="model-select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                aria-label="Language model"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} — {m.provider}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit / loading */}
            {loading ? (
              <ResearchingIndicator stage={loadingStage} />
            ) : (
              <button
                className="submit-btn"
                onClick={submit}
                disabled={!question.trim()}
                aria-label="Ask question (⌘↵)"
              >
                <span>Ask</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Keyboard hint */}
          <p id="submit-hint" className="submit-hint" aria-live="polite">
            {loading ? (
              <span>Processing — this may take up to 2 minutes</span>
            ) : (
              <span>
                <kbd>⌘</kbd><kbd>↵</kbd> to submit
              </span>
            )}
          </p>
        </section>

        {/* ══ EMPTY STATE ══════════════════════════════ */}
        {isEmpty && (
          <div className="empty-state animate-fade-in" aria-label="No questions asked yet">
            <div className="empty-quote" aria-hidden="true">&ldquo;</div>
            <p className="empty-title">Start by uploading papers, then ask your first question.</p>
            <div className="empty-shortcuts" aria-label="Keyboard shortcuts">
              <kbd>⌘↵</kbd>
              <span>to submit</span>
            </div>
          </div>
        )}

        {/* ══ INLINE ERROR ══════════════════════════════ */}
        {askError && !loading && (
          <ErrorCard error={askError} onRetry={retry} />
        )}

        {/* ══ CURRENT ANSWER ═══════════════════════════ */}
        {current && (
          <AnswerCard
            pair={current}
            onFollowUp={handleFollowUp}
          />
        )}

        {/* ══ HISTORY ══════════════════════════════════ */}
        {history.length > 0 && (
          <section className="history-section" aria-label="Question history">
            <div className="history-header">
              <span className="history-label">Previous questions</span>
              <button
                className="clear-btn"
                onClick={clearHistory}
                aria-label="Clear question history"
              >
                <Trash2 size={12} />
                Clear history
              </button>
            </div>

            <div className="history-list">
              {history.map((pair, i) => (
                <HistoryCard key={pair.id} pair={pair} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ══ STYLES ══════════════════════════════════════ */}
      <style jsx>{`
        /* ── Page shell ─────────────────────────────── */
        .ask-page {
          padding: 2.5rem 2rem 4rem;
          min-height: 100vh;
        }

        .ask-inner {
          max-width: 780px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
        }

        /* ── Input section ──────────────────────────── */
        .input-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          transition: box-shadow 200ms ease, border-color 200ms ease;
        }

        .input-section:focus-within {
          border-color: rgba(212, 168, 71, 0.4);
          box-shadow: 0 0 0 3px rgba(212, 168, 71, 0.08);
        }

        .textarea-wrap {
          padding: 1.25rem 1.25rem 0.5rem;
        }

        .research-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          color: var(--text);
          font-family: var(--font-serif);
          font-size: 17px;
          font-style: italic;
          line-height: 1.65;
          min-height: 80px;
          overflow: hidden;
          caret-color: var(--accent);
        }

        .research-textarea::placeholder {
          color: var(--muted);
          opacity: 0.7;
        }

        .research-textarea:not(:placeholder-shown) {
          font-style: normal;
        }

        /* Toolbar */
        .toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
          flex-wrap: wrap;
        }

        /* Model select */
        .model-selector {
          flex: 1;
          min-width: 180px;
          max-width: 280px;
        }

        .model-select {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 12px;
          padding: 0.4rem 0.65rem;
          cursor: pointer;
          outline: none;
          transition: border-color 150ms ease, color 150ms ease;
          appearance: auto;
        }

        .model-select:focus,
        .model-select:hover {
          border-color: rgba(212, 168, 71, 0.4);
          color: var(--text);
        }

        /* Submit button */
        .submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.52rem 1.2rem;
          background: var(--accent);
          color: #0d1117;
          border: none;
          border-radius: 8px;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition:
            background 150ms ease,
            box-shadow 150ms ease,
            transform 100ms ease;
          white-space: nowrap;
        }

        .submit-btn:hover:not(:disabled) {
          background: var(--accent-hover);
          box-shadow: 0 4px 18px var(--accent-glow);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          transform: none;
        }

        /* Keyboard hint */
        .submit-hint {
          padding: 0.4rem 1.25rem 0.6rem;
          font-size: 11px;
          color: var(--muted);
          opacity: 0.55;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .submit-hint kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 5px;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--muted);
          margin-right: 1px;
        }

        /* ── Researching indicator ──────────────────── */
        .researching-wrap {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 220px;
        }

        .stage-dots {
          display: flex;
          gap: 5px;
          align-items: center;
        }

        .stage-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--border);
          transition: background 400ms ease, transform 400ms ease;
        }

        .stage-dot--active {
          background: var(--accent);
          transform: scale(1.2);
        }

        .researching-row {
          display: flex;
          align-items: center;
          gap: 0.55rem;
        }

        .researching-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(212, 168, 71, 0.2);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin-slow 0.75s linear infinite;
          flex-shrink: 0;
        }

        .researching-text {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--accent);
          animation: fadeIn 0.4s ease;
        }

        .researching-bar {
          height: 2px;
          background: rgba(212, 168, 71, 0.12);
          border-radius: 1px;
          overflow: hidden;
        }

        .researching-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 1px;
          transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ── Empty state ─────────────────────────────── */
        .empty-state {
          text-align: center;
          padding: 5rem 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.9rem;
          user-select: none;
        }

        .empty-quote {
          font-family: var(--font-serif);
          font-size: 130px;
          line-height: 0.8;
          color: var(--accent);
          opacity: 0.06;
          pointer-events: none;
          margin-bottom: 0.5rem;
        }

        .empty-title {
          font-family: var(--font-serif);
          font-size: 18px;
          color: var(--text);
          opacity: 0.7;
        }

        .empty-body {
          font-size: 13px;
          color: var(--muted);
          max-width: 300px;
          line-height: 1.7;
        }

        .empty-link {
          color: var(--accent);
          text-decoration: none;
          border-bottom: 1px solid rgba(212, 168, 71, 0.3);
        }

        .empty-link:hover {
          color: var(--accent-hover);
          border-bottom-color: var(--accent-hover);
        }

        .empty-shortcuts {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 11px;
          color: var(--muted);
          opacity: 0.5;
          margin-top: 0.5rem;
        }

        .empty-shortcuts kbd {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 2px 7px;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
        }

        /* ── Error card ──────────────────────────────── */
        :global(.error-card) {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem 1.25rem;
          background: rgba(248, 81, 73, 0.05);
          border: 1px solid rgba(248, 81, 73, 0.22);
          border-left: 3px solid var(--danger);
          border-radius: 12px;
          overflow: hidden;
        }

        :global(.error-card__icon) {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: rgba(248, 81, 73, 0.1);
          border: 1px solid rgba(248, 81, 73, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--danger);
        }

        :global(.error-card__body) {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        :global(.error-card__title) {
          font-size: 14px;
          font-weight: 600;
          color: var(--danger);
          font-family: var(--font-mono);
        }

        :global(.error-card__msg) {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.65;
        }

        :global(.error-card__actions) {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-top: 0.25rem;
          flex-wrap: wrap;
        }

        :global(.error-retry-btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.85rem;
          background: var(--accent);
          color: #0d1117;
          border: none;
          border-radius: 7px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 150ms ease, box-shadow 150ms ease;
        }

        :global(.error-retry-btn:hover) {
          background: var(--accent-hover);
          box-shadow: 0 3px 12px var(--accent-glow);
        }

        :global(.error-papers-link) {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.38rem 0.85rem;
          border: 1px solid rgba(248, 81, 73, 0.3);
          border-radius: 7px;
          color: var(--danger);
          font-family: var(--font-mono);
          font-size: 12px;
          text-decoration: none;
          transition: background 150ms ease, border-color 150ms ease;
        }

        :global(.error-papers-link:hover) {
          background: rgba(248, 81, 73, 0.06);
          border-color: rgba(248, 81, 73, 0.5);
          color: var(--danger);
        }

        /* ── Answer card ─────────────────────────────── */
        :global(.answer-card) {
          background: var(--surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: 12px;
          overflow: hidden;
        }


        :global(.answer-card__question) {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          font-size: 13px;
          color: var(--muted);
          line-height: 1.5;
        }

        :global(.answer-card__question span:first-of-type) {
          flex: 1;
        }

        :global(.answer-card__model) {
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--accent);
          background: var(--accent-dim);
          border: 1px solid rgba(212, 168, 71, 0.22);
          border-radius: 999px;
          padding: 2px 8px;
          white-space: nowrap;
          align-self: flex-start;
        }

        :global(.answer-card__body) {
          padding: 1.75rem 1.75rem 1.25rem;
        }

        /* ── Prose styles ─────────────────────────────── */
        :global(.prose-answer) {
          font-size: 15px;
          line-height: 1.9;
          color: var(--text);
          max-width: 68ch;
        }

        :global(.prose-answer--compact) {
          font-size: 13px;
          line-height: 1.75;
          max-width: none;
        }

        :global(.md-p) {
          margin-bottom: 1.1em;
        }

        :global(.md-p:last-child) {
          margin-bottom: 0;
        }

        :global(.md-strong) {
          color: var(--text);
          font-weight: 650;
        }

        :global(.md-em) {
          font-style: italic;
          color: var(--muted);
        }

        :global(.md-code-inline) {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 6px;
          font-family: var(--font-mono);
          font-size: 0.875em;
          color: var(--accent);
        }

        :global(.md-pre) {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1.1rem 1.25rem;
          overflow-x: auto;
          margin: 1.2em 0;
          font-family: var(--font-mono);
          font-size: 13px;
          line-height: 1.65;
          color: var(--text);
        }

        :global(.md-code-block-inner) {
          font-family: var(--font-mono);
          font-size: 13px;
          background: none;
          border: none;
          padding: 0;
          color: var(--text);
        }

        :global(.md-h1) {
          font-family: var(--font-serif);
          font-size: 22px;
          font-weight: 700;
          margin: 1.5em 0 0.5em;
          color: var(--text);
        }

        :global(.md-h2) {
          font-family: var(--font-serif);
          font-size: 18px;
          font-weight: 700;
          margin: 1.4em 0 0.45em;
          color: var(--text);
        }

        :global(.md-h3) {
          font-size: 15px;
          font-weight: 650;
          margin: 1.2em 0 0.4em;
          color: var(--text);
        }

        :global(.md-ul) {
          list-style: disc;
          padding-left: 1.5em;
          margin: 0.75em 0;
        }

        :global(.md-ol) {
          list-style: decimal;
          padding-left: 1.5em;
          margin: 0.75em 0;
        }

        :global(.md-li) {
          margin-bottom: 0.35em;
          line-height: 1.75;
        }

        :global(.md-blockquote) {
          border-left: 3px solid var(--accent);
          padding: 0.4rem 0 0.4rem 1.1rem;
          margin: 1em 0;
          color: var(--muted);
          font-style: italic;
        }

        :global(.md-sup) {
          color: var(--accent);
          font-size: 10px;
          font-weight: 700;
          vertical-align: super;
          cursor: default;
          letter-spacing: 0.01em;
        }

        /* ── References ──────────────────────────────── */
        :global(.refs-section) {
          border-top: 1px solid var(--border);
        }

        :global(.refs-toggle) {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.25rem;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          text-align: left;
          transition: color 150ms ease, background 150ms ease;
        }

        :global(.refs-toggle:hover) {
          color: var(--text);
          background: var(--surface-2);
        }

        :global(.refs-toggle__chevron) {
          margin-left: auto;
          display: flex;
          align-items: center;
        }

        :global(.refs-content) {
          padding: 0 1.25rem 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        :global(.refs-line) {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--muted);
          line-height: 1.7;
          word-break: break-word;
        }

        /* ── Action row ──────────────────────────────── */
        :global(.answer-card__actions) {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border-top: 1px solid var(--border);
          background: var(--surface-2);
          flex-wrap: wrap;
        }

        :global(.action-btn) {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          padding: 0.38rem 0.85rem;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 7px;
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 12px;
          cursor: pointer;
          transition:
            color 150ms ease,
            border-color 150ms ease,
            background 150ms ease;
          white-space: nowrap;
        }

        :global(.action-btn:hover) {
          color: var(--text);
          border-color: var(--muted);
          background: var(--surface);
        }

        :global(.action-btn--followup) {
          margin-left: auto;
          color: var(--accent);
          border-color: rgba(212, 168, 71, 0.3);
        }

        :global(.action-btn--followup:hover) {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--accent-hover);
        }

        /* ── History ──────────────────────────────────── */
        .history-section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 0.25rem;
        }

        .history-label {
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--muted);
          opacity: 0.6;
        }

        .clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: transparent;
          border: none;
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 5px;
          transition: color 150ms ease, background 150ms ease;
        }

        .clear-btn:hover {
          color: var(--danger);
          background: rgba(248, 81, 73, 0.06);
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        /* History cards */
        :global(.history-card) {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 150ms ease;
        }

        :global(.history-card:hover) {
          border-color: rgba(212, 168, 71, 0.2);
        }

        :global(.history-card__header) {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 150ms ease;
        }

        :global(.history-card__header:hover) {
          background: var(--surface-2);
        }

        :global(.history-card__q) {
          flex: 1;
          font-size: 13px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        :global(.history-card__meta) {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.3rem;
          color: var(--muted);
          font-size: 11px;
          font-family: var(--font-mono);
        }

        :global(.history-card__body) {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border);
        }

        :global(.history-refs) {
          margin-top: 0.75rem;
          border-top: 1px solid var(--border);
          padding-top: 0.75rem;
        }

        :global(.history-refs__toggle) {
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--muted);
          cursor: pointer;
          user-select: none;
        }

        :global(.history-refs__text) {
          margin-top: 0.5rem;
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
          white-space: pre-wrap;
          word-break: break-word;
          line-height: 1.65;
        }

        /* ── Screen-reader only ──────────────────────── */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border-width: 0;
        }

        /* ── Responsive ──────────────────────────────── */
        @media (max-width: 768px) {
          .ask-page {
            padding: 1.25rem 1rem 5rem;
          }

          :global(.answer-card__body) {
            padding: 1.25rem 1rem;
          }

          :global(.prose-answer) {
            font-size: 14px;
            max-width: none;
          }

          .toolbar {
            flex-wrap: wrap;
            gap: 0.6rem;
          }

          .model-selector {
            max-width: 100%;
            flex: 1 1 100%;
          }

          .submit-btn {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          :global(.answer-card) {
            border-radius: 0;
            border-left: 3px solid var(--accent);
            border-right: none;
            margin: 0 -1rem;
          }

          :global(.action-btn--followup) {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  );
}
