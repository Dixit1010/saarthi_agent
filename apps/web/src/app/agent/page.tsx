'use client';

import React, { useState } from 'react';
import { Bot, Play, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Terminal } from 'lucide-react';

interface AgentRunItem {
  id: string;
  runNumber: number;
  trigger: string;
  status: string;
  jobsScanned: number;
  newJobs: number;
  qualified: number;
  resumesGenerated: number;
  applicationsPrepared: number;
  submitted: number;
  needsReview: number;
  time: string;
  logs: {
    time: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    text: string;
  }[];
}

const mockRuns: AgentRunItem[] = [
  {
    id: 'run-3821',
    runNumber: 3821,
    trigger: 'MANUAL',
    status: 'PAUSED_FOR_HUMAN',
    jobsScanned: 137,
    newJobs: 42,
    qualified: 18,
    resumesGenerated: 12,
    applicationsPrepared: 9,
    submitted: 5,
    needsReview: 4,
    time: 'Today, 09:00 AM',
    logs: [
      { time: '09:00:12', level: 'INFO', text: 'Agent Run #3821 initialized. Task: Find Backend & AI jobs in Noida/Gurgaon' },
      { time: '09:00:45', level: 'INFO', text: 'Discovered 137 postings across company career portals' },
      { time: '09:01:20', level: 'INFO', text: '42 unique postings normalized and deduplicated' },
      { time: '09:02:10', level: 'INFO', text: '18 positions meet candidate threshold score >= 80%' },
      { time: '09:03:00', level: 'INFO', text: 'Tailored 12 JD-specific resume versions. All bullets verified with zero hallucinations' },
      { time: '09:04:15', level: 'INFO', text: 'Prepared 9 applications in ASSISTED mode; safe fields populated via semantic mapper' },
      { time: '09:04:40', level: 'WARN', text: '4 applications contain compensation or subjective queries requiring human approval' },
      { time: '09:05:00', level: 'INFO', text: 'Paused for Human Review: Awaiting user confirmation in dashboard' },
    ],
  },
  {
    id: 'run-3820',
    runNumber: 3820,
    trigger: 'SCHEDULED',
    status: 'COMPLETED',
    jobsScanned: 94,
    newJobs: 15,
    qualified: 6,
    resumesGenerated: 6,
    applicationsPrepared: 6,
    submitted: 6,
    needsReview: 0,
    time: 'Yesterday, 07:00 PM',
    logs: [
      { time: '19:00:00', level: 'INFO', text: 'Scheduled evening discovery sweep triggered' },
      { time: '19:02:15', level: 'INFO', text: 'Ingested 94 postings' },
      { time: '19:04:30', level: 'INFO', text: '6 high-match roles identified and prepared' },
      { time: '19:06:00', level: 'INFO', text: 'Completed successfully' },
    ],
  },
];

export default function AgentPage() {
  const [runs, setRuns] = useState(mockRuns);
  const [selectedRun, setSelectedRun] = useState(mockRuns[0]);
  const [isTriggering, setIsTriggering] = useState(false);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    setTimeout(() => {
      setIsTriggering(false);
      alert('New Agent Discovery Run triggered and enqueued into background worker!');
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            Agent Runs &amp; Observability
          </h1>
          <p className="text-xs text-zinc-500">
            Audit logs, execution telemetry, and deterministic human-in-the-loop controls.
          </p>
        </div>

        <button
          onClick={handleTriggerRun}
          disabled={isTriggering}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {isTriggering ? 'Starting Run...' : 'Run Discovery Agent Now'}
        </button>
      </div>

      {/* Main Grid: Left Run Cards, Right Execution Log Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Runs List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Execution History
          </h2>
          {runs.map((r) => {
            const isSelected = selectedRun.id === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedRun(r)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    Agent Run #{r.runNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      r.status === 'PAUSED_FOR_HUMAN'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {r.status === 'PAUSED_FOR_HUMAN' ? 'Waiting Review' : 'Completed'}
                  </span>
                </div>

                <div className="text-xs text-zinc-500 mt-1 flex items-center justify-between">
                  <span>{r.time}</span>
                  <span className="font-mono text-[11px]">{r.trigger}</span>
                </div>

                {/* Micro Stats */}
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block">Scanned</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{r.jobsScanned}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Prepared</span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">{r.applicationsPrepared}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Submitted</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{r.submitted}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Selected Run Detail & Log Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                  Agent Run #{selectedRun.runNumber} Breakdown
                </h3>
                <span className="text-xs text-zinc-500">Triggered: {selectedRun.time}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  Trigger: {selectedRun.trigger}
                </span>
              </div>
            </div>

            {/* Run Stats Ribbon */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-[11px] text-zinc-500">Jobs Scanned</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{selectedRun.jobsScanned}</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-[11px] text-zinc-500">Qualified (&gt;= 80%)</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{selectedRun.qualified}</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-[11px] text-zinc-500">Prepared</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{selectedRun.applicationsPrepared}</div>
              </div>
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center">
                <div className="text-[11px] text-zinc-500">Submitted</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedRun.submitted}</div>
              </div>
            </div>

            {/* Live Terminal Log */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Terminal className="h-4 w-4" />
                <span>Execution Audit Stream</span>
              </div>

              <div className="bg-zinc-950 text-zinc-300 font-mono text-xs rounded-xl p-4 space-y-2 max-h-72 overflow-y-auto border border-zinc-800">
                {selectedRun.logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-zinc-600 shrink-0">{log.time}</span>
                    <span
                      className={`text-[10px] font-bold px-1 rounded uppercase shrink-0 ${
                        log.level === 'WARN'
                          ? 'bg-amber-900/60 text-amber-300'
                          : log.level === 'ERROR'
                          ? 'bg-rose-900/60 text-rose-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {log.level}
                    </span>
                    <span className="text-zinc-200">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
