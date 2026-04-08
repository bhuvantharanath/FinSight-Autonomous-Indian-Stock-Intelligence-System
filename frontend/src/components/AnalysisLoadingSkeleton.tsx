"use client";

interface AnalysisLoadingSkeletonProps {
  type: "eda" | "ml";
}

function SkeletonBar({ className }: { className: string }) {
  return <div className={`rounded bg-slate-700/60 ${className}`} />;
}

export default function AnalysisLoadingSkeleton({
  type,
}: AnalysisLoadingSkeletonProps) {
  if (type === "eda") {
    return (
      <div className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl p-6 animate-pulse">
        <SkeletonBar className="h-6 w-56 mb-6" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4"
            >
              <SkeletonBar className="h-3 w-20 mb-3" />
              <SkeletonBar className="h-7 w-16 mb-2" />
              <SkeletonBar className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="mb-8">
          <SkeletonBar className="h-4 w-28 mb-3" />
          <div className="flex flex-wrap gap-2">
            <SkeletonBar className="h-8 w-36" />
            <SkeletonBar className="h-8 w-40" />
            <SkeletonBar className="h-8 w-28" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800">
            <SkeletonBar className="h-4 w-40 mb-4" />
            <SkeletonBar className="h-56 w-full" />
          </div>
          <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-800">
            <SkeletonBar className="h-4 w-36 mb-4" />
            <SkeletonBar className="h-56 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-lg shadow-slate-900/20 animate-pulse">
      <div className="flex items-center justify-between mb-8 border-b border-slate-700/50 pb-4 gap-4">
        <SkeletonBar className="h-7 w-40 rounded-full" />
        <SkeletonBar className="h-4 w-52" />
      </div>

      <div className="flex flex-col items-center justify-center mb-10">
        <SkeletonBar className="h-12 w-56 mb-4" />
        <SkeletonBar className="h-7 w-36 mb-6" />
        <SkeletonBar className="h-4 w-60" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
        <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
          <SkeletonBar className="h-4 w-40 mb-4" />
          <SkeletonBar className="h-56 w-full" />
        </div>
        <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
          <SkeletonBar className="h-4 w-56 mb-4" />
          <SkeletonBar className="h-56 w-full" />
        </div>
      </div>
    </div>
  );
}