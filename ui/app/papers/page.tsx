"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  Library,
  RefreshCw,
  CloudUpload,
} from "lucide-react";
import { toast } from "sonner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "https://researchai.umarsyukri.com";

/* ─────────────────────────────────────────────────
   Types
───────────────────────────────────────────────── */
type UploadStatus = "uploading" | "done" | "error";

interface UploadEntry {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  errorMsg?: string;
  exiting?: boolean;
}

interface PaperItem {
  name: string;
}

/* ─────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────── */
function UploadRow({ entry }: { entry: UploadEntry }) {
  return (
    <div
      className={`upload-row upload-row--${entry.status} ${
        entry.exiting ? "upload-row--exit" : "upload-row--enter"
      }`}
      role="listitem"
    >
      {/* Left icon */}
      <div className="upload-row__icon">
        {entry.status === "uploading" && (
          <Loader2 size={15} className="upload-spin" />
        )}
        {entry.status === "done" && (
          <CheckCircle2 size={15} className="upload-icon-done" />
        )}
        {entry.status === "error" && (
          <XCircle size={15} className="upload-icon-error" />
        )}
      </div>

      {/* Filename + meta */}
      <div className="upload-row__body">
        <span className="upload-row__name">{entry.name}</span>
        {entry.status === "uploading" && (
          <span className="upload-row__meta">
            {formatBytes(entry.size)} · Uploading…
          </span>
        )}
        {entry.status === "done" && (
          <span className="upload-row__meta upload-row__meta--done">
            {formatBytes(entry.size)} · Uploaded
          </span>
        )}
        {entry.status === "error" && (
          <span className="upload-row__meta upload-row__meta--error">
            {entry.errorMsg ?? "Upload failed"}
          </span>
        )}
      </div>

      {/* Progress bar (uploading only) */}
      {entry.status === "uploading" && (
        <div className="upload-progress-bar">
          <div className="upload-progress-fill" />
        </div>
      )}
    </div>
  );
}

function SkeletonRow({ delay }: { delay: number }) {
  return (
    <div
      className="paper-row paper-row--skeleton"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="skeleton" style={{ height: 13, width: "60%", borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 10, width: "30%", borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ width: 54, height: 18, borderRadius: 999 }} />
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Back page */}
      <rect
        x="16"
        y="26"
        width="46"
        height="56"
        rx="5"
        fill="var(--surface-2)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Middle page */}
      <rect
        x="22"
        y="20"
        width="46"
        height="56"
        rx="5"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Front page */}
      <rect
        x="28"
        y="14"
        width="46"
        height="56"
        rx="5"
        fill="var(--surface)"
        stroke="var(--border)"
        strokeWidth="1.5"
      />
      {/* Lines */}
      <line x1="36" y1="26" x2="66" y2="26" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="32" x2="66" y2="32" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="38" x2="56" y2="38" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Gold accent bar */}
      <line x1="36" y1="48" x2="52" y2="48" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────
   Main Component
