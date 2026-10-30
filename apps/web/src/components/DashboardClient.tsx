'use client';

import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Sparkles,
  SendHorizontal,
  CheckCircle2,
  Users2,
  Percent,
  Bot,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

interface DashboardClientProps {
  initialJobs: any[];
  initialApplications: any[];
  initialLiveStatus: any;
}

export function DashboardClient({
  initialJobs,
  initialApplications,
  initialLiveStatus,
}: DashboardClientProps) {
  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const [applications, setApplications] = useState<any[]>(initialApplications);
  const [liveStatus, setLiveStatus] = useState<any>(initialLiveStatus);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [jobsRes, appsRes, statusRes] = await Promise.all([
          fetch('/api/jobs?limit=50'),
          fetch('/api/applications'),
          fetch('/api/agent/live-status'),
        ]);
        if (jobsRes.ok) {
          const jd = await jobsRes.json();
          setJobs(jd.jobs || []);
        }
        if (appsRes.ok) {
          const ad = await appsRes.json();
          setApplications(ad.applications || []);
        }
        if (statusRes.ok) {
          const sd = await statusRes.json();
          setLiveStatus(sd);
        }
      } catch {
        // Ignore fetch errors
      }
    };

    void loadDashboard();
    const interval = setInterval(loadDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const highMatchJobs = jobs.filter((j) => (j.matchScore || 0) >= 80);
  const appliedApps = applications.filter((a) => a.status === 'APPLIED');
  const readyApps = applications.filter((a) => a.status === 'READY');
  const interviewApps = applications.filter((a) => a.status === 'INTERVIEW');

  return (
    <div className="space-y-8">
      {/* 1. Personal AI Employee Greeting Banner */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 p-6 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Saarthi Live Telemetry
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Welcome back, Dixit.
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Tracking <span className="font-semibold text-zinc-900 dark:text-zinc-200">{jobs.length} real postings</span> in your database,{' '}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{highMatchJobs.length} high-match roles (&ge;80%)</span>, and{' '}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{appliedApps.length} submitted applications</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/jobs"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Open Live Job Command Center
            </a>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Jobs in DB" value={String(jobs.length)} subtext="Synced live postings" icon={Briefcase} />
        <MetricCard label="High-Match" value={String(highMatchJobs.length)} subtext=">= 80% fit" icon={Sparkles} />
        <MetricCard label="Ready Review" value={String(readyApps.length)} subtext="Awaiting approval" icon={SendHorizontal} />
        <MetricCard label="Applied (Total)" value={String(appliedApps.length)} subtext="Live submissions" icon={CheckCircle2} />
        <MetricCard label="Applied Today" value={String(liveStatus?.applicationsSubmittedToday || appliedApps.length)} subtext={`Limit: ${liveStatus?.dailyApplicationLimit ?? 15}/day`} icon={Users2} />
        <MetricCard label="Interviews" value={String(interviewApps.length)} subtext="Active pipeline" icon={Percent} />
      </div>

      {/* 3. Active Pipeline & Live Applications Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recently Submitted Live Applications */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Applied Jobs — Live Submissions ({appliedApps.length})
            </h2>
            <a href="/applications" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              View all in Application Tracker <ChevronRight className="h-3 w-3" />
            </a>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800 shadow-xs">
            {appliedApps.slice(0, 15).map((app) => (
              <div
                key={app.id}
                className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {app.job?.title || 'Software Engineer'}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      ✓ {app.status}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{app.job?.company}</span>
                    <span>•</span>
                    <span>{app.job?.location || 'India'}</span>
                    {app.appliedAt && (
                      <>
                        <span>•</span>
                        <span suppressHydrationWarning>
                          {new Date(app.appliedAt).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.job?.canonicalUrl && (
                    <a
                      href={app.job.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    >
                      Portal <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {appliedApps.length === 0 && (
              <div className="p-6 text-center text-xs text-zinc-500">
                No applications recorded yet. Go to Jobs to run Live Auto-Apply.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Live Agent Telemetry */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Bot className="h-4 w-4 text-indigo-500" />
              Live Runner Log
            </h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                liveStatus?.activeScan
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {liveStatus?.activeScan ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-200 p-4 space-y-2 shadow-xs font-mono text-[11px] max-h-96 overflow-y-auto">
            {(liveStatus?.logs || []).length > 0 ? (
              (liveStatus.logs as string[]).slice(-18).map((line: string, i: number) => (
                <div key={i} className="leading-relaxed border-b border-zinc-900 pb-1">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-zinc-500">No active live runner logs yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
