export function LoadingState({ label = 'Loading FoodBridge…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 text-muted ${fullScreen ? 'min-h-screen bg-canvas' : 'min-h-64'}`}>
      <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-line border-t-forest motion-reduce:animate-none" />
      {label}
    </div>
  )
}
