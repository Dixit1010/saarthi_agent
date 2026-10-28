import React from 'react';
import { clsx } from 'clsx';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface MatchBadgeProps {
  score: number;
  showDetails?: boolean;
  matchedCount?: number;
  partialCount?: number;
  missingCount?: number;
}

export function MatchBadge({ score, showDetails, matchedCount, partialCount, missingCount }: MatchBadgeProps) {
  const isHigh = score >= 85;
  const isMedium = score >= 70 && score < 85;

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tracking-tight shadow-xs',
          isHigh
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
            : isMedium
            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
            : 'bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
        )}
      >
        <span
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            isHigh ? 'bg-emerald-500' : isMedium ? 'bg-amber-500' : 'bg-zinc-400'
          )}
        />
        {score}% Match
      </span>

      {showDetails && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          {matchedCount !== undefined && (
            <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {matchedCount}
            </span>
          )}
          {partialCount !== undefined && partialCount > 0 && (
            <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" />
              {partialCount}
            </span>
          )}
          {missingCount !== undefined && missingCount > 0 && (
            <span className="flex items-center gap-0.5 text-rose-500">
              <XCircle className="h-3 w-3" />
              {missingCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
