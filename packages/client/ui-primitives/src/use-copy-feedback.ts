import { useCallback, useEffect, useRef, useState } from 'react'
import { writeClipboard } from './clipboard.ts'

/** How long the `copied` flag stays true after a successful write, in ms. */
const COPIED_FEEDBACK_MS = 1000

/** The copy-feedback hook's return: the transient flag and the copy handler. */
export interface CopyFeedback {
  /** True for {@link COPIED_FEEDBACK_MS} after a successful write; render the success label off it. */
  copied: boolean
  /** Copy the hook's text; no-op during a pending write or feedback, silent on a refused write. */
  onCopy: () => void
}

/**
 * Copy `text` to the clipboard with one-second success feedback.
 * @param text - the text to write on copy.
 * @returns the `copied` flag and the `onCopy` handler.
 */
export function useCopyFeedback(text: string): CopyFeedback {
  const [copied, setCopied] = useState(false)
  const generation = useRef(0)
  const busy = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    setCopied(false)
    busy.current = false
    return () => {
      generation.current++
      busy.current = false
      window.clearTimeout(timer.current)
    }
  }, [text])
  const onCopy = useCallback(() => {
    if (busy.current) return
    busy.current = true
    const attempt = generation.current
    void writeClipboard(text).then((ok) => {
      if (attempt !== generation.current) return
      if (!ok) { busy.current = false; return }
      setCopied(true)
      timer.current = window.setTimeout(() => {
        busy.current = false
        setCopied(false)
      }, COPIED_FEEDBACK_MS)
    })
  }, [text])
  return { copied, onCopy }
}
