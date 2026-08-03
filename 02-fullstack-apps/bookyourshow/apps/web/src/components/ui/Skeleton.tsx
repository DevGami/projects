interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-surface-700/60 ${className}`}
    />
  );
}

// ── Preset Skeletons ────────────────────────────────────────────────────────

export function MovieCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-800 border border-white/8 overflow-hidden">
      <Skeleton className="aspect-[2/3] w-full rounded-none" />
      <div className="p-4 space-y-2.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-5 w-14 rounded-lg" />
          <Skeleton className="h-5 w-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function MovieGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <MovieCardSkeleton key={i} />
      ))}
    </div>
  );
}
