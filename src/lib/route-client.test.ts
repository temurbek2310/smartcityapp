import { describe, expect, it, vi } from 'vitest'

import {
	createRouteLoader,
	deriveRouteState,
	DIRECTIONS_ENDPOINT,
	fetchRoute,
	isAbortError,
} from '@/lib/route-client'
import { routeRequestKey, routeUnavailable, type RealRoute, type RouteRequest } from '@/lib/routing'

// The browser side of /api/directions, against a mocked fetch. Nothing here
// reaches the app's endpoint, let alone 2GIS.

const REQUEST: RouteRequest = {
	origin: { lat: 41.31108, lng: 69.27968 },
	destination: { lat: 41.33983, lng: 69.21938 },
	mode: 'car',
}
const OTHER: RouteRequest = { ...REQUEST, destination: { lat: 41.2570, lng: 69.2810 } }

const REAL: RealRoute = {
	status: 'ok',
	source: '2gis',
	mode: 'car',
	distanceMeters: 6400,
	durationSeconds: 840,
	geometry: [[69.27968, 41.31108], [69.21938, 41.33983]],
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status })
}

// A fetch whose answers the test releases by hand, and which rejects on abort
// the way the real one does.
function controllableFetch() {
	const calls: { url: string; init?: RequestInit; resolve: (response: Response) => void }[] = []
	const fetchImpl = vi.fn<typeof fetch>((url, init) =>
		new Promise<Response>((resolve, reject) => {
			calls.push({ url: String(url), init, resolve })
			init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
		}),
	)
	return { fetchImpl, calls }
}

describe('fetchRoute', () => {
	it('POSTs the request to the app endpoint and reads a RealRoute', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL))
		await expect(fetchRoute(REQUEST, { fetch: fetchImpl })).resolves.toEqual(REAL)
		const [url, init] = fetchImpl.mock.calls[0]
		expect(url).toBe(DIRECTIONS_ENDPOINT)
		expect(init?.method).toBe('POST')
		expect(JSON.parse(String(init?.body))).toEqual(REQUEST)
	})

	it('reads a failure body whatever the HTTP status', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(routeUnavailable('timeout'), 504))
		await expect(fetchRoute(REQUEST, { fetch: fetchImpl })).resolves.toEqual(routeUnavailable('timeout'))
	})

	it('turns network errors and unreadable bodies into upstream failures', async () => {
		const offline = vi.fn<typeof fetch>(async () => { throw new TypeError('offline') })
		await expect(fetchRoute(REQUEST, { fetch: offline })).resolves.toEqual(routeUnavailable('upstream'))
		const html = vi.fn<typeof fetch>(async () => new Response('<html>', { status: 502 }))
		await expect(fetchRoute(REQUEST, { fetch: html })).resolves.toEqual(routeUnavailable('upstream'))
	})

	it('rejects with AbortError when aborted', async () => {
		const { fetchImpl } = controllableFetch()
		const controller = new AbortController()
		const pending = fetchRoute(REQUEST, { fetch: fetchImpl, signal: controller.signal })
		controller.abort()
		await expect(pending).rejects.toSatisfy(isAbortError)
	})
})

describe('createRouteLoader', () => {
	it('shares one request between identical in-flight asks', async () => {
		const { fetchImpl, calls } = controllableFetch()
		const loader = createRouteLoader({ fetch: fetchImpl })
		const a = loader.load(REQUEST)
		// Same route, jittered by less than the key's precision.
		const b = loader.load({ ...REQUEST, origin: { lat: 41.311081, lng: 69.279679 } })
		expect(fetchImpl).toHaveBeenCalledTimes(1)
		calls[0].resolve(json(REAL))
		await expect(a).resolves.toEqual(REAL)
		await expect(b).resolves.toEqual(REAL)
		expect(loader.inFlightCount()).toBe(0)
	})

	it('does not cache: a settled route is fetched again next time', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => json(REAL))
		const loader = createRouteLoader({ fetch: fetchImpl })
		await loader.load(REQUEST)
		await loader.load(REQUEST)
		expect(fetchImpl).toHaveBeenCalledTimes(2)
	})

	it('keeps a shared request alive while anyone still waits on it', async () => {
		const { fetchImpl, calls } = controllableFetch()
		const loader = createRouteLoader({ fetch: fetchImpl })
		const leaving = new AbortController()
		const a = loader.load(REQUEST, leaving.signal)
		const b = loader.load(REQUEST)
		leaving.abort()
		await expect(a).rejects.toSatisfy(isAbortError)
		expect(calls[0].init?.signal?.aborted).toBe(false)
		calls[0].resolve(json(REAL))
		await expect(b).resolves.toEqual(REAL)
	})

	it('cancels the network request when the last caller leaves', async () => {
		const { fetchImpl, calls } = controllableFetch()
		const loader = createRouteLoader({ fetch: fetchImpl })
		const controller = new AbortController()
		const pending = loader.load(REQUEST, controller.signal)
		controller.abort()
		await expect(pending).rejects.toSatisfy(isAbortError)
		expect(calls[0].init?.signal?.aborted).toBe(true)
		expect(loader.inFlightCount()).toBe(0)
		// And asking again starts a fresh request rather than joining the dead one.
		void loader.load(REQUEST).catch(() => {})
		expect(fetchImpl).toHaveBeenCalledTimes(2)
	})

	it('runs different routes independently', async () => {
		const { fetchImpl, calls } = controllableFetch()
		const loader = createRouteLoader({ fetch: fetchImpl })
		void loader.load(REQUEST)
		void loader.load(OTHER)
		expect(fetchImpl).toHaveBeenCalledTimes(2)
		expect(loader.inFlightCount()).toBe(2)
		calls.forEach(call => call.resolve(json(REAL)))
	})

	it('rejects at once for an already-aborted signal, without fetching', async () => {
		const { fetchImpl } = controllableFetch()
		const loader = createRouteLoader({ fetch: fetchImpl })
		await expect(loader.load(REQUEST, AbortSignal.abort())).rejects.toSatisfy(isAbortError)
		expect(fetchImpl).not.toHaveBeenCalled()
	})
})

describe('deriveRouteState', () => {
	const key = routeRequestKey(REQUEST)
	const otherKey = routeRequestKey(OTHER)

	it('is idle with nothing to route', () => {
		expect(deriveRouteState(null, 0, { key, revision: 0, result: REAL })).toEqual({ status: 'idle' })
	})

	it('is loading until an answer for this exact key and revision arrives', () => {
		expect(deriveRouteState(key, 0, null)).toEqual({ status: 'loading', key })
		// A late answer for the previous route is never shown for this one.
		expect(deriveRouteState(key, 0, { key: otherKey, revision: 0, result: REAL })).toEqual({
			status: 'loading',
			key,
		})
		// Nor the answer from before a retry.
		expect(deriveRouteState(key, 1, { key, revision: 0, result: routeUnavailable('timeout') })).toEqual({
			status: 'loading',
			key,
		})
	})

	it('reports ok and unavailable', () => {
		expect(deriveRouteState(key, 0, { key, revision: 0, result: REAL })).toEqual({
			status: 'ok',
			key,
			route: REAL,
		})
		expect(deriveRouteState(key, 2, { key, revision: 2, result: routeUnavailable('no_route') })).toEqual({
			status: 'unavailable',
			key,
			reason: 'no_route',
		})
	})
})
