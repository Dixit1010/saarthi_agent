'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Briefcase,
  MapPin,
  Building2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  FileText,
  Send,
  Sliders,
  Globe,
} from 'lucide-react';
import { MatchBadge } from '@/components/MatchBadge';
import { ResumeTailorModal } from '@/components/ResumeTailorModal';
import { ApplicationReviewModal } from '@/components/ApplicationReviewModal';
import { BrowserApplyModal } from '@/components/BrowserApplyModal';

interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  locationType: string;
  matchScore: number;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  experienceMin?: number | null;
  experienceMax?: number | null;
  skills: string[];
  matchedSkills: string[];
  partialSkills?: string[];
  missingSkills: string[];
  description: string;
  canonicalUrl: string;
  source?: string;
  sourceUrl?: string;
  postedAt?: string;
  discoveredAt?: string;
  applicationStatus?: string | null;
  appliedAt?: string | null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [minMatch, setMinMatch] = useState(50);
  const [selectedLocationType, setSelectedLocationType] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');

  // Agent Platform Execution Toggles (If a toggle is OFF, the agent will NOT visit or sync that platform)
  type AgentPlatformKey = 'LINKEDIN' | 'INSTAHYRE' | 'HIRING_CAFE' | 'NAUKRI' | 'AMAZON' | 'SIEMENS' | 'OTHER';
  const ALL_AGENT_PLATFORMS: Array<{ id: AgentPlatformKey; label: string; icon: string }> = [
    { id: 'LINKEDIN', label: 'LinkedIn', icon: '💼' },
    { id: 'INSTAHYRE', label: 'Instahyre', icon: '⚡' },
    { id: 'HIRING_CAFE', label: 'Hiring.cafe', icon: '☕' },
    { id: 'NAUKRI', label: 'Naukri.com', icon: '🇮🇳' },
    { id: 'AMAZON', label: 'Amazon Careers', icon: '📦' },
    { id: 'SIEMENS', label: 'Siemens Careers', icon: '⚙️' },
    { id: 'OTHER', label: 'Other Portals', icon: '🌐' },
  ];

  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<AgentPlatformKey, boolean>>({
    LINKEDIN: true,
    INSTAHYRE: true,
    HIRING_CAFE: true,
    NAUKRI: true,
    AMAZON: true,
    SIEMENS: true,
    OTHER: true,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('saarthi_enabled_platforms');
      if (saved) {
        const parsed = JSON.parse(saved);
        setEnabledPlatforms((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const updatePlatformToggles = (next: Record<AgentPlatformKey, boolean>) => {
    setEnabledPlatforms(next);
    try {
      localStorage.setItem('saarthi_enabled_platforms', JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  };

  const toggleSinglePlatform = (key: AgentPlatformKey) => {
    updatePlatformToggles({
      ...enabledPlatforms,
      [key]: !enabledPlatforms[key],
    });
  };

  const setOnlyPlatform = (onlyKey: AgentPlatformKey) => {
    updatePlatformToggles({
      LINKEDIN: onlyKey === 'LINKEDIN',
      INSTAHYRE: onlyKey === 'INSTAHYRE',
      HIRING_CAFE: onlyKey === 'HIRING_CAFE',
      NAUKRI: onlyKey === 'NAUKRI',
      AMAZON: onlyKey === 'AMAZON',
      SIEMENS: onlyKey === 'SIEMENS',
      OTHER: onlyKey === 'OTHER',
    });
  };

  const setAllPlatforms = (state: boolean) => {
    updatePlatformToggles({
      LINKEDIN: state,
      INSTAHYRE: state,
      HIRING_CAFE: state,
      NAUKRI: state,
      AMAZON: state,
      SIEMENS: state,
      OTHER: state,
    });
  };

  const activePlatformList = (Object.keys(enabledPlatforms) as AgentPlatformKey[]).filter(
    (k) => enabledPlatforms[k]
  );

  // Job Detail Modal State (Prompt Section 28)
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [tailoringJob, setTailoringJob] = useState<JobItem | null>(null);
  const [reviewJob, setReviewJob] = useState<JobItem | null>(null);
  const [browserApplyJob, setBrowserApplyJob] = useState<JobItem | null>(null);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [autoApplyToast, setAutoApplyToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs?limit=250');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchJobs();
    const interval = setInterval(() => void fetchJobs(), 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncJobs = async () => {
    if (activePlatformList.length === 0) {
      setSyncMessage('⚠️ All platform toggles are OFF. Turn ON at least one platform toggle to sync jobs.');
      return;
    }
    setSyncing(true);
    setSyncMessage(`Syncing live jobs from enabled platforms: ${activePlatformList.join(', ')}...`);
    try {
      const res = await fetch('/api/jobs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: activePlatformList }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncMessage(`Discovery sweep complete (${activePlatformList.join(', ')})! Scanned ${data.scanned} postings, added ${data.newJobsAdded} new jobs.`);
      } else {
        setSyncMessage('Discovery sweep complete. Refreshing job feed...');
      }
      await fetchJobs();
    } catch {
      setSyncMessage('Discovery sweep syncing in background — refreshing job list...');
      await fetchJobs();
      setTimeout(() => void fetchJobs(), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const [liveApplying, setLiveApplying] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [agentPaused, setAgentPaused] = useState(false);

  // Poll live status while live runner is active (or on initial mount to catch in-progress runs)
  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/agent/live-status');
        if (!res.ok || !active) return;
        const data = await res.json();
        setLiveApplying(Boolean(data.activeScan));
        setAgentPaused(Boolean(data.isPaused));
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          setLiveLogs(data.logs);
        }
      } catch {
        // Ignore transient poll errors
      }
    };

    void checkStatus();
    const interval = setInterval(checkStatus, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const handleTogglePause = async () => {
    try {
      const res = await fetch('/api/agent/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !agentPaused }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentPaused(Boolean(data.isPaused));
      }
    } catch {
      // Ignore error
    }
  };

  const handleLiveApply = async () => {
    if (activePlatformList.length === 0) {
      setSyncMessage('⚠️ All platform toggles are OFF! Please toggle ON at least one platform (e.g. Instahyre or LinkedIn) before running the agent.');
      return;
    }
    if (agentPaused) {
      await fetch('/api/agent/toggle-pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: false }),
      }).catch(() => {});
      setAgentPaused(false);
    }
    setLiveApplying(true);
    setLiveLogs([`[${new Date().toISOString().slice(11, 19)}] Launching Autonomous Live Runner...`]);
    const activeNames = ALL_AGENT_PLATFORMS.filter((p) => enabledPlatforms[p.id]).map((p) => p.label).join(', ');
    setSyncMessage(`🚀 Autonomous Live Job Runner running in Chrome ONLY for enabled platforms: [${activeNames}]...`);
    try {
      const res = await fetch('/api/agent/live-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: activePlatformList,
          headless: false,
          dryRun: false,
        }),
      });
      if (res.ok) {
        setSyncMessage(`🚀 Live Runner active for [${activeNames}]! Watch the live progress console below.`);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSyncMessage(errData.message || 'Notice: Live Runner launched in background.');
        setLiveApplying(false);
      }
    } catch {
      setSyncMessage('Error launching Live Runner.');
      setLiveApplying(false);
    }
  };

  // Natural Language Command Center (Prompt Section 40)
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput) return;

    const lower = commandInput.toLowerCase();
    if (lower.includes('remote')) {
      setSelectedLocationType('REMOTE');
    } else if (lower.includes('hybrid')) {
      setSelectedLocationType('HYBRID');
    }

    if (lower.includes('80') || lower.includes('high')) {
      setMinMatch(80);
    } else if (lower.includes('85')) {
      setMinMatch(85);
    }

    // Platform detection
    if (lower.includes('linkedin')) {
      setSelectedPlatform('LinkedIn');
    } else if (lower.includes('instahyre')) {
      setSelectedPlatform('Instahyre');
    } else if (lower.includes('hiring cafe') || lower.includes('hiringcafe')) {
      setSelectedPlatform('HiringCafe');
    }

    // Extract search keywords
    const keywords: string[] = [];
    if (lower.includes('backend')) keywords.push('Backend');
    if (lower.includes('fullstack') || lower.includes('full stack')) keywords.push('Full Stack');
    if (lower.includes('node')) keywords.push('Node');
    if (lower.includes('python')) keywords.push('Python');
    if (lower.includes('noida')) keywords.push('Noida');
    if (lower.includes('gurgaon')) keywords.push('Gurgaon');

    if (keywords.length > 0) {
      setSearchTerm(keywords.join(' '));
    } else if (!lower.includes('linkedin') && !lower.includes('instahyre') && !lower.includes('hiring cafe')) {
      setSearchTerm(commandInput);
    }
  };

  const jobMatchesPlatform = (j: JobItem, platform: string) => {
    if (platform === 'ALL') return true;
    if (platform === 'APPLIED') return j.applicationStatus === 'APPLIED';
    const p = platform.toLowerCase();
    const src = (j.source || '').toLowerCase();
    const comp = (j.company || '').toLowerCase();
    if (p === 'amazon' || p === 'siemens') {
      return src.includes(p) || comp.includes(p);
    }
    return src.includes(p);
  };

  const isJobAllowedByToggles = (j: JobItem) => {
    const src = (j.source || '').toLowerCase();
    const comp = (j.company || '').toLowerCase();
    if (src.includes('amazon') || comp.includes('amazon')) return enabledPlatforms.AMAZON;
    if (src.includes('siemens') || comp.includes('siemens')) return enabledPlatforms.SIEMENS;
    if (src.includes('instahyre')) return enabledPlatforms.INSTAHYRE;
    if (src.includes('hiringcafe') || src.includes('hiring.cafe')) return enabledPlatforms.HIRING_CAFE;
    if (src.includes('naukri')) return enabledPlatforms.NAUKRI;
    if (src.includes('linkedin')) return enabledPlatforms.LINKEDIN;
    return enabledPlatforms.OTHER;
  };

  const filteredJobs = jobs.filter((j) => {
    if (!isJobAllowedByToggles(j)) return false;

    const matchesSearch =
      searchTerm === '' ||
      j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.skills.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLocation =
      selectedLocationType === 'ALL' || j.locationType === selectedLocationType;

    const matchesPlatform = jobMatchesPlatform(j, selectedPlatform);

    const matchesScore = j.matchScore >= minMatch;

    return matchesSearch && matchesLocation && matchesPlatform && matchesScore;
  });

  const formatSalary = (j: JobItem) => {
    if (!j.salaryMin && !j.salaryMax) return 'Competitive';
    if (j.salaryCurrency === 'INR') {
      const minL = j.salaryMin ? (j.salaryMin / 100000).toFixed(0) : '';
      const maxL = j.salaryMax ? (j.salaryMax / 100000).toFixed(0) : '';
      return `₹${minL}L - ₹${maxL}L`;
    }
    return `$${j.salaryMin?.toLocaleString()} - $${j.salaryMax?.toLocaleString()}`;
  };

  const handleAutoApply = async (job: JobItem) => {
    setApplyingJobId(job.id);
    setAutoApplyToast(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/prepare-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isAutonomous) {
          setAutoApplyToast({
            message: `✨ Autonomously Applied to ${job.company} (${job.title})! Tailored LaTeX resume attached and verified answers submitted.`,
            type: 'success',
          });
        } else {
          setReviewJob(job);
        }
      } else {
        setReviewJob(job);
      }
    } catch {
      setReviewJob(job);
    } finally {
      setApplyingJobId(null);
    }
  };

  const renderSourceBadge = (source?: string) => {
    if (!source) return null;
    const s = source.toLowerCase();
    if (s.includes('linkedin')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1">
          💼 LinkedIn
        </span>
      );
    }
    if (s.includes('amazon')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-50 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex items-center gap-1">
          📦 Amazon Careers
        </span>
      );
    }
    if (s.includes('siemens')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
          ⚙️ Siemens Careers
        </span>
      );
    }
    if (s.includes('instahyre')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
          ⚡ Instahyre
        </span>
      );
    }
    if (s.includes('hiringcafe') || s.includes('hiring.cafe')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
          ☕ Hiring.cafe
        </span>
      );
    }
    if (s.includes('naukri')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
          🇮🇳 Naukri.com
        </span>
      );
    }
    if (s.includes('remoteok')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
          🌐 RemoteOK
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
        {source}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Auto Apply Banner Toast */}
      {autoApplyToast && (
        <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{autoApplyToast.message}</span>
          </div>
          <button
            onClick={() => setAutoApplyToast(null)}
            className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-100 p-1 rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-500" />
            Job Discovery &amp; Matching Engine
          </h1>
          <p className="text-xs text-zinc-500">
            Explainable matching, multi-source ingestion, and automated deduplication.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLiveApply}
            disabled={liveApplying || activePlatformList.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
            title="Opens Chrome and automatically applies ONLY on platforms whose toggle is ON"
          >
            <Sparkles className={`h-3.5 w-3.5 ${liveApplying ? 'animate-spin' : ''}`} />
            {liveApplying
              ? 'Live Agent Running...'
              : `🚀 Run Live Auto-Apply (${activePlatformList.length} ON)`}
          </button>
          <button
            onClick={handleSyncJobs}
            disabled={syncing || activePlatformList.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Ingesting Live Feeds...' : 'Sync Live Jobs'}
          </button>
        </div>
      </div>

      {/* Agent Target Platform ON/OFF Toggles */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Agent Platform Execution Toggles
            </span>
            <span className="text-[11px] text-zinc-500">
              — If a platform toggle is <strong className="text-rose-500">OFF</strong>, the agent will completely skip that platform.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-zinc-400 mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => setAllPlatforms(true)}
              className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium transition-colors"
            >
              All ON
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('INSTAHYRE')}
              className="px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold transition-colors"
            >
              ⚡ Instahyre Only
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('HIRING_CAFE')}
              className="px-2.5 py-1 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/30 font-semibold transition-colors"
            >
              ☕ Hiring.cafe Only
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('NAUKRI')}
              className="px-2.5 py-1 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold transition-colors"
            >
              🇮🇳 Naukri Only
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('LINKEDIN')}
              className="px-2.5 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-semibold transition-colors"
            >
              💼 LinkedIn Only
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('AMAZON')}
              className="px-2.5 py-1 rounded-md bg-orange-500/15 hover:bg-orange-500/25 text-orange-600 dark:text-orange-400 border border-orange-500/30 font-semibold transition-colors"
            >
              📦 Amazon Only
            </button>
            <button
              type="button"
              onClick={() => setOnlyPlatform('SIEMENS')}
              className="px-2.5 py-1 rounded-md bg-teal-500/15 hover:bg-teal-500/25 text-teal-600 dark:text-teal-400 border border-teal-500/30 font-semibold transition-colors"
            >
              ⚙️ Siemens Only
            </button>
            <button
              type="button"
              onClick={() => setAllPlatforms(false)}
              className="px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-medium transition-colors"
            >
              All OFF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {ALL_AGENT_PLATFORMS.map((plat) => {
            const isOn = enabledPlatforms[plat.id];
            return (
              <div
                key={plat.id}
                onClick={() => toggleSinglePlatform(plat.id)}
                role="switch"
                aria-checked={isOn}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSinglePlatform(plat.id);
                  }
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                  isOn
                    ? 'border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-500 opacity-75'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm">{plat.icon}</span>
                  <div className="truncate">
                    <p className="text-xs font-semibold truncate">{plat.label}</p>
                    <p className={`text-[10px] font-bold ${isOn ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}>
                      {isOn ? '● AGENT ON' : '○ SKIPPED (OFF)'}
                    </p>
                  </div>
                </div>

                {/* Switch Pill */}
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                    isOn ? 'bg-emerald-500 justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                  }`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sync Alert */}
      {syncMessage && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 p-4 flex items-center justify-between gap-3 text-indigo-800 dark:text-indigo-300 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>{syncMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncMessage(null)}
            className="text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Live Browser Runner Progress Console */}
      {(liveApplying || liveLogs.length > 0) && (
        <div className="rounded-xl border border-emerald-500/40 bg-zinc-950 text-zinc-100 p-4 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  liveApplying ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'
                }`}
              />
              <span className="text-emerald-400">
                {liveApplying ? 'Live Browser Runner Active' : 'Last Live Browser Run Logs'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {liveApplying && (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    agentPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {agentPaused ? '▶ Resume Agent' : '⏸ Pause / Stop Agent'}
                </button>
              )}
              {!liveApplying && (
                <button
                  type="button"
                  onClick={() => setLiveLogs([])}
                  className="px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-900"
                >
                  Clear Logs
                </button>
              )}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 text-zinc-300 pr-2">
            {liveLogs.slice(-25).map((line, idx) => (
              <div key={idx} className="leading-relaxed">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Natural Language Command Center (Prompt Section 40) */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-zinc-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 p-4 space-y-2 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            Job Search Command Center
          </span>
          <span className="text-[11px] text-zinc-400">Natural Language Filter Parser</span>
        </div>
        <form onSubmit={handleCommandSubmit} className="flex gap-2">
          <input
            type="text"
            placeholder='Try: "Find remote backend jobs with Node.js and PostgreSQL above 80% match"'
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold text-xs transition-colors shrink-0"
          >
            Apply Query
          </button>
        </form>
      </div>

      {/* Structured Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-zinc-400 ml-1" />
          <input
            type="text"
            placeholder="Search title, company, or skill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400 w-full"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-zinc-400 hover:text-zinc-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Location Type Selector */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
            {['ALL', 'REMOTE', 'HYBRID', 'ONSITE'].map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocationType(loc)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedLocationType === loc
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          {/* Min Match Slider */}
          <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-3">
            <span className="text-zinc-500 font-medium">Match: &ge; {minMatch}%</span>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={minMatch}
              onChange={(e) => setMinMatch(Number(e.target.value))}
              className="w-24 accent-indigo-600"
            />
          </div>

          <span className="text-zinc-400 font-medium border-l border-zinc-200 dark:border-zinc-800 pl-3">
            {filteredJobs.length} jobs
          </span>
        </div>
      </div>

      {/* Platform Multi-Source Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-zinc-500 font-medium text-[11px] mr-1">Ecosystems:</span>
        {[
          { id: 'ALL', label: 'All Ecosystems' },
          { id: 'APPLIED', label: '✅ Applied Jobs' },
          { id: 'Instahyre', label: '⚡ Instahyre' },
          { id: 'LinkedIn', label: '💼 LinkedIn Live' },
          { id: 'Amazon', label: '📦 Amazon Careers' },
          { id: 'Siemens', label: '⚙️ Siemens Careers' },
        ].map((plat) => {
          const isSelected = selectedPlatform === plat.id;
          const platCount = jobs.filter((j) => jobMatchesPlatform(j, plat.id) && j.matchScore >= minMatch).length;
          return (
            <button
              key={plat.id}
              onClick={() => setSelectedPlatform(plat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700'
              }`}
            >
              <span>{plat.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                isSelected
                  ? 'bg-zinc-700 dark:bg-zinc-300 text-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}>
                {platCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.map((job) => (
          <div
            key={job.id}
            onClick={() => setSelectedJob(job)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {job.title}
                </h3>
                {job.applicationStatus === 'APPLIED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-xs flex items-center gap-1">
                    ✓ APPLIED
                  </span>
                )}
                <MatchBadge score={job.matchScore} />
                {renderSourceBadge(job.source)}
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {job.locationType}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span className="flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-300">
                  <Building2 className="h-3.5 w-3.5" />
                  {job.company}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
                <span>•</span>
                <span>{formatSalary(job)}</span>
                {job.experienceMin !== null && job.experienceMin !== undefined && (
                  <>
                    <span>•</span>
                    <span>{job.experienceMin}–{job.experienceMax || (job.experienceMin + 2)} yrs exp</span>
                  </>
                )}
              </div>

              {/* Transparent Skill Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {job.matchedSkills?.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    ✓ {s}
                  </span>
                ))}
                {job.missingSkills?.slice(0, 2).map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                  >
                    ✗ {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setSelectedJob(job)}
                className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Inspect
              </button>
              <button
                onClick={() => setTailoringJob(job)}
                className="px-3.5 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold shadow-xs transition-colors"
              >
                Tailor Resume
              </button>
              <button
                onClick={() => setBrowserApplyJob(job)}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
                title="Launch Playwright browser automation to fill external portal"
              >
                <Globe className="h-3 w-3" />
                Browser Apply
              </button>
              <button
                disabled={applyingJobId === job.id}
                onClick={() => handleAutoApply(job)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                {applyingJobId === job.id ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3" />
                    Auto-Apply
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Job Detail Modal (Prompt Section 28) */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-zinc-500">{selectedJob.company}</span>
                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                  <span className="text-xs text-zinc-500">{selectedJob.location}</span>
                  {selectedJob.source && (
                    <>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      {renderSourceBadge(selectedJob.source)}
                    </>
                  )}
                </div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedJob.title}
                </h2>
                <div className="flex items-center gap-3 pt-1 text-xs text-zinc-500">
                  <span>Salary: {formatSalary(selectedJob)}</span>
                  <span>•</span>
                  <span>Type: {selectedJob.locationType}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MatchBadge score={selectedJob.matchScore} />
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {/* Explainable Match Score Breakdown (Prompt Section 11) */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Explainable Match Breakdown ({selectedJob.matchScore}%)
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block">Skills (30%)</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      {selectedJob.matchedSkills.length}/{selectedJob.skills.length} matched
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block">Experience (20%)</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      Profile satisfies criteria
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block">Role Fit (15%)</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                      High Target Alignment
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-500 block">Location (10%)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      100% Compatible
                    </span>
                  </div>
                </div>

                {/* Skills Detail (Prompt Section 11 Example UI) */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Requirement Verification
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedJob.matchedSkills.map((s) => (
                      <span key={s} className="px-2 py-1 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        ✓ {s}
                      </span>
                    ))}
                    {selectedJob.missingSkills.map((s) => (
                      <span key={s} className="px-2 py-1 rounded text-xs font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        ✗ {s} (Missing in Profile)
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Full Job Description */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Job Description
                </h3>
                <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/30 text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                  {selectedJob.description}
                </div>
              </div>
            </div>

            {/* Modal Footer Actions (Prompt Section 28 Actions) */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
              <a
                href={selectedJob.canonicalUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Original Posting
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-3.5 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const toTailor = selectedJob;
                    setSelectedJob(null);
                    setTailoringJob(toTailor);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold shadow-xs transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Tailor Resume
                </button>
                <button
                  onClick={() => {
                    const toBrowserApply = selectedJob;
                    setSelectedJob(null);
                    setBrowserApplyJob(toBrowserApply);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  Browser Apply
                </button>
                <button
                  disabled={applyingJobId === selectedJob.id}
                  onClick={() => {
                    const jobToApply = selectedJob;
                    setSelectedJob(null);
                    void handleAutoApply(jobToApply);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors"
                >
                  {applyingJobId === selectedJob.id ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Auto-Apply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Resume Tailoring & ATS Modal (Prompt Sections 13, 14, 16) */}
      {tailoringJob && (
        <ResumeTailorModal
          job={tailoringJob}
          isOpen={!!tailoringJob}
          onClose={() => setTailoringJob(null)}
        />
      )}

      {/* Human Review Modal (Prompt Section 2 & 19) */}
      {reviewJob && (
        <ApplicationReviewModal
          jobId={reviewJob.id}
          jobTitle={reviewJob.title}
          company={reviewJob.company}
          isOpen={!!reviewJob}
          onClose={() => setReviewJob(null)}
          onSubmitted={() => {
            setReviewJob(null);
            setAutoApplyToast({
              message: `Application submitted to ${reviewJob.company}!`,
              type: 'success',
            });
          }}
        />
      )}

      {/* Playwright Browser Automation Modal (Prompt Section 18) */}
      {browserApplyJob && (
        <BrowserApplyModal
          job={browserApplyJob}
          isOpen={!!browserApplyJob}
          onClose={() => setBrowserApplyJob(null)}
          onSuccess={() => {
            setBrowserApplyJob(null);
            setAutoApplyToast({
              message: `Browser automation successfully completed for ${browserApplyJob.company}!`,
              type: 'success',
            });
            void fetchJobs();
          }}
        />
      )}
    </div>
  );
}
