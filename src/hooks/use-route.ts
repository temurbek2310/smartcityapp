'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
	createRouteLoader,
	deriveRouteState,
	isAbortError,
	type RouteState,
	type SettledRoute,
} from '@/lib/route-client'
import { routeRequestKey, type RouteRequest } from '@/lib/routing'

// Foundation for real routes on /transport — not wired to any screen yet.
//
// Pass a RouteRequest to fetch it, or null to stay idle (build it with
// realRouteRequest(), which already returns null for the approximate centre).
// The hook:
//  - keys everything on routeRequestKey(), so a new request object for the
//    same route (a re-render, GPS jitter under ~1 m) is not a new fetch;
//  - aborts the previous request the moment the key changes or the screen
//    unmounts, and never shows an answer for a key that is no longer current;
//  - shares one network request between components asking for the same
//    route at once;
//  - fetches only when the key or an explicit retry() changes — no polling,
//    no refresh timer.

// One loader for the whole app, so dedup works across components.
const loader = createRouteLoader()

export function useRoute(request: RouteRequest | null): RouteState & { retry: () => void } {
	const key = request ? routeRequestKey(request) : null
	const [revision, setRevision] = useState(0)
	const [settled, setSettled] = useState<SettledRoute | null>(null)

	// The request object changes identity on every render; only its key
	// decides when to fetch. The latest object is read from here when it does.
	const requestRef = useRef(request)
	useEffect(() => {
		requestRef.current = request
	})

	useEffect(() => {
		const current = requestRef.current
		if (key === null || !current) return

		const controller = new AbortController()
		loader.load(current, controller.signal).then(
			result => {
				if (!controller.signal.aborted) setSettled({ key, revision, result })
			},
			error => {
				// An abort is this effect being replaced — nothing to show.
				if (!isAbortError(error) && !controller.signal.aborted) {
					setSettled({ key, revision, result: { status: 'unavailable', reason: 'upstream' } })
				}
			},
		)
		return () => controller.abort()
	}, [key, revision])

	const retry = useCallback(() => setRevision(current => current + 1), [])

	return { ...deriveRouteState(key, revision, settled), retry }
}
