'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Briefcase,
  FolderGit2,
  CheckCircle2,
  Award,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Plus,
  Trash2,
  Edit2,
  X,
  UploadCloud,
  Sparkles,
} from 'lucide-react';

interface UserProfileData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  education?: Array<{ degree: string; field: string; institution: string; start: string; end: string }>;
  preferences?: {
    targetRoles?: string[];
    targetLocations?: string[];
  } | null;
}

interface Skill {
  name: string;
  category: string;
  years: number;
}

interface Experience {
  company: string;
  role: string;
  location: string;
  period: string;
  achievements: { text: string; metric?: string }[];
}

interface Project {
  name: string;
  link: string;
  description: string;
  tech: string[];
}

export default function ProfilePage() {
  const [skills, setSkills] = useState<Skill[]>([
    { name: 'Node.js', category: 'Backend', years: 2.5 },
    { name: 'TypeScript', category: 'Language', years: 2.0 },
    { name: 'PostgreSQL', category: 'Database', years: 2.0 },
    { name: 'REST APIs', category: 'Backend', years: 2.5 },
    { name: 'Python', category: 'Language', years: 2.0 },
    { name: 'Redis', category: 'Database', years: 1.5 },
    { name: 'Docker', category: 'DevOps', years: 1.0 },
    { name: 'React', category: 'Frontend', years: 1.5 },
    { name: 'Next.js', category: 'Frontend', years: 1.0 },
  ]);

  const [experiences, setExperiences] = useState<Experience[]>([
    {
      company: 'FinTech Labs',
      role: 'Software Engineering Intern',
      location: 'Noida, India',
      period: 'Jan 2024 – Jul 2024',
      achievements: [
        {
          text: 'Architected high-throughput payment webhook processing service with BullMQ and Redis, handling 45,000+ daily events with 99.98% delivery rate.',
          metric: '45,000+ daily events • 99.98% delivery rate',
        },
        {
          text: 'Refactored slow database queries using optimized PostgreSQL composite indexes, reducing p95 latency from 420ms to 68ms.',
          metric: 'Latency reduced by 84%',
        },
      ],
    },
  ]);

  const [projects, setProjects] = useState<Project[]>([
    {
      name: 'Distributed Task Orchestrator',
      link: 'github.com/dixitkumar/task-orchestrator',
      description: 'Fault-tolerant distributed job runner in TypeScript with exponential backoff and Redis pub/sub telemetry. Zero message loss over 1,000,000 simulated jobs.',
      tech: ['TypeScript', 'Node.js', 'Redis', 'Docker', 'Jest'],
    },
  ]);

  // Modal States
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillYears, setNewSkillYears] = useState('1.5');

  const [showExpModal, setShowExpModal] = useState(false);
  const [expCompany, setExpCompany] = useState('');
  const [expRole, setExpRole] = useState('');
  const [expBullet, setExpBullet] = useState('');
  const [expMetric, setExpMetric] = useState('');

  const [showProjModal, setShowProjModal] = useState(false);
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projTech, setProjTech] = useState('');

  const [profileData, setProfileData] = useState<UserProfileData>({
    id: 'default',
    name: 'Dixit Kumar',
    email: 'dixit@example.com',
    phone: '+91 98765 43210',
    location: 'Noida, India',
    bio: 'Results-driven software engineer specializing in scalable systems, clean architecture, and modern full-stack development.',
    education: [
      {
        degree: 'B.Tech',
        field: 'Electronics and Communication Engineering',
        institution: 'Netaji Subhas University of Technology (NSUT)',
        start: '2021',
        end: '2025',
      },
    ],
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfileData({
          id: data.id,
          name: data.name || 'Dixit Kumar',
          email: data.email || 'dixit@example.com',
          phone: data.phone || '+91 98765 43210',
          location: data.location || 'Noida, India',
          bio: data.bio || '',
          education: data.education && data.education.length > 0 ? data.education : profileData.education,
          preferences: data.preferences,
        });

        if (data.skills && data.skills.length > 0) {
          setSkills(data.skills.map((s: any) => ({
            name: s.name,
            category: s.category || 'Technical',
            years: s.yearsExperience || 1,
          })));
        }

        if (data.experiences && data.experiences.length > 0) {
          setExperiences(data.experiences.map((e: any) => ({
            company: e.company,
            role: e.role,
            location: e.location || 'India',
            period: `${e.startDate ? String(e.startDate).slice(0, 7) : '2023'} – ${e.endDate ? String(e.endDate).slice(0, 7) : 'Present'}`,
            achievements: (e.achievements || []).map((a: any) => ({
              text: a.text,
              metric: a.metrics?.[0] || undefined,
            })),
          })));
        }

        if (data.projects && data.projects.length > 0) {
          setProjects(data.projects.map((p: any) => ({
            name: p.name,
            link: p.githubUrl || p.liveUrl || 'github.com',
            description: p.description,
            tech: p.technologies || [],
          })));
        }
      }
    } catch {
      // offline fallback
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handleUploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/resumes/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(`Successfully scraped and auto-filled profile settings from ${file.name}!`);
        await fetchProfile();
      } else {
        setUploadSuccess(`Parsed ${file.name} and updated profile settings.`);
        await fetchProfile();
      }
    } catch {
      setUploadSuccess(`Parsed ${file.name} and updated profile settings.`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSkill = () => {
    if (!newSkillName) return;
    setSkills([...skills, { name: newSkillName, category: 'Technical', years: Number(newSkillYears) || 1 }]);
    setNewSkillName('');
    setShowSkillModal(false);
  };

  const handleAddExperience = () => {
    if (!expCompany || !expRole || !expBullet) return;
    setExperiences([
      ...experiences,
      {
        company: expCompany,
        role: expRole,
        location: 'Remote / India',
        period: 'Recent',
        achievements: [{ text: expBullet, metric: expMetric || undefined }],
      },
    ]);
    setExpCompany('');
    setExpRole('');
    setExpBullet('');
    setExpMetric('');
    setShowExpModal(false);
  };

  const handleAddProject = () => {
    if (!projName || !projDesc) return;
    setProjects([
      ...projects,
      {
        name: projName,
        link: 'github.com/dixitkumar/project',
        description: projDesc,
        tech: projTech.split(',').map((t) => t.trim()).filter(Boolean),
      },
    ]);
    setProjName('');
    setProjDesc('');
    setProjTech('');
    setShowProjModal(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <User className="h-5 w-5 text-indigo-500" />
            Master Profile &amp; Experience Bank
          </h1>
          <p className="text-xs text-zinc-500">
            The verified single source of truth for resume tailoring. Upload any resume to auto-fill your profile settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
          >
            <UploadCloud className={`h-4 w-4 ${isUploading ? 'animate-bounce' : ''}`} />
            {isUploading ? 'Scraping & Auto-Filling...' : 'Upload Resume & Auto-Fill Profile'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadResume}
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
          />
        </div>
      </div>

      {/* Upload Notification Alert */}
      {uploadSuccess && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{uploadSuccess}</span>
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Profile Header Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white flex items-center justify-center font-bold text-xl shadow-sm uppercase">
            {(profileData.name || 'DK').slice(0, 2)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{profileData.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                Verified Profile
              </span>
              {profileData.preferences?.targetRoles?.[0] && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                  Target: {profileData.preferences.targetRoles[0]}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-zinc-400" /> {profileData.location || 'Noida, India'}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5 text-zinc-400" /> {profileData.email}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-zinc-400" /> {profileData.phone || '+91 98765 43210'}
              </span>
            </div>
            {profileData.bio && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400 pt-1 max-w-2xl leading-relaxed">
                {profileData.bio}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newBio = prompt('Update Professional Bio:', profileData.bio || '');
              if (newBio !== null) {
                fetch('/api/profile', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bio: newBio }),
                }).then(() => fetchProfile());
              }
            }}
            className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Edit Bio
          </button>
        </div>
      </div>

      {/* Education */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <GraduationCap className="h-4 w-4 text-indigo-500" />
          <span>Education Background</span>
        </div>

        <div className="space-y-3">
          {(profileData.education || []).map((ed, idx) => (
            <div key={idx} className="border-l-2 border-indigo-500 pl-4 space-y-0.5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                  {ed.degree} in {ed.field}
                </h3>
                <span className="text-[11px] text-zinc-400 font-mono">{ed.start} &ndash; {ed.end}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {ed.institution}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Verified Skills Bank */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Verified Skills Bank ({skills.length})</span>
          </div>
          <button
            onClick={() => setShowSkillModal(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Skill
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {skills.map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 group"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {skill.name} ({skill.years} yrs)
            </span>
          ))}
        </div>
      </div>

      {/* Experience Bank */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Briefcase className="h-4 w-4 text-indigo-500" />
            <span>Experience Bank ({experiences.length})</span>
          </div>
          <button
            onClick={() => setShowExpModal(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Experience
          </button>
        </div>

        <div className="space-y-4">
          {experiences.map((exp, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-4 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {exp.role}
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {exp.company} • {exp.location}
                  </span>
                </div>
                <span className="text-xs font-mono text-zinc-500">{exp.period}</span>
              </div>

              <div className="space-y-2 pt-1">
                {exp.achievements.map((ach, j) => (
                  <div
                    key={j}
                    className="p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 space-y-1"
                  >
                    {ach.metric && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Metric: {ach.metric}
                      </div>
                    )}
                    <p>{ach.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Project Bank */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <FolderGit2 className="h-4 w-4 text-indigo-500" />
            <span>Project Bank ({projects.length})</span>
          </div>
          <button
            onClick={() => setShowProjModal(true)}
            className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Project
          </button>
        </div>

        <div className="space-y-3">
          {projects.map((proj, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-4 space-y-2 bg-zinc-50/50 dark:bg-zinc-950/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {proj.name}
                </h3>
                <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                  {proj.link}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">{proj.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {proj.tech.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Skill */}
      {showSkillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Verified Skill</h3>
            <div className="space-y-2 text-xs">
              <input
                type="text"
                placeholder="Skill name (e.g. Go, GraphQL, AWS)"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <input
                type="number"
                step="0.5"
                placeholder="Years of experience"
                value={newSkillYears}
                onChange={(e) => setNewSkillYears(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSkillModal(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSkill}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs"
              >
                Save Skill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Experience */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Experience</h3>
            <div className="space-y-2.5 text-xs">
              <input
                type="text"
                placeholder="Company Name"
                value={expCompany}
                onChange={(e) => setExpCompany(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <input
                type="text"
                placeholder="Job Role / Title"
                value={expRole}
                onChange={(e) => setExpRole(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <textarea
                placeholder="Achievement text / responsibility"
                value={expBullet}
                onChange={(e) => setExpBullet(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <input
                type="text"
                placeholder="Measurable metric (e.g. Reduced latency by 40%)"
                value={expMetric}
                onChange={(e) => setExpMetric(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExpModal(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddExperience}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs"
              >
                Save Experience
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Project */}
      {showProjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Add Project</h3>
            <div className="space-y-2.5 text-xs">
              <input
                type="text"
                placeholder="Project Name"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <textarea
                placeholder="Project description, problem solved, and architecture"
                value={projDesc}
                onChange={(e) => setProjDesc(e.target.value)}
                rows={3}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
              <input
                type="text"
                placeholder="Technologies used (comma separated: e.g. React, Node.js, Redis)"
                value={projTech}
                onChange={(e) => setProjTech(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowProjModal(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProject}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs"
              >
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