───────────────────────────────────────────────── */
export default function PapersPage() {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const exitTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /* ── Fetch paper list ───────────────── */
  const fetchPapers = useCallback(async (silent = false) => {
    if (!silent) setPapersLoading(true);
    else setIsRefreshing(true);
    try {
      const r = await fetch(`${API_BASE}/papers`);
      const d = await r.json();
      setPapers((d.papers ?? []).map((name: string) => ({ name })));
    } catch {
      if (!silent) toast.error("Failed to load paper library");
    } finally {
      setPapersLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  /* ── Schedule exit animation then remove ── */
  const scheduleRemoval = (id: string) => {
    const t = setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.id !== id));
      exitTimers.current.delete(id);
    }, 600);
    exitTimers.current.set(id, t);
  };

  /* ── Upload one file ────────────────── */
  const uploadFile = useCallback(
    async (file: File) => {
      const id = crypto.randomUUID();
      const entry: UploadEntry = {
        id,
        name: file.name,
        size: file.size,
        status: "uploading",
      };

      setUploads((prev) => [entry, ...prev]);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.detail ?? `Server error ${res.status}`);
        }

        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, status: "done" } : u))
        );
        toast.success(`${file.name} uploaded successfully`);
        await fetchPapers(true);

        // Start exit after 3 s
        setTimeout(() => {
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, exiting: true } : u))
          );
          scheduleRemoval(id);
        }, 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, status: "error", errorMsg: msg } : u
          )
        );
        toast.error(`Failed: ${msg}`);
      }
    },
    [fetchPapers]
  );

  /* ── Dropzone ───────────────────────── */
  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach(uploadFile);
    },
    [uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: { "application/pdf": [".pdf"] },
      multiple: true,
    });

  /* ── Derived ────────────────────────── */
  const activeUploads = uploads.filter((u) => u.status === "uploading").length;
  const dropzoneClass = [
    "dropzone",
    isDragActive && !isDragReject ? "dropzone--over" : "",
    isDragReject ? "dropzone--reject" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* ─── Render ─────────────────────────────────── */
  return (
    <div className="papers-page">
      <div className="papers-inner">
        {/* ── Page header ────────────────────────── */}
        <header className="page-header animate-fade-in-up">
          <h1 className="page-title">Paper Library</h1>
          <p className="page-subtitle">
            Upload scientific PDFs and manage your indexed research collection.
          </p>
        </header>

        {/* ── Upload Zone ─────────────────────────── */}
        <div
          {...getRootProps()}
          className={`${dropzoneClass} animate-fade-in-up`}
          style={{ animationDelay: "0.06s" }}
          role="button"
          aria-label="Upload PDF files. Click or drag and drop."
          tabIndex={0}
        >
          <input {...getInputProps()} />

          {/* Animated corner accents */}
          <span className="dropzone__corner dropzone__corner--tl" aria-hidden="true" />
          <span className="dropzone__corner dropzone__corner--tr" aria-hidden="true" />
          <span className="dropzone__corner dropzone__corner--bl" aria-hidden="true" />
          <span className="dropzone__corner dropzone__corner--br" aria-hidden="true" />

          {/* Glow layer */}
          <div className="dropzone__glow" aria-hidden="true" />

          <div className="dropzone__content">
            <div className="dropzone__icon-wrap">
              {isDragReject ? (
                <XCircle size={30} strokeWidth={1.5} />
              ) : activeUploads > 0 ? (
                <Loader2 size={30} strokeWidth={1.5} className="dz-spin" />
              ) : (
                <CloudUpload size={30} strokeWidth={1.5} />
              )}
            </div>

            <div className="dropzone__label">
              {isDragReject ? (
                <span className="dropzone__label--reject">PDF files only</span>
              ) : isDragActive ? (
                <span className="dropzone__label--active">
                  Release to upload…
                </span>
              ) : activeUploads > 0 ? (
                <span className="dropzone__label--uploading">
                  Uploading {activeUploads} file
                  {activeUploads > 1 ? "s" : ""}…
                </span>
              ) : (
                <>
                  <span className="dropzone__label--primary">
                    Drop PDFs here or click to browse
                  </span>
                  <span className="dropzone__label--secondary">
                    PDF files only &nbsp;·&nbsp; Multiple files supported
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Upload progress list ─────────────────── */}
        {uploads.length > 0 && (
          <div
            className="upload-list animate-fade-in"
            role="list"
            aria-label="Upload progress"
            aria-live="polite"
          >
            {uploads.map((u) => (
              <UploadRow key={u.id} entry={u} />
            ))}
          </div>
        )}

        {/* ── Paper Library ────────────────────────── */}
        <section
          className="library animate-fade-in-up"
          style={{ animationDelay: "0.12s" }}
          aria-label="Indexed paper library"
        >
          {/* Library header */}
          <div className="library__header">
            <div className="library__title-wrap">
              <Library size={14} />
              <span className="library__title">Indexed Papers</span>
            </div>

            <div className="library__meta">
              {!papersLoading && (
                <span className="library__count">
                  {papers.length}{" "}
                  {papers.length === 1 ? "paper" : "papers"} indexed
                </span>
              )}
              <button
                className="refresh-btn"
                onClick={() => fetchPapers(true)}
                disabled={isRefreshing || papersLoading}
                aria-label="Refresh paper list"
                title="Refresh"
              >
                <RefreshCw
                  size={13}
                  className={isRefreshing ? "refresh-spin" : ""}
                />
              </button>
            </div>
          </div>

          {/* Library body */}
          <div className="library__body">
            {papersLoading ? (
              /* Skeleton rows */
              <div className="papers-list" role="list" aria-label="Loading papers">
                {[0, 1, 2].map((i) => (
                  <SkeletonRow key={i} delay={i * 0.07} />
                ))}
              </div>
            ) : papers.length === 0 ? (
              /* Empty state */
              <div className="library__empty">
                <EmptyIllustration />
                <p className="library__empty-text">
                  No papers yet.{" "}
                  <span style={{ color: "var(--text)" }}>
                    Upload your first PDF above.
                  </span>
                </p>
              </div>
            ) : (
              /* Paper rows */
              <div className="papers-list" role="list">
                {papers.map((p, i) => (
                  <div
                    key={p.name}
                    className="paper-row animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.035}s` }}
                    role="listitem"
                  >
                    <div className="paper-row__icon" aria-hidden="true">
                      <FileText size={14} strokeWidth={1.6} />
                    </div>

                    <div className="paper-row__body">
                      <span className="paper-row__name">{p.name}</span>
                    </div>

                    <span className="paper-row__badge" aria-label="indexed">
                      indexed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ────────────────── Styles ────────────────── */}
      <style jsx>{`
        /* ── Page shell ─────────────────────────── */
        .papers-page {
          padding: 2.5rem 2rem;
          min-height: 100vh;
        }

        .papers-inner {
          max-width: 780px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* ── Header ─────────────────────────────── */
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

        /* ── Dropzone ───────────────────────────── */
        .dropzone {
          position: relative;
          border: 1.5px dashed var(--border);
          border-radius: 14px;
          padding: 3.5rem 2rem;
          cursor: pointer;
          background: var(--surface);
          overflow: hidden;
          transition:
            border-color 200ms ease,
            box-shadow 200ms ease,
            transform 200ms ease,
            background 200ms ease;
          outline: none;
        }

        .dropzone:focus-visible {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
        }

        .dropzone:hover {
          border-color: var(--muted);
          background: var(--surface-2);
        }

        .dropzone:hover .dropzone__corner {
          opacity: 1;
        }

        /* Drag-over state */
        .dropzone--over {
          border-color: var(--accent);
          border-style: solid;
          background: var(--surface-2);
          box-shadow:
            0 0 0 1px rgba(212, 168, 71, 0.2),
            0 0 40px var(--accent-glow);
          transform: scale(1.008);
        }

        .dropzone--over .dropzone__glow {
          opacity: 1;
        }

        .dropzone--over .dropzone__icon-wrap {
          transform: translateY(-4px) scale(1.08);
          box-shadow: 0 8px 24px var(--accent-glow);
        }

        .dropzone--over .dropzone__corner {
          opacity: 1;
        }

        /* Reject state */
        .dropzone--reject {
          border-color: var(--danger);
          border-style: solid;
          background: rgba(248, 81, 73, 0.04);
          box-shadow: 0 0 24px rgba(248, 81, 73, 0.15);
        }

        .dropzone--reject .dropzone__icon-wrap {
          background: rgba(248, 81, 73, 0.12);
          border-color: rgba(248, 81, 73, 0.3);
          color: var(--danger);
        }

        /* Corner accent marks */
        .dropzone__corner {
          position: absolute;
          width: 14px;
          height: 14px;
          border-color: var(--accent);
          border-style: solid;
          border-width: 0;
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .dropzone__corner--tl {
          top: 10px; left: 10px;
          border-top-width: 2px;
          border-left-width: 2px;
          border-top-left-radius: 3px;
        }
        .dropzone__corner--tr {
          top: 10px; right: 10px;
          border-top-width: 2px;
          border-right-width: 2px;
          border-top-right-radius: 3px;
        }
        .dropzone__corner--bl {
          bottom: 10px; left: 10px;
          border-bottom-width: 2px;
          border-left-width: 2px;
          border-bottom-left-radius: 3px;
        }
        .dropzone__corner--br {
          bottom: 10px; right: 10px;
          border-bottom-width: 2px;
          border-right-width: 2px;
          border-bottom-right-radius: 3px;
        }

        /* Glow overlay */
        .dropzone__glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(
            ellipse at 50% 100%,
            var(--accent-glow) 0%,
            transparent 70%
          );
          opacity: 0;
          pointer-events: none;
          transition: opacity 250ms ease;
        }

        /* Content */
        .dropzone__content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.25rem;
          pointer-events: none;
        }

        .dropzone__icon-wrap {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: var(--accent-dim);
          border: 1px solid rgba(212, 168, 71, 0.3);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          transition:
            transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
            box-shadow 250ms ease;
        }

        .dropzone__label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          text-align: center;
        }

        .dropzone__label--primary {
          font-size: 15px;
          color: var(--text);
          font-weight: 500;
        }

        .dropzone__label--secondary {
          font-size: 12px;
          color: var(--muted);
        }

        .dropzone__label--active {
          font-family: var(--font-serif);
          font-size: 16px;
          font-style: italic;
          color: var(--accent);
        }

        .dropzone__label--reject {
          font-size: 14px;
          color: var(--danger);
          font-weight: 500;
        }

        .dropzone__label--uploading {
          font-size: 14px;
          color: var(--accent);
        }

        .dz-spin {
          animation: spin-slow 0.9s linear infinite;
        }

        /* ── Upload list ─────────────────────────── */
        .upload-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Upload row */
        :global(.upload-row) {
          position: relative;
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.65rem 1rem;
          border-radius: 9px;
          border: 1px solid var(--border);
          background: var(--surface);
          font-size: 13px;
          overflow: hidden;
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        :global(.upload-row--enter) {
          animation: fadeInUp 0.3s ease both;
        }

        :global(.upload-row--exit) {
          opacity: 0;
          transform: translateY(-6px);
        }

        :global(.upload-row--uploading) {
          border-color: rgba(212, 168, 71, 0.25);
          background: rgba(212, 168, 71, 0.04);
        }

        :global(.upload-row--done) {
          border-color: rgba(63, 185, 80, 0.25);
          background: rgba(63, 185, 80, 0.04);
        }

        :global(.upload-row--error) {
          border-color: rgba(248, 81, 73, 0.25);
          background: rgba(248, 81, 73, 0.04);
        }

        :global(.upload-row__icon) {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
        }

        :global(.upload-spin) {
          animation: spin-slow 0.8s linear infinite;
          color: var(--accent);
        }

        :global(.upload-icon-done) {
          color: var(--success);
        }

        :global(.upload-icon-error) {
          color: var(--danger);
        }

        :global(.upload-row__body) {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        :global(.upload-row__name) {
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 13px;
        }

        :global(.upload-row__meta) {
          font-size: 11px;
          color: var(--muted);
        }

        :global(.upload-row__meta--done) {
          color: var(--success);
        }

        :global(.upload-row__meta--error) {
          color: var(--danger);
        }

        /* Animated progress bar */
        :global(.upload-progress-bar) {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: rgba(212, 168, 71, 0.12);
        }

        :global(.upload-progress-fill) {
          height: 100%;
          background: var(--accent);
          border-radius: 0 1px 1px 0;
          animation: progress-indeterminate 1.4s ease-in-out infinite;
        }

        @keyframes progress-indeterminate {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 70%; margin-left: 15%; }
          100% { width: 0%; margin-left: 100%; }
        }

        /* ── Library ─────────────────────────────── */
        .library {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }

        .library__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
        }

        .library__title-wrap {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--muted);
        }

        .library__title {
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }

        .library__meta {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .library__count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--muted);
        }

        .refresh-btn {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: all var(--transition);
        }

        .refresh-btn:hover:not(:disabled) {
          border-color: var(--border);
          color: var(--text);
          background: var(--surface);
        }

        .refresh-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .refresh-spin {
          animation: spin-slow 0.9s linear infinite;
        }

        .library__body {
          min-height: 120px;
        }

        /* ── Paper rows ──────────────────────────── */
        .papers-list {
          display: flex;
          flex-direction: column;
        }

        .paper-row {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid var(--border);
          transition: background var(--transition);
        }

        .paper-row:last-child {
          border-bottom: none;
        }

        .paper-row:not(.paper-row--skeleton):hover {
          background: var(--surface-2);
        }

        .paper-row--skeleton {
          opacity: 0.7;
          animation: fadeIn 0.3s ease both;
        }

        .paper-row__icon {
          width: 36px;
          height: 36px;
          flex-shrink: 0;
          border-radius: 9px;
          background: var(--accent-dim);
          border: 1px solid rgba(212, 168, 71, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }

        .paper-row__body {
          flex: 1;
          overflow: hidden;
        }

        .paper-row__name {
          display: block;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .paper-row__badge {
          flex-shrink: 0;
          font-family: var(--font-mono);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--success);
          background: rgba(63, 185, 80, 0.08);
          border: 1px solid rgba(63, 185, 80, 0.22);
          border-radius: 999px;
          padding: 2px 9px;
        }

        /* ── Empty state ─────────────────────────── */
        .library__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.1rem;
          padding: 3.5rem 2rem;
          text-align: center;
        }

        .library__empty-text {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
        }

        /* ── Responsive ──────────────────────────── */
        @media (max-width: 768px) {
          .papers-page {
            padding: 1.25rem 1rem;
          }

          .dropzone {
            padding: 2.25rem 1.25rem;
          }

          .dropzone__icon-wrap {
            width: 52px;
            height: 52px;
          }
        }

        @media (max-width: 480px) {
          .dropzone__corner {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
