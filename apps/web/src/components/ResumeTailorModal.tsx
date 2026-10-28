'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Printer,
  X,
  RotateCcw,
  Code,
  Download,
} from 'lucide-react';

interface TailoredBullet {
  text: string;
  sourceId: string;
  sourceType: 'EXPERIENCE' | 'ACHIEVEMENT' | 'PROJECT';
  originalText: string;
  matchedKeywords: string[];
}

interface TailoredExperience {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  location: string | null;
  bullets: TailoredBullet[];
}

interface TailoredProject {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: TailoredBullet[];
  githubUrl?: string | null;
  liveUrl?: string | null;
}

interface TailoredResume {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  targetRole: string;
  summary: string;
  highlightedSkills: {
    category: string;
    skills: string[];
  }[];
  experiences: TailoredExperience[];
  projects: TailoredProject[];
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    start: string;
    end: string;
  }>;
  bulletCount: number;
}

interface AtsKeywordMatch {
  keyword: string;
  covered: boolean;
  frequency: number;
}

interface AtsReport {
  score: number;
  requiredKeywords: AtsKeywordMatch[];
  preferredKeywords: AtsKeywordMatch[];
  coveredCount: number;
  totalKeywords: number;
  coveragePercentage: number;
  missingCriticalSkills: string[];
  warnings: string[];
  formattingScore: number;
  readabilityScore: number;
  recommendations: string[];
}

interface CoverLetter {
  jobTitle: string;
  company: string;
  salutation: string;
  paragraphs: string[];
  fullText: string;
  wordCount: number;
  highlightedExperiences: string[];
}

interface ResumeTailorModalProps {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    description: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function ResumeTailorModal({ job, isOpen, onClose }: ResumeTailorModalProps) {
  const [activeTab, setActiveTab] = useState<'resume' | 'latex' | 'ats' | 'cover-letter'>('resume');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('Initializing tailoring engine...');
  const [tailorResult, setTailorResult] = useState<{
    versionId: string;
    versionNumber: number;
    resumeId: string;
    tailoredResume: TailoredResume;
    atsReport: AtsReport;
  } | null>(null);

  const [latexCode, setLatexCode] = useState<string>('');
  const [latexLoading, setLatexLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState<CoverLetter | null>(null);
  const [clLoading, setClLoading] = useState(false);
  const [clTone, setClTone] = useState<'professional' | 'direct' | 'technical'>('professional');
  const [selectedBullet, setSelectedBullet] = useState<TailoredBullet | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTailorResult(null);
      setCoverLetter(null);
      setSelectedBullet(null);
      return;
    }

