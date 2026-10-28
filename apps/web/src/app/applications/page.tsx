import React from 'react';
import { ApplicationsClient } from '@/components/ApplicationsClient';

export const dynamic = 'force-dynamic';

export default async function ApplicationsPage() {
  let initialRawApps: any[] = [];

  try {
    const res = await fetch('http://127.0.0.1:4000/api/applications', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      initialRawApps = data.applications || [];
    }
  } catch {
    // Fallback to empty array if API is restarting
  }

  return <ApplicationsClient initialRawApps={initialRawApps} />;
}
