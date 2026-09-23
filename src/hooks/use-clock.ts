'use client'

import { useEffect, useState } from 'react'

// The current time, re-read every `intervalMs`. Null until the first client
// tick, so the server's render and the client's first paint agree; callers
// treat null as "time unknown" and fall back to what the status alone says.
export function useClock(intervalMs: number) {
	const [now, setNow] = useState<number | null>(null)
	useEffect(() => {
		const update = () => setNow(Date.now())
		const initial = window.setTimeout(update, 0)
		const interval = window.setInterval(update, intervalMs)
		return () => {
			window.clearTimeout(initial)
			window.clearInterval(interval)
		}
	}, [intervalMs])
	return now
}
