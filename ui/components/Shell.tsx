"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquareText,
  BookOpen,
  Settings,
  Wifi,
  WifiOff,
  FlaskConical,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://researchai.umarsyukri.com";

interface HealthData {
  status: string;
  llm: string;
  summary_llm: string;
  papers_dir: string;
}

const navLinks = [
  { href: "/ask", label: "Ask", icon: MessageSquareText },
  { href: "/papers", label: "Papers", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function extractModelShortName(modelStr: string): string {
  const parts = modelStr?.split("/") ?? [];
  const name = parts[parts.length - 1] ?? modelStr ?? "—";
  return name.replace(/:free$/, "").replace(/-/g, " ");
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [paperCount, setPaperCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then((d) => {
        setHealth(d);
        setHealthError(false);
      })
      .catch(() => setHealthError(true));

    fetch(`${API_BASE}/papers`)
      .then((r) => r.json())
      .then((d) => setPaperCount(d.count ?? 0))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href);

  return (
    <div className="shell-root">
      {/* ─── Desktop Sidebar ──────────────────────────────── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <FlaskConical size={18} strokeWidth={1.8} />
          </div>
          <span className="sidebar-logo-text">ResearchAI</span>
        </div>

        {/* Nav Links */}
        <nav className="sidebar-nav" aria-label="Main navigation">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`sidebar-nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
                {label === "Papers" && paperCount !== null && (
                  <span className="paper-count-badge" aria-label={`${paperCount} papers indexed`}>
                    {paperCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status */}
        <div className="sidebar-status">
          <div className="sidebar-status-row">
            {healthError ? (
              <WifiOff size={13} className="status-icon-error" />
            ) : (
              <Wifi size={13} className="status-icon-ok" />
            )}
            <span className="sidebar-status-label">
              {healthError ? "Unreachable" : "Connected"}
            </span>
          </div>
          {health && !healthError && (
            <div className="sidebar-model-name">
              <span className="status-dot-pulse" />
              {extractModelShortName(health.llm)}
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main Content ──────────────────────────────────── */}
      <main className="shell-main" id="main-content">
        <div key={pathname} className="page-transition">{children}</div>
      </main>

      {/* ─── Mobile Bottom Tab Bar ──────────────────────── */}
      <nav className="bottom-tab-bar" aria-label="Main navigation">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`bottom-tab-item ${active ? "active" : ""}`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span className="bottom-tab-label">{label}</span>
            </Link>
          );
        })}
      </nav>

      <style jsx>{`
        /* ─── Shell Layout ──────────────────────────────── */
        .shell-root {
          display: flex;
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }

        /* ─── Sidebar ───────────────────────────────────── */
        .sidebar {
          width: var(--sidebar-w);
          min-height: 100vh;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          z-index: 40;
          padding: 1.5rem 0;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border);
          margin-bottom: 1rem;
        }

        .sidebar-logo-icon {
          width: 32px;
          height: 32px;
          background: var(--accent-dim);
          border: 1px solid rgba(212, 168, 71, 0.3);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
          flex-shrink: 0;
        }

        .sidebar-logo-text {
          font-family: var(--font-serif);
          font-size: 17px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        /* ─── Nav Links ─────────────────────────────────── */
        .sidebar-nav {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 0 0.75rem;
        }

        .sidebar-nav-link {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 0.75rem;
          border-radius: var(--radius);
          color: var(--muted);
          font-size: 13px;
          font-family: var(--font-mono);
          text-decoration: none;
          transition: all var(--transition);
          position: relative;
          border-left: 3px solid transparent;
        }

        .sidebar-nav-link:hover {
          color: var(--text);
          background: var(--surface-2);
        }

        .sidebar-nav-link.active {
          color: var(--accent);
          background: var(--accent-dim);
          border-left-color: var(--accent);
        }

        .paper-count-badge {
          margin-left: auto;
          background: var(--accent-dim);
          color: var(--accent);
          border: 1px solid rgba(212, 168, 71, 0.3);
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          padding: 1px 7px;
          min-width: 22px;
          text-align: center;
        }

        /* ─── Status Section ─────────────────────────────── */
        .sidebar-status {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }

        .sidebar-status-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.4rem;
        }

        .sidebar-status-label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .status-icon-ok {
          color: var(--success);
        }

        .status-icon-error {
          color: var(--danger);
        }

        .sidebar-model-name {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 12px;
          color: var(--text);
          font-family: var(--font-mono);
          text-transform: capitalize;
        }

        .status-dot-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--success);
          flex-shrink: 0;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        /* ─── Main Content ───────────────────────────────── */
        .shell-main {
          margin-left: var(--sidebar-w);
          flex: 1;
          min-height: 100vh;
          overflow-y: auto;
          position: relative;
        }

        /* ─── Bottom Tab Bar (Mobile) ────────────────────── */
        .bottom-tab-bar {
          display: none;
        }

        /* ─── Responsive ─────────────────────────────────── */
        @media (max-width: 768px) {
          .sidebar {
            display: none;
          }

          .shell-main {
            margin-left: 0;
            padding-bottom: 70px;
          }

          .bottom-tab-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 50;
            background: var(--surface);
            border-top: 1px solid var(--border);
            height: 62px;
          }

          .bottom-tab-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            color: var(--muted);
            text-decoration: none;
            font-size: 11px;
            font-family: var(--font-mono);
            transition: color var(--transition);
          }

          .bottom-tab-item:hover,
          .bottom-tab-item.active {
            color: var(--accent);
          }

          .bottom-tab-label {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
