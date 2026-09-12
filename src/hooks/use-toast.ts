'use client'

import { useCallback, useEffect, useState } from 'react'

// City Goo's toast timing: TOAST_MS = 2200, and re-triggering restarts the
// window rather than inheriting the remainder of the previous one.
const TOAST_MS = 2200

// Shared toast mechanics for every screen. The payload is generic so a
// caller can hold a plain message (Home, Favorites, parking detail) or a
// tagged value it renders itself (Transport keeps its route duration live
// rather than freezing it into the text). The payload is deliberately kept
// after closing so the message stays put while the toast slides out.
export function useToast<T>(durationMs: number = TOAST_MS) {
	const [payload, setPayload] = useState<T | null>(null)
	const [open, setOpen] = useState(false)
	const [revision, setRevision] = useState(0)

	useEffect(() => {
		if (!open) return

		const timerId = window.setTimeout(() => {
			setOpen(false)
		}, durationMs)

		return () => {
			window.clearTimeout(timerId)
		}
	}, [open, revision, durationMs])

	const show = useCallback((next: T) => {
		setPayload(next)
		setOpen(true)
		setRevision(current => current + 1)
	}, [])

	return { open, payload, show }
}