    const runTailoring = async () => {
      setLoading(true);
      setLoadingStep('Extracting required keywords & constraints...');

      const stepTimer1 = setTimeout(() => {
        setLoadingStep('Scanning Verified Experience & Project Banks...');
      }, 700);

      const stepTimer2 = setTimeout(() => {
        setLoadingStep('Enforcing Provenance & Zero-Fabrication Guarantees...');
      }, 1400);

      try {
        const res = await fetch(`/api/jobs/${job.id}/tailor-resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (res.ok) {
          const data = await res.json();
          setTailorResult(data);
        }
      } catch (err) {
        console.error('Tailoring error:', err);
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        setLoading(false);
      }
    };

    void runTailoring();
  }, [isOpen, job.id]);

  const loadCoverLetter = async (tone = clTone) => {
    setClLoading(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone, targetWordCount: 200 }),
      });
      if (res.ok) {
        const data = await res.json();
        setCoverLetter(data.coverLetter);
      }
    } catch (err) {
      console.error('Cover letter error:', err);
    } finally {
      setClLoading(false);
    }
  };

  const loadLatex = async () => {
    if (!tailorResult?.versionId) return;
    setLatexLoading(true);
    try {
      const res = await fetch(`/api/resumes/versions/${tailorResult.versionId}/export-latex`);
      if (res.ok) {
        const text = await res.text();
        setLatexCode(text);
      }
    } catch (err) {
      console.error('Failed to load LaTeX export', err);
    } finally {
      setLatexLoading(false);
    }
  };

  const handleTabChange = (tab: 'resume' | 'latex' | 'ats' | 'cover-letter') => {
    setActiveTab(tab);
    if (tab === 'cover-letter' && !coverLetter) {
      void loadCoverLetter();
    }
    if (tab === 'latex' && !latexCode) {
      void loadLatex();
    }
  };

  const handleCopyText = () => {
    if (activeTab === 'latex' && latexCode) {
      navigator.clipboard.writeText(latexCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (activeTab === 'cover-letter' && coverLetter) {
      navigator.clipboard.writeText(coverLetter.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else if (tailorResult) {
      const text = `${tailorResult.tailoredResume.fullName}\n${tailorResult.tailoredResume.email} | ${tailorResult.tailoredResume.phone}\n\nSUMMARY\n${tailorResult.tailoredResume.summary}\n\nEXPERIENCE\n` +
        tailorResult.tailoredResume.experiences.map((e) => `${e.company} - ${e.role}\n` + e.bullets.map((b) => `• ${b.text}`).join('\n')).join('\n\n');
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadLatex = () => {
    if (!latexCode) return;
    const blob = new Blob([latexCode], { type: 'text/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dixit_Kumar_${job.company.replace(/[^a-zA-Z0-9]/g, '_')}_Resume.tex`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    if (tailorResult?.versionId) {
      window.open(`/api/resumes/versions/${tailorResult.versionId}/export-html`, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50/60 dark:bg-zinc-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <Sparkles className="h-3 w-3" />
                AI Resume Tailoring Engine
              </span>
              <span className="text-xs text-zinc-400">Targeting {job.company}</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              {job.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {tailorResult && (
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                ATS {tailorResult.atsReport.score}%
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 px-5 gap-6 text-xs font-semibold bg-white dark:bg-zinc-900">
          <button
            onClick={() => handleTabChange('resume')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'resume'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Tailored Resume
            {tailorResult && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                v{tailorResult.versionNumber}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('latex')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'latex'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            Tailored LaTeX (.tex)
          </button>

          <button
            onClick={() => handleTabChange('ats')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'ats'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            ATS Optimization Report
            {tailorResult && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                {tailorResult.atsReport.score}%
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('cover-letter')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'cover-letter'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Role Cover Letter
            {coverLetter && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                {coverLetter.wordCount}w
              </span>
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-10 w-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {loadingStep}
                </p>
                <p className="text-xs text-zinc-400">
                  Verifying facts against your profile to guarantee 0% hallucination.
                </p>
              </div>
            </div>
          ) : !tailorResult ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              Unable to tailor resume. Please ensure your profile is populated.
            </div>
          ) : (
            <>
              {activeTab === 'resume' && (
                <div className="space-y-6">
                  {/* Provenance Banner */}
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/40 p-3.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300">
                      <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                      <span>
                        <strong>Zero-Fabrication Guarantee:</strong> All {tailorResult.tailoredResume.bulletCount} bullets link directly to your verified experience records. Click any bullet to inspect provenance.
                      </span>
                    </div>
                  </div>

                  {/* Resume Paper */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/40 p-6 space-y-5 font-sans shadow-xs">
                    <div className="text-center border-b border-zinc-200 dark:border-zinc-800 pb-4">
                      <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                        {tailorResult.tailoredResume.fullName}
                      </h3>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center justify-center gap-2 flex-wrap">
                        <span>{tailorResult.tailoredResume.email}</span>
                        <span>•</span>
                        <span>{tailorResult.tailoredResume.phone}</span>
                        <span>•</span>
                        <span>{tailorResult.tailoredResume.location}</span>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-500 mb-1.5 border-b border-zinc-200 dark:border-zinc-800 pb-0.5">
                        Professional Summary
                      </h4>
                      <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                        {tailorResult.tailoredResume.summary}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-500 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-0.5">
                        Technical Skills
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        {tailorResult.tailoredResume.highlightedSkills.map((g) => (
                          <div key={g.category} className="flex items-start gap-2">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 w-32 shrink-0">
                              {g.category}:
                            </span>
                            <span className="text-zinc-600 dark:text-zinc-400">
                              {g.skills.join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-500 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-0.5">
                        Professional Experience
                      </h4>
                      <div className="space-y-4">
                        {tailorResult.tailoredResume.experiences.map((exp) => (
                          <div key={exp.id} className="space-y-1.5">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                {exp.role} <span className="font-normal text-zinc-500">&mdash; {exp.company}</span>
                              </span>
                              <span className="text-zinc-500 text-[11px]">
                                {exp.startDate} &ndash; {exp.endDate || 'Present'}
                              </span>
                            </div>
                            <ul className="space-y-1 pl-4 text-xs list-disc text-zinc-700 dark:text-zinc-300">
                              {exp.bullets.map((b, i) => (
                                <li
                                  key={i}
                                  onClick={() => setSelectedBullet(b)}
                                  className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group relative leading-relaxed"
                                >
                                  <span>{b.text}</span>
                                  <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-400 group-hover:text-indigo-500 underline underline-offset-2">
                                    <ShieldCheck className="h-2.5 w-2.5" />
                                    verified provenance
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {tailorResult.tailoredResume.projects.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-500 mb-2 border-b border-zinc-200 dark:border-zinc-800 pb-0.5">
                          Engineering Projects
                        </h4>
                        <div className="space-y-3">
                          {tailorResult.tailoredResume.projects.map((proj) => (
                            <div key={proj.id} className="space-y-1">
                              <div className="flex items-baseline justify-between text-xs">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                  {proj.name}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {proj.technologies.slice(0, 4).join(', ')}
                                </span>
                              </div>
                              <ul className="space-y-1 pl-4 text-xs list-disc text-zinc-700 dark:text-zinc-300">
                                {proj.bullets.map((b, i) => (
                                  <li
                                    key={i}
                                    onClick={() => setSelectedBullet(b)}
                                    className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group leading-relaxed"
                                  >
                                    <span>{b.text}</span>
                                    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-zinc-400 group-hover:text-indigo-500 underline underline-offset-2">
                                      <ShieldCheck className="h-2.5 w-2.5" />
                                      verified provenance
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-500 mb-1 border-b border-zinc-200 dark:border-zinc-800 pb-0.5">
                        Education
                      </h4>
                      {tailorResult.tailoredResume.education.map((ed, idx) => (
                        <div key={idx} className="flex items-baseline justify-between text-xs text-zinc-700 dark:text-zinc-300">
                          <span><strong>{ed.institution}</strong> &mdash; {ed.degree} in {ed.field}</span>
                          <span className="text-zinc-500 text-[11px]">{ed.start} &ndash; {ed.end}</span>
                        </div>
                      ))}
                    </div>

                  </div>

                  {selectedBullet && (
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/70 dark:bg-indigo-950/60 p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-indigo-600" />
                          Provenance Record Audit
                        </span>
                        <button onClick={() => setSelectedBullet(null)} className="text-zinc-400 hover:text-zinc-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-950">
                          <span className="text-[11px] font-semibold text-zinc-500 block">Generated Bullet:</span>
                          <p className="mt-1 text-zinc-800 dark:text-zinc-200">{selectedBullet.text}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-indigo-100 dark:border-indigo-950">
                          <span className="text-[11px] font-semibold text-zinc-500 block">
                            Source Record ({selectedBullet.sourceType} ID: {selectedBullet.sourceId}):
                          </span>
                          <p className="mt-1 text-zinc-800 dark:text-zinc-200">{selectedBullet.originalText}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TAILORED LATEX CODE */}
              {activeTab === 'latex' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Code className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        LaTeX Source Code (.tex)
                      </h3>
                      <p className="text-xs text-zinc-500">
                        Tailored for {job.title} at {job.company}. Ready to compile in Overleaf or TeX Live.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyText}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? 'Copied!' : 'Copy LaTeX'}
                      </button>
                      <button
                        onClick={handleDownloadLatex}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download .tex
                      </button>
                    </div>
                  </div>

                  {latexLoading ? (
                    <div className="py-20 text-center space-y-3">
                      <div className="h-8 w-8 mx-auto rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                      <p className="text-xs text-zinc-500">Generating tailored LaTeX document...</p>
                    </div>
                  ) : (
                    <div className="relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-zinc-300 overflow-x-auto max-h-[500px]">
                      <pre className="whitespace-pre">{latexCode || 'Loading LaTeX code...'}</pre>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ats' && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 bg-gradient-to-r from-emerald-50/60 via-white to-zinc-50 dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-950 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        ATS Optimization Index
                      </span>
                      <h3 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 mt-1">
                        {tailorResult.atsReport.score}%
                      </h3>
                      <p className="text-xs text-zinc-500 mt-1 max-w-md">
                        Based on {tailorResult.atsReport.coveredCount} of {tailorResult.atsReport.totalKeywords} keywords covered, quantitative metric density, and ATS-parseable structure.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs w-full md:w-auto">
                      <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center">
                        <span className="text-zinc-400 block text-[11px]">Readability &amp; Metrics</span>
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {tailorResult.atsReport.readabilityScore}%
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center">
                        <span className="text-zinc-400 block text-[11px]">Format &amp; Sections</span>
                        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                          {tailorResult.atsReport.formattingScore}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Required Keywords Coverage
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {tailorResult.atsReport.requiredKeywords.map((k) => (
                        <span
                          key={k.keyword}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                            k.covered
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {k.covered ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              {k.keyword} <span className="text-[10px] opacity-75">({k.frequency}x)</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5 text-rose-600" />
                              {k.keyword} (Missing)
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {tailorResult.atsReport.missingCriticalSkills.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 p-4 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span>Potential Qualification Gap Detected</span>
                      </div>
                      <p className="text-amber-800 dark:text-amber-400 leading-relaxed">
                        The job description requires{' '}
                        <strong>{tailorResult.atsReport.missingCriticalSkills.join(', ')}</strong>, but these do not exist in your verified profile. Following Saarthi&apos;s anti-fabrication principle, these were not falsely injected. If you have verified experience, add them in your Profile.
                      </p>
                    </div>
                  )}

                  {tailorResult.atsReport.recommendations.length > 0 && (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Optimization Recommendations
                      </h4>
                      <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300 list-disc pl-4">
                        {tailorResult.atsReport.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'cover-letter' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-500">Tone:</span>
                      {(['professional', 'direct', 'technical'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setClTone(t);
                            void loadCoverLetter(t);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] capitalize font-medium transition-colors ${
                            clTone === t
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3">
                      {coverLetter && (
                        <span className="text-zinc-500 text-[11px]">
                          Length: <strong>{coverLetter.wordCount} words</strong> (Prompt target: 150&ndash;250)
                        </span>
                      )}
                      <button
                        onClick={() => void loadCoverLetter()}
                        disabled={clLoading}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs disabled:opacity-50"
                      >
                        <RotateCcw className={`h-3 w-3 ${clLoading ? 'animate-spin' : ''}`} />
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {clLoading ? (
                    <div className="py-16 text-center space-y-3">
                      <div className="h-8 w-8 mx-auto rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                      <p className="text-xs text-zinc-500">Crafting concise role-specific cover letter...</p>
                    </div>
                  ) : coverLetter ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 bg-zinc-50/30 dark:bg-zinc-950/30 space-y-4 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 shadow-xs font-serif">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                        {coverLetter.salutation}
                      </p>
                      {coverLetter.paragraphs.map((p, idx) => (
                        <p key={idx} className="leading-relaxed">
                          {p}
                        </p>
                      ))}
                      <div className="pt-2 font-sans text-zinc-500">
                        <p>Sincerely,</p>
                        <p className="font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                          {tailorResult.tailoredResume.fullName}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50">
          <div className="flex items-center gap-2">
            {tailorResult && (
              <button
                onClick={handlePrintPdf}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>
            )}
            <button
              onClick={handleCopyText}
              disabled={!tailorResult}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copied to Clipboard!' : 'Copy Text'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
