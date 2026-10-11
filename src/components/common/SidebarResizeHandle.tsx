import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, sidebarWidth } from './sidebar-preferences'

export function SidebarResizeHandle({ width, onResize }: { width: number; onResize: (width: number) => void }) {
  const handle = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const element = handle.current
    if (!element) return
    const resizeOnWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()
      onResize(sidebarWidth(width + Math.sign(event.deltaY) * 12))
    }
    element.addEventListener('wheel', resizeOnWheel, { passive: false })
    return () => element.removeEventListener('wheel', resizeOnWheel)
  }, [onResize, width])

  function onKeyDown(event: KeyboardEvent) {
    const next = { ArrowLeft: width - 12, ArrowRight: width + 12, Home: SIDEBAR_MIN, End: SIDEBAR_MAX }[event.key]
    if (next === undefined) return
    event.preventDefault()
    onResize(sidebarWidth(next))
  }

  return <div ref={handle} className={`sidebar-resize-handle${dragging ? ' is-dragging' : ''}`}
    role="separator" tabIndex={0} aria-label="Sidebar width" aria-orientation="vertical" aria-controls="desktop-sidebar"
    aria-valuemin={SIDEBAR_MIN} aria-valuemax={SIDEBAR_MAX} aria-valuenow={width} aria-valuetext={`${width} pixels`}
    title="Drag or scroll to resize. Arrow keys adjust width. Double-click to reset."
    onKeyDown={onKeyDown} onDoubleClick={() => onResize(SIDEBAR_DEFAULT)}
    onPointerDown={event => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { x: event.clientX, width }
      setDragging(true)
    }}
    onPointerMove={event => { if (drag.current) onResize(sidebarWidth(drag.current.width + event.clientX - drag.current.x)) }}
    onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
    onPointerCancel={() => { drag.current = null; setDragging(false) }}
  ><span /></div>
}
