'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { MatchBadge } from '@/components/MatchBadge';

export interface TrackedApplication {
  id: string;
  company: string;
  role: string;
  location?: string;
  canonicalUrl?: string;
  matchScore: number;
  status: 'READY' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
  submissionMethod?: string;
  appliedDate?: string;
  notes: string;
  answersCount: number;
  needsReview: boolean;
}

const columns = [
  { id: 'APPLIED', name: 'Applied (Live)', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200' },
  { id: 'READY', name: 'Ready for Review', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 border-amber-200' },
  { id: 'INTERVIEW', name: 'Interviews', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200' },
  { id: 'OFFER', name: 'Offers', color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 border-purple-200' },
];

export function mapApiApplications(rawApps: any[]): TrackedApplication[] {
  return (rawApps || []).map((a: any) => ({
    id: a.id,
    company: a.job?.company || 'Company',
    role: a.job?.title || 'Software Engineer',
    location: a.job?.location || 'India',
    canonicalUrl: a.job?.canonicalUrl,
    matchScore: a.job?.matchScore || 88,
    status: a.status || 'APPLIED',
    submissionMethod: a.submissionMethod,
    appliedDate: a.appliedAt
      ? new Date(a.appliedAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : undefined,
    notes: a.notes || `Applied via ${a.submissionMethod || 'Saarthi Agent'}`,
    answersCount: a.answersCount || 0,
    needsReview: (a.pendingReviewCount || 0) > 0,
  }));
}

export function ApplicationsClient({ initialRawApps }: { initialRawApps: any[] }) {
  const [apps, setApps] = useState<TrackedApplication[]>(() => mapApiApplications(initialRawApps));
  const [loading, setLoading] = useState(false);

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const data = await res.json();
        setApps(mapApiApplications(data.applications || []));
      }
    } catch {
      // Ignore fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApplications();
    const interval = setInterval(fetchApplications, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Application Tracker ({apps.length})
          </h1>
          <p className="text-xs text-zinc-500">
            Live database records of every prepared and autonomously submitted application.
          </p>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            void fetchApplications();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => {
          const colApps = apps.filter((a) => a.status === col.id);

          return (
            <div
              key={col.id}
              className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-4 space-y-3 md:min-h-[500px]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {col.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {colApps.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {colApps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 block">
                          {app.company}
                        </span>
                        {app.location && (
                          <span className="text-[10px] text-zinc-400">{app.location}</span>
                        )}
                      </div>
                      <MatchBadge score={app.matchScore} />
                    </div>

                    <div className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                      {app.role}
                    </div>

                    <p className="text-[11px] text-zinc-500 line-clamp-2">
                      {app.notes}
                    </p>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {app.appliedDate ? `${app.appliedDate}` : `${app.answersCount} answers`}
                      </span>
                      {app.canonicalUrl && (
                        <a
                          href={app.canonicalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-500 hover:underline flex items-center gap-0.5"
                        >
                          Portal <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {app.needsReview && (
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Review
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {colApps.length === 0 && (
                  <div className="py-6 text-center text-xs text-zinc-400">
                    No applications in {col.name}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
