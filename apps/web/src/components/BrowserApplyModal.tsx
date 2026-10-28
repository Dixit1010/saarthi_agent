'use client';

import React, { useState } from 'react';
import {
  X,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  Eye,
  ShieldCheck,
  FileText,
  Clock,
  Terminal,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { MatchBadge } from './MatchBadge';

export interface BrowserApplyModalProps {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    matchScore: number;
    canonicalUrl: string;
    source?: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function BrowserApplyModal({ job, isOpen, onClose, onSuccess }: BrowserApplyModalProps) {
  const [headless, setHeadless] = useState(false); // default to visible window on desktop!
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartAutoApply = async () => {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${job.id}/browser-auto-apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headless, dryRun }),
      });

      let data: any = {};
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(
          res.status === 504 || res.status === 408
            ? 'Automation request timed out while loading the portal page. Please retry or click "Open Career Portal".'
            : res.ok
            ? 'Unexpected response from automation server.'
            : `Automation server busy: A background runner or Chrome session is currently active. Please wait a moment or click "Open Career Portal".`
        );
      }

      if (res.ok) {
        setResult(data.browserResult);
        if (data.status === 'APPLIED' && onSuccess) {
          onSuccess();
        }
      } else {
        setError(data.error || data.message || 'Browser automation failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error with automation server.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-zinc-500">{job.company}</span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-xs text-zinc-500">{job.location}</span>
              {job.source && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {job.source}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-500" />
              Live Browser Auto-Apply Agent
            </h2>
            <p className="text-xs text-zinc-500">
              Autonomous Playwright agent: navigates to external portal, maps form fields, types answers, and submits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <MatchBadge score={job.matchScore} />
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!headless}
                  onChange={(e) => setHeadless(!e.target.checked)}
                  disabled={running}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-indigo-500" />
                  Watch Live Browser Window
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={running}
                  className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Dry-Run (Fill &amp; Inspect Only)
                </span>
              </label>
            </div>

            <button
              onClick={handleStartAutoApply}
              disabled={running}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-2"
            >
              {running ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Browser Agent Active...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Launch Live Auto-Apply
                </>
              )}
            </button>
          </div>

          {/* Running Indicator Banner */}
          {running && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
              <div>
                <p className="font-semibold">Autonomous Browser Agent Executing...</p>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {!headless
                    ? 'Check your desktop taskbar: a Google Chrome window has opened!'
                    : 'Running headlessly on server. Detecting inputs and mapping candidate profile.'}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <p className="font-semibold">Browser Execution Alert</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Result View */}
          {result && (
            <div className="space-y-4">
              {/* Status Header */}
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 ${
                  result.success
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{result.message}</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Status: {result.status}</p>
                  {!result.success && job.canonicalUrl && (
                    <div className="mt-2.5">
                      <a
                        href={job.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-xs transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Portal &amp; Complete Apply
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Detected & Filled Fields Inspector */}
              {result.fillResult?.details && result.fillResult.details.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-indigo-500" />
                    Detected Form Fields &amp; Auto-Filled Values ({result.fillResult.details.length})
                  </h3>
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
                    {result.fillResult.details.map((d: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{d.label}</span>
                        <span className="text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono text-[11px] truncate max-w-[280px]">
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Execution Logs */}
              {result.logs && result.logs.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Terminal className="h-4 w-4 text-zinc-500" />
                    Agent Audit Log Trail
                  </h3>
                  <div className="p-3 rounded-xl bg-zinc-950 text-zinc-300 font-mono text-[11px] space-y-1 max-h-48 overflow-y-auto border border-zinc-800">
                    {result.logs.map((l: string, idx: number) => (
                      <div key={idx} className="leading-relaxed">
                        {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback info when idle */}
          {!running && !result && !error && (
            <div className="p-6 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
              <Globe className="h-8 w-8 text-indigo-400 mx-auto" />
              <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                Ready to Auto-Apply to {job.company}
              </p>
              <p className="text-zinc-500 max-w-md mx-auto text-[11px]">
                Click <strong>"Launch Live Auto-Apply"</strong> above. The agent will open {job.title}&apos;s career page, semantically map input fields, type candidate details, and execute submission.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <a
            href={job.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open Career Portal in New Tab
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
