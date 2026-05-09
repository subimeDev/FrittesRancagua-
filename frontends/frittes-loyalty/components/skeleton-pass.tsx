export function SkeletonPass(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-pass border border-line bg-cream-elev shadow-pass">
      <div className="h-24 animate-pulse bg-mustard/70" />
      <div className="space-y-3 p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-cream-muted" />
        <div className="h-8 w-56 animate-pulse rounded bg-cream-muted" />
        <div className="h-16 w-full animate-pulse rounded bg-cream-muted" />
      </div>
      <div className="border-t border-line bg-cream-muted p-6">
        <div className="h-20 w-full animate-pulse rounded bg-cream" />
      </div>
    </div>
  );
}
