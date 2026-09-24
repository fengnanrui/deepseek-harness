// @vitest-environment jsdom
/**
 * `useAnchoredMaxHeight` clamps a bottom-anchored overlay to the space above
 * its bottom edge, keeping a 12px viewport margin that widens to the frame's
 * published `--dsh-frame-top-clearance` (the macOS window strip).
 */
import { useRef } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAnchoredMaxHeight } from '../src/useAnchoredMaxHeight.ts'

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty('--dsh-frame-top-clearance')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Host({ open = true, cap = 320, margin }: { open?: boolean; cap?: number; margin?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const maxHeight = useAnchoredMaxHeight(ref, cap, open, margin)
  return open ? <div ref={ref} data-testid="overlay" style={{ maxHeight }} /> : null
}

/** Render the hook against an element whose bottom edge sits at `bottom`. */
function Probe({ cap, margin }: { cap: number; margin?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const maxHeight = useAnchoredMaxHeight(ref, cap, 0, margin)
  return <div ref={ref} data-testid="probe" data-max-height={maxHeight} />
}

/** Pin jsdom's zero-size layout to a fixed bottom edge. */
function stubBottom(bottom: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, bottom - 100, 200, 100),
  )
}

describe('useAnchoredMaxHeight', () => {
  it('clamps to the space above the bottom edge minus the 12px margin', () => {
    stubBottom(300)
    const { getByTestId } = render(<Probe cap={400} />)
    expect(getByTestId('probe').dataset.maxHeight).toBe('288')
  })

  it('widens the margin to the frame top clearance when published', () => {
    document.documentElement.style.setProperty('--dsh-frame-top-clearance', '48px')
    stubBottom(300)
    const { getByTestId } = render(<Probe cap={400} />)
    expect(getByTestId('probe').dataset.maxHeight).toBe('252')
  })

  it('keeps a caller-raised margin over a published smaller clearance', () => {
    document.documentElement.style.setProperty('--dsh-frame-top-clearance', '48px')
    stubBottom(300)
    const { getByTestId } = render(<Probe cap={400} margin={84} />)
    expect(getByTestId('probe').dataset.maxHeight).toBe('216')
  })

  it('never exceeds the design cap', () => {
    stubBottom(300)
    const { getByTestId } = render(<Probe cap={100} />)
    expect(getByTestId('probe').dataset.maxHeight).toBe('100')
  })
})

describe('bottom-anchored overlay height', () => {
  it('fits above the visible top edge after keyboard panning and releases listeners', () => {
    const viewport = Object.assign(new EventTarget(), { offsetTop: 80 })
    vi.stubGlobal('visualViewport', viewport)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 300))
    const remove = vi.spyOn(viewport, 'removeEventListener')
    const ui = render(<Host />)
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('208px')
    act(() => {
      viewport.offsetTop = 120
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('168px')
    act(() => {
      viewport.offsetTop = 400
      viewport.dispatchEvent(new Event('scroll'))
    })
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('0px')
    ui.rerender(<Host open={false} />)
    expect(remove.mock.calls.map(([type]) => type)).toEqual(['resize', 'scroll'])
  })

  it('retains the design cap and uses the layout viewport when visualViewport is absent', () => {
    vi.stubGlobal('visualViewport', undefined)
    const geometry = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(0, 0, 240, 800))
    const ui = render(<Host />)
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('320px')
    act(() => {
      geometry.mockReturnValue(new DOMRect(0, 0, 240, 200))
      window.dispatchEvent(new Event('resize'))
    })
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('188px')
    ui.rerender(<Host cap={100} />)
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('100px')
  })

  it('retains frame clearance and the caller margin when the viewport pans', () => {
    vi.stubGlobal('visualViewport', Object.assign(new EventTarget(), { offsetTop: 80 }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 240, 300))
    document.documentElement.style.setProperty('--dsh-frame-top-clearance', '48px')
    const ui = render(<Host />)
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('172px')
    ui.rerender(<Host margin={84} />)
    expect(ui.getByTestId('overlay').style.maxHeight).toBe('136px')
  })

  it('does not subscribe while the overlay is absent', () => {
    const add = vi.spyOn(window, 'addEventListener')
    render(<Host open={false} />)
    expect(add.mock.calls.filter(([type]) => type === 'resize' || type === 'scroll')).toEqual([])
  })
})
