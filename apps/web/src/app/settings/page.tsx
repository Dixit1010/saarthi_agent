'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Save,
  CheckCircle2,
  Building2,
  MapPin,
  IndianRupee,
  Clock,
  Sparkles,
  ExternalLink,
  Shield,
  Key,
  Globe,
  Tag,
  Plus,
  X,
  FileCode,
  Code2,
  Terminal,
  Trophy,
  FolderGit2,
} from 'lucide-react';

interface ConfigState {
  candidate: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    experienceYears: number;
    currentSalary: string;
    expectedSalary: string;
    noticePeriod: string;
    workAuthorization: string;
    linkedinUrl?: string;
    githubUrl?: string;
    portfolioUrl?: string;
    leetcodeUrl?: string;
    codeforcesUrl?: string;
    hackerrankUrl?: string;
    codechefUrl?: string;
    geeksforgeeksUrl?: string;
    otherCodingUrl?: string;
  };
  searchPreferences: {
    targetRoles: string[];
    keywords: string[];
    targetLocations: string[];
    experienceLevel: string;
    minimumMatchScore: number;
    remoteOnly: boolean;
    customSearchQueries?: string[];
    past24HoursOnly?: boolean;
  };
  automation: {
    mode: 'MANUAL' | 'ASSISTED' | 'AUTONOMOUS';
    autoApplyThresholdScore: number;
    dryRun: boolean;
    dailyApplicationLimit: number;
    watchBrowser: boolean;
  };
  credentials: {
    naukri: { profileUrl: string; username: string; password?: string };
    linkedin: { username: string; password?: string };
    instahyre: { username: string; password?: string };
  };
}

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Quick inputs
  const [newRole, setNewRole] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newQuery, setNewQuery] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          setConfig(data.config);
        }
      } catch (err) {
        console.error('Failed to load config', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Failed to save config', err);
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    if (!newRole.trim() || !config) return;
    if (!config.searchPreferences.targetRoles.includes(newRole.trim())) {
      setConfig({
        ...config,
        searchPreferences: {
          ...config.searchPreferences,
          targetRoles: [...config.searchPreferences.targetRoles, newRole.trim()],
        },
      });
    }
    setNewRole('');
  };

  const removeRole = (role: string) => {
    if (!config) return;
    setConfig({
      ...config,
      searchPreferences: {
        ...config.searchPreferences,
        targetRoles: config.searchPreferences.targetRoles.filter((r) => r !== role),
      },
    });
  };

  const addKeyword = () => {
    if (!newKeyword.trim() || !config) return;
    if (!config.searchPreferences.keywords.includes(newKeyword.trim())) {
      setConfig({
        ...config,
        searchPreferences: {
          ...config.searchPreferences,
          keywords: [...config.searchPreferences.keywords, newKeyword.trim()],
        },
      });
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    if (!config) return;
    setConfig({
      ...config,
      searchPreferences: {
        ...config.searchPreferences,
        keywords: config.searchPreferences.keywords.filter((k) => k !== kw),
      },
    });
  };

  const addLocation = () => {
    if (!newLocation.trim() || !config) return;
    if (!config.searchPreferences.targetLocations.includes(newLocation.trim())) {
      setConfig({
        ...config,
        searchPreferences: {
          ...config.searchPreferences,
          targetLocations: [...config.searchPreferences.targetLocations, newLocation.trim()],
        },
      });
    }
    setNewLocation('');
  };

  const removeLocation = (loc: string) => {
    if (!config) return;
    setConfig({
      ...config,
      searchPreferences: {
        ...config.searchPreferences,
        targetLocations: config.searchPreferences.targetLocations.filter((l) => l !== loc),
      },
    });
  };

  const addCustomQuery = () => {
    if (!newQuery.trim() || !config) return;
    const current = config.searchPreferences.customSearchQueries || [];
    if (!current.includes(newQuery.trim())) {
      setConfig({
        ...config,
        searchPreferences: {
          ...config.searchPreferences,
          customSearchQueries: [...current, newQuery.trim()],
        },
      });
    }
    setNewQuery('');
  };

  const removeCustomQuery = (q: string) => {
    if (!config) return;
    setConfig({
      ...config,
      searchPreferences: {
        ...config.searchPreferences,
        customSearchQueries: (config.searchPreferences.customSearchQueries || []).filter((item) => item !== q),
      },
    });
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs">Loading agent configuration...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-8 text-center text-sm text-zinc-500">
        Configuration could not be loaded. Please ensure agent.config.json exists in root.
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Agent Configuration
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              agent.config.json
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mt-1">
            Job Targeting &amp; Automation Preferences
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Target designations, locations, CTC, notice period, and search keywords for automated querying across all platforms.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-sm transition-all"
        >
          {saving ? (
            'Saving...'
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          Configuration updated and saved to agent.config.json! All scrapers and auto-apply engines will now use these queries.
        </div>
      )}

      {/* 1. Target Roles & Designations */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Target Job Roles &amp; Designations
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Scrapers on LinkedIn, Instahyre, and HiringCafe will run active searches for these roles.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {config.searchPreferences.targetRoles.map((role) => (
            <span
              key={role}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold"
            >
              {role}
              <button
                onClick={() => removeRole(role)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-md pt-2">
          <input
            type="text"
            placeholder="Add designation (e.g. SDE-2, Golang Engineer)..."
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRole()}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={addRole}
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {/* 2. Custom LinkedIn Boolean Queries & 24h Filter */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              LinkedIn Boolean Search &amp; 24-Hour Freshness Filter
            </h2>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={config.searchPreferences.past24HoursOnly ?? true}
              onChange={(e) =>
                setConfig({
                  ...config,
                  searchPreferences: {
                    ...config.searchPreferences,
                    past24HoursOnly: e.target.checked,
                  },
                })
              }
              className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-indigo-500" />
              Past 24 Hours Only (&amp;f_TPR=r86400)
            </span>
          </label>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          The scraper executes these exact queries on LinkedIn&apos;s live search engine. Supports full Boolean logic (<code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">AND</code>, <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">OR</code>, and <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">NOT</code> filters).
        </p>

        {/* Query list */}
        <div className="space-y-2">
          {(config.searchPreferences.customSearchQueries || []).map((query, idx) => (
            <div
              key={idx}
              className="flex items-start justify-between gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xs group hover:border-indigo-300 dark:hover:border-indigo-800 transition-all"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5">
                  Q{idx + 1}
                </span>
                <span className="text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all leading-relaxed">
                  {query}
                </span>
              </div>
              <button
                onClick={() => removeCustomQuery(query)}
                className="text-zinc-400 hover:text-rose-500 p-1 shrink-0 transition-colors"
                title="Remove query"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add custom query input */}
        <div className="space-y-2 pt-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder='e.g. ("C++" OR "MTS") AND ("Qualcomm" OR "NVIDIA") NOT ("Senior")'
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomQuery()}
              className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={addCustomQuery}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Add Query
            </button>
          </div>
        </div>
      </div>

      {/* 3. Target Locations & Remote */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Preferred Job Locations
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {config.searchPreferences.targetLocations.map((loc) => (
            <span
              key={loc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold"
            >
              {loc}
              <button
                onClick={() => removeLocation(loc)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-md pt-2">
          <input
            type="text"
            placeholder="Add location (e.g. Pune, Hyderabad, Remote)..."
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addLocation()}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={addLocation}
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {/* 3. Tech Stack Keywords */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-purple-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Target Tech Keywords &amp; Stack
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Postings matching these technologies receive higher match weights in ATS scoring.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {config.searchPreferences.keywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold"
            >
              {kw}
              <button
                onClick={() => removeKeyword(kw)}
                className="hover:text-rose-500 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 max-w-md pt-2">
          <input
            type="text"
            placeholder="Add technology (e.g. Kafka, Redis, AWS, Go)..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-purple-500"
          />
          <button
            onClick={addKeyword}
            className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {/* 4. Compensation & Notice Period (Auto-Fill Profile) */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Candidate Application Defaults
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Used by Playwright and Human Review Gate to fill portal fields accurately without hallucination.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Expected CTC (Salary)
            </label>
            <input
              type="text"
              value={config.candidate.expectedSalary}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, expectedSalary: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Notice Period
            </label>
            <input
              type="text"
              value={config.candidate.noticePeriod}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, noticePeriod: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Experience (Years)
            </label>
            <input
              type="number"
              step="0.5"
              value={config.candidate.experienceYears}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, experienceYears: parseFloat(e.target.value) || 2 },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Contact Phone
            </label>
            <input
              type="text"
              value={config.candidate.phone}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, phone: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Contact Email
            </label>
            <input
              type="email"
              value={config.candidate.email}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, email: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* 5. Developer & Coding Profiles */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-cyan-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Developer Profiles, Coding Platforms &amp; Portfolio
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Autofilled into external portal application forms (e.g. Lever, Greenhouse, AngelList, company career portals).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* GitHub Profile */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <FolderGit2 className="h-3.5 w-3.5 text-zinc-700 dark:text-zinc-300" />
                GitHub Profile
              </label>
              {config.candidate.githubUrl && (
                <a
                  href={config.candidate.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://github.com/dixitkumar300"
              value={config.candidate.githubUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, githubUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* Portfolio Website */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-emerald-500" />
                Portfolio Website
              </label>
              {config.candidate.portfolioUrl && (
                <a
                  href={config.candidate.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  Visit <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://dixitkumar.dev"
              value={config.candidate.portfolioUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, portfolioUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* LeetCode Profile */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-amber-500" />
                LeetCode Profile
              </label>
              {config.candidate.leetcodeUrl && (
                <a
                  href={config.candidate.leetcodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://leetcode.com/u/dixitkumar300"
              value={config.candidate.leetcodeUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, leetcodeUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* Codeforces / Competitive */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-blue-500" />
                Codeforces Profile
              </label>
              {config.candidate.codeforcesUrl && (
                <a
                  href={config.candidate.codeforcesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://codeforces.com/profile/..."
              value={config.candidate.codeforcesUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, codeforcesUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* HackerRank */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-emerald-600" />
                HackerRank Profile
              </label>
              {config.candidate.hackerrankUrl && (
                <a
                  href={config.candidate.hackerrankUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://www.hackerrank.com/..."
              value={config.candidate.hackerrankUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, hackerrankUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* CodeChef / Other Coding Profile */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-purple-500" />
                CodeChef / Other Coding Link
              </label>
              {config.candidate.codechefUrl && (
                <a
                  href={config.candidate.codechefUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://www.codechef.com/users/..."
              value={config.candidate.codechefUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, codechefUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* GeeksforGeeks */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-emerald-500" />
                GeeksforGeeks Profile
              </label>
              {config.candidate.geeksforgeeksUrl && (
                <a
                  href={config.candidate.geeksforgeeksUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <input
              type="text"
              placeholder="https://auth.geeksforgeeks.org/user/..."
              value={config.candidate.geeksforgeeksUrl || ''}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, geeksforgeeksUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>
        </div>
      </div>

      {/* 6. Connected Portals & Credentials */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-indigo-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Connected Job Portals &amp; Credentials
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          Saved locally in <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">agent.config.json</code> (gitignored). Used for persistent browser sessions.
        </p>

        <div className="space-y-4 pt-2">
          {/* Naukri */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                Naukri Profile
              </span>
              <a
                href={config.credentials.naukri.profileUrl || 'https://www.naukri.com/mnjuser/profile'}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium"
              >
                Open Naukri Profile <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <input
              type="text"
              placeholder="Naukri Profile URL"
              value={config.credentials.naukri.profileUrl}
              onChange={(e) =>
                setConfig({
                  ...config,
                  credentials: {
                    ...config.credentials,
                    naukri: { ...config.credentials.naukri, profileUrl: e.target.value },
                  },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>

          {/* LinkedIn */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2">
            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              LinkedIn Profile URL
            </span>
            <input
              type="text"
              value={config.candidate.linkedinUrl}
              onChange={(e) =>
                setConfig({
                  ...config,
                  candidate: { ...config.candidate, linkedinUrl: e.target.value },
                })
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
