export function LoadingState() {
  return (
    <div role="status" className="flex min-h-64 items-center justify-center gap-3 text-muted">
      <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-line border-t-forest motion-reduce:animate-none" />
      Loading FoodBridge…
    </div>
  )
}
