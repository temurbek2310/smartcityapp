import {
	parseRouteResult,
	routeRequestKey,
	routeUnavailable,
	type RouteRequest,
	type RouteResult,
} from '@/lib/routing'

// The browser's side of /api/directions, framework-free so the abort and
// dedup rules can be tested in Node. The React hook (hooks/use-route.ts) is a
// thin subscription on top of this.
//
// No cache on purpose: a real route depends on live traffic, so a result is
// never kept past the request that produced it — not in memory, not in
// localStorage, not in app state. The only sharing is between callers asking
// for the same route *at the same time*.

export const DIRECTIONS_ENDPOINT = '/api/directions'

type Fetch = typeof fetch

function abortError() {
	return new DOMException('The route request was aborted.', 'AbortError')
}

export function isAbortError(error: unknown) {
	return error instanceof DOMException && error.name === 'AbortError'
}

// One request, one answer. Always resolves to a RouteResult — a network
// failure or an unreadable body is an upstream failure — except when
// `signal` aborts, which rejects with an AbortError the caller ignores.
export async function fetchRoute(
	request: RouteRequest,
	{ signal, fetch: fetchImpl = fetch }: { signal?: AbortSignal; fetch?: Fetch } = {},
): Promise<RouteResult> {
	let response: Response
	try {
		response = await fetchImpl(DIRECTIONS_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(request),
			signal,
		})
	} catch {
		if (signal?.aborted) throw abortError()
		return routeUnavailable('upstream')
	}

	try {
		// The endpoint answers every failure with a RouteResult body too, so
		// the body is read whatever the HTTP status says.
		return parseRouteResult(await response.json())
	} catch {
		if (signal?.aborted) throw abortError()
		return routeUnavailable('upstream')
	}
}

type InFlight = {
	promise: Promise<RouteResult>
	controller: AbortController
	subscribers: number
}

// Shares one network request between everyone asking for the same route at
// once (keyed by routeRequestKey). Each caller brings its own AbortSignal;
// the shared request is only cancelled when the last caller waiting on it
// has gone. Once it settles it is forgotten — the next ask is a new request.
export function createRouteLoader({ fetch: fetchImpl }: { fetch?: Fetch } = {}) {
	const inFlight = new Map<string, InFlight>()

	function load(request: RouteRequest, signal?: AbortSignal): Promise<RouteResult> {
		if (signal?.aborted) return Promise.reject(abortError())

		const key = routeRequestKey(request)
		let entry = inFlight.get(key)
		if (!entry) {
			const controller = new AbortController()
			const created: InFlight = {
				controller,
				subscribers: 0,
				promise: fetchRoute(request, {
					signal: controller.signal,
					fetch: fetchImpl,
				}).finally(() => {
					if (inFlight.get(key) === created) inFlight.delete(key)
				}),
			}
			entry = created
			inFlight.set(key, entry)
		}

		const shared = entry
		shared.subscribers += 1

		return new Promise<RouteResult>((resolve, reject) => {
			let done = false
			const leave = () => {
				if (done) return false
				done = true
				shared.subscribers -= 1
				signal?.removeEventListener('abort', onAbort)
				return true
			}
			const onAbort = () => {
				if (!leave()) return
				if (shared.subscribers === 0) {
					if (inFlight.get(key) === shared) inFlight.delete(key)
					shared.controller.abort()
				}
				reject(abortError())
			}
			signal?.addEventListener('abort', onAbort, { once: true })
			shared.promise.then(
				result => {
					if (leave()) resolve(result)
				},
				error => {
					if (leave()) reject(error)
				},
			)
		})
	}

	return {
		load,
		// For tests and diagnostics: how many distinct requests are open.
		inFlightCount: () => inFlight.size,
	}
}

export type RouteLoader = ReturnType<typeof createRouteLoader>

// --- What a screen shows ------------------------------------------------------
// idle        — nothing to route (no request, or an endpoint that is not real)
// loading     — a request for the current key is open
// ok          — the current key has a real route
// unavailable — the current key has no route, and `reason` says why
export type RouteState =
	| { status: 'idle' }
	| { status: 'loading'; key: string }
	| { status: 'ok'; key: string; route: Extract<RouteResult, { status: 'ok' }> }
	| { status: 'unavailable'; key: string; reason: Extract<RouteResult, { status: 'unavailable' }>['reason'] }

// A settled answer, remembered only with the identity it answers.
export type SettledRoute = { key: string; revision: number; result: RouteResult }

// Derived, never stored: an answer only counts for the exact request and
// retry revision it was fetched for, so a late answer for a previous route —
// or for the attempt before a retry — can never be shown for the current one.
export function deriveRouteState(
	key: string | null,
	revision: number,
	settled: SettledRoute | null,
): RouteState {
	if (key === null) return { status: 'idle' }
	if (!settled || settled.key !== key || settled.revision !== revision) {
		return { status: 'loading', key }
	}
	return settled.result.status === 'ok'
		? { status: 'ok', key, route: settled.result }
		: { status: 'unavailable', key, reason: settled.result.reason }
}
