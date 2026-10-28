import React from 'react';
import { DashboardClient } from '@/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let initialJobs: any[] = [];
  let initialApplications: any[] = [];
  let initialLiveStatus: any = null;

  try {
    const [jobsRes, appsRes, statusRes] = await Promise.all([
      fetch('http://127.0.0.1:4000/api/jobs?limit=50', { cache: 'no-store' }),
      fetch('http://127.0.0.1:4000/api/applications', { cache: 'no-store' }),
      fetch('http://127.0.0.1:4000/api/agent/live-status', { cache: 'no-store' }),
    ]);

    if (jobsRes.ok) {
      const jd = await jobsRes.json();
      initialJobs = jd.jobs || [];
    }
    if (appsRes.ok) {
      const ad = await appsRes.json();
      initialApplications = ad.applications || [];
    }
    if (statusRes.ok) {
      initialLiveStatus = await statusRes.json();
    }
  } catch {
    // Fallback to empty arrays if API is restarting
  }

  return (
    <DashboardClient
      initialJobs={initialJobs}
      initialApplications={initialApplications}
      initialLiveStatus={initialLiveStatus}
    />
  );
}
