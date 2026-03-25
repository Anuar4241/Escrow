'use client';

import { Suspense } from 'react';
import AgentsClient from './AgentsClient';

export default function AgentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AgentsClient />
    </Suspense>
  );
}
