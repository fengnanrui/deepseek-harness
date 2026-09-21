// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useCopyFeedback } from '../src/use-copy-feedback.ts'

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('ignores late clipboard results after text changes and drains feedback timers on unmount', async () => {
  vi.useFakeTimers()
  let finish: (() => void) | undefined
  const writeText = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const hook = renderHook(({ text }) => useCopyFeedback(text), { initialProps: { text: 'old' } })
  act(() => { hook.result.current.onCopy(); hook.result.current.onCopy() })
  expect(writeText).toHaveBeenCalledTimes(1)
  hook.rerender({ text: 'new' })
  await act(async () => { finish?.(); await Promise.resolve() })
  expect(hook.result.current.copied).toBe(false)
  expect(vi.getTimerCount()).toBe(0)
  act(() => { hook.result.current.onCopy() })
  expect(writeText).toHaveBeenLastCalledWith('new')
  await act(async () => { finish?.(); await Promise.resolve() })
  expect(hook.result.current.copied).toBe(true)
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('does not schedule feedback for a write completed after unmount', async () => {
  vi.useFakeTimers()
  let finish: (() => void) | undefined
  vi.stubGlobal('navigator', { clipboard: { writeText: () => new Promise<void>((resolve) => { finish = resolve }) } })
  const hook = renderHook(() => useCopyFeedback('text'))
  act(() => { hook.result.current.onCopy() })
  hook.unmount()
  await act(async () => { finish?.(); await Promise.resolve() })
  expect(vi.getTimerCount()).toBe(0)
})

it('allows retry after refusal and after feedback expires', async () => {
  vi.useFakeTimers()
  const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  const hook = renderHook(() => useCopyFeedback('text'))
  await act(async () => { hook.result.current.onCopy(); await Promise.resolve() })
  expect(hook.result.current.copied).toBe(false)
  await act(async () => { hook.result.current.onCopy(); await Promise.resolve() })
  expect(hook.result.current.copied).toBe(true)
  act(() => { vi.advanceTimersByTime(1000) })
  expect(hook.result.current.copied).toBe(false)
  await act(async () => { hook.result.current.onCopy(); await Promise.resolve() })
  expect(writeText).toHaveBeenCalledTimes(3)
})
