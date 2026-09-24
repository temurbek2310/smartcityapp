import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/directions/route'
import { ROUTING_TIMEOUT_MS, TWO_GIS_ROUTING_ENDPOINT } from '@/lib/two-gis-routing'

// Every upstream call is mocked: this suite consumes no 2GIS quota. A test
// that reached the real fetch would fail on the stub below first.

const KEY = 'test-routing-key-SECRET'
const PUBLIC_KEY = 'test-public-mapgl-key'

const AMIR_TEMUR = { lat: 41.31108, lng: 69.27968 }
const HUMO_ARENA = { lat: 41.33983, lng: 69.21938 }

const TWO_GIS_ROUTE = {
	status: 'OK',
	type: 'result',
	result: [
		{
			id: '1',
			total_distance: 6400,
			total_duration: 840,
			begin_pedestrian_path: {
				geometry: { selection: 'LINESTRING(69.27968 41.31108, 69.2797 41.3111)' },
			},
			maneuvers: [
				{ comment: 'start' },
				{
					outcoming_path: {
						geometry: [
							{ selection: 'LINESTRING(69.2797 41.3111, 69.26 41.32)', color: 'fast' },
							{ selection: 'LINESTRING(69.26 41.32, 69.2194 41.3398)', color: 'slow' },
						],
					},
				},
				{ comment: 'finish' },
			],
			end_pedestrian_path: {
				geometry: { selection: 'LINESTRING(69.2194 41.3398, 69.21938 41.33983)' },
			},
		},
	],
}

const fetchMock = vi.fn<typeof fetch>()
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

function call(body: unknown, init: { headers?: Record<string, string>; raw?: string; signal?: AbortSignal } = {}) {
	return POST(
		new Request('http://localhost/api/directions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...init.headers },
			body: init.raw ?? JSON.stringify(body),
			signal: init.signal,
		}),
	)
}

const valid = { origin: AMIR_TEMUR, destination: HUMO_ARENA, mode: 'car' }

function upstreamJson(body: unknown, status = 200) {
	fetchMock.mockResolvedValueOnce(
		new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
	)
}

async function expectResult(response: Response, status: number, body: unknown) {
	expect(response.status).toBe(status)
	const text = await response.text()
	expect(text).not.toContain(KEY)
	expect(JSON.parse(text)).toEqual(body)
}

function expectNoSecretLogged() {
	for (const args of warn.mock.calls) {
		const line = args.map(String).join(' ')
		expect(line).not.toContain(KEY)
		expect(line).not.toContain('key=')
		expect(line).not.toContain('routing.api.2gis.com')
	}
}

beforeEach(() => {
	fetchMock.mockReset()
	warn.mockClear()
	vi.stubGlobal('fetch', fetchMock)
	vi.stubEnv('DGIS_ROUTING_API_KEY', KEY)
	vi.stubEnv('NEXT_PUBLIC_MAPGL_API_KEY', PUBLIC_KEY)
})

afterEach(() => {
	expectNoSecretLogged()
	vi.unstubAllEnvs()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe('POST /api/directions — success', () => {
	it('normalizes a 2GIS route into a B SPACE RealRoute', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		const response = await call(valid)
		await expectResult(response, 200, {
			status: 'ok',
			source: '2gis',
			mode: 'car',
			distanceMeters: 6400,
			durationSeconds: 840,
			// [lng, lat]; every shared joint appears once.
			geometry: [
				[69.27968, 41.31108],
				[69.2797, 41.3111],
				[69.26, 41.32],
				[69.2194, 41.3398],
				[69.21938, 41.33983],
			],
		})
		expect(response.headers.get('cache-control')).toBe('no-store')
	})

	it('asks 2GIS for a detailed fastest driving route with the server key only', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		await call(valid)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(String(url)).toBe(`${TWO_GIS_ROUTING_ENDPOINT}?key=${KEY}`)
		expect(String(url)).not.toContain(PUBLIC_KEY)
		expect(init?.method).toBe('POST')
		expect(init?.signal).toBeInstanceOf(AbortSignal)
		expect(JSON.parse(String(init?.body))).toEqual({
			points: [
				{ type: 'stop', lon: AMIR_TEMUR.lng, lat: AMIR_TEMUR.lat },
				{ type: 'stop', lon: HUMO_ARENA.lng, lat: HUMO_ARENA.lat },
			],
			transport: 'driving',
			route_mode: 'fastest',
			output: 'detailed',
		})
	})

	it('treats a missing mode as car, and rounds coordinates before sending', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		await call({ origin: { lat: 41.311081234, lng: 69.279679999 }, destination: HUMO_ARENA })
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
		expect(body.points[0]).toEqual({ type: 'stop', lon: 69.27968, lat: 41.31108 })
	})
})

// A 2GIS walking answer: no road connectors, the maneuvers follow
// footpaths away from the straight line between the ends.
const TWO_GIS_WALK = {
	status: 'OK',
	type: 'result',
	result: [
		{
			id: '1',
			total_distance: 3120,
			total_duration: 2460,
			maneuvers: [
				{ comment: 'start' },
				{
					outcoming_path: {
						geometry: [
							{ selection: 'LINESTRING(69.27968 41.31108, 69.2702 41.3071)' },
							{ selection: 'LINESTRING(69.2702 41.3071, 69.2555 41.3102)' },
						],
					},
				},
				{
					outcoming_path: {
						geometry: [{ selection: 'LINESTRING(69.2555 41.3102, 69.2486 41.3164)' }],
					},
				},
				{ comment: 'finish' },
			],
		},
	],
}

const OLOY = { lat: 41.3164, lng: 69.2486 }
const walk = { origin: AMIR_TEMUR, destination: OLOY, mode: 'walk' }

describe('POST /api/directions — walking', () => {
	it('asks 2GIS for a detailed walking route (walking, not pedestrian)', async () => {
		upstreamJson(TWO_GIS_WALK)
		await call(walk)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(String(url)).toBe(`${TWO_GIS_ROUTING_ENDPOINT}?key=${KEY}`)
		expect(String(url)).not.toContain('public_transport')
		expect(JSON.parse(String(init?.body))).toEqual({
			points: [
				{ type: 'stop', lon: AMIR_TEMUR.lng, lat: AMIR_TEMUR.lat },
				{ type: 'stop', lon: OLOY.lng, lat: OLOY.lat },
			],
			transport: 'walking',
			route_mode: 'fastest',
			output: 'detailed',
		})
	})

	it('normalizes the walking distance, duration and WKT geometry', async () => {
		upstreamJson(TWO_GIS_WALK)
		await expectResult(await call(walk), 200, {
			status: 'ok',
			source: '2gis',
			mode: 'walk',
			distanceMeters: 3120,
			durationSeconds: 2460,
			geometry: [
				[69.27968, 41.31108],
				[69.2702, 41.3071],
				[69.2555, 41.3102],
				[69.2486, 41.3164],
			],
		})
	})

	it('still maps car to driving', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		await call(valid)
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).transport).toBe('driving')
	})

	it('no_route: 204, empty result, or a not-found status', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
		await expectResult(await call(walk), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'OK', result: [] })
		await expectResult(await call(walk), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'ROUTE_NOT_FOUND' })
		await expectResult(await call(walk), 404, { status: 'unavailable', reason: 'no_route' })
	})

	it('upstream: a malformed walking response is never drawn partially', async () => {
		const broken = structuredClone(TWO_GIS_WALK)
		broken.result[0].maneuvers[2].outcoming_path!.geometry[0].selection = 'LINESTRING(69.2555 41.3102, oops)'
		upstreamJson(broken)
		await expectResult(await call(walk), 502, { status: 'unavailable', reason: 'upstream' })

		const noDuration = structuredClone(TWO_GIS_WALK) as { result: Record<string, unknown>[] }
		delete noDuration.result[0].total_duration
		upstreamJson(noDuration)
		await expectResult(await call(walk), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: HTTP failure', async () => {
		upstreamJson({ message: 'nope' }, 500)
		await expectResult(await call(walk), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('timeout: aborts the upstream walking call', async () => {
		vi.useFakeTimers()
		fetchMock.mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
				}),
		)
		const pending = call(walk)
		await vi.advanceTimersByTimeAsync(ROUTING_TIMEOUT_MS + 1)
		await expectResult(await pending, 504, { status: 'unavailable', reason: 'timeout' })
	})
})

describe('POST /api/directions — refused before any upstream call', () => {
	it('config: no routing key', async () => {
		vi.stubEnv('DGIS_ROUTING_API_KEY', '')
		await expectResult(await call(valid), 503, { status: 'unavailable', reason: 'config' })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('config: the legacy shared variable is no longer read', async () => {
		vi.stubEnv('DGIS_ROUTING_API_KEY', '')
		vi.stubEnv('MAPGL_ROUTING_API_KEY', KEY)
		await expectResult(await call(valid), 503, { status: 'unavailable', reason: 'config' })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('invalid: body that is not JSON', async () => {
		await expectResult(await call(null, { raw: '{not json' }), 400, { status: 'unavailable', reason: 'invalid' })
	})

	it('invalid: wrong shape, extra fields, non-numbers', async () => {
		for (const body of [
			null,
			[],
			{},
			{ origin: AMIR_TEMUR },
			{ ...valid, extra: true },
			{ ...valid, origin: { ...AMIR_TEMUR, alt: 1 } },
			{ ...valid, origin: { lat: '41.3', lng: 69.2 } },
			{ ...valid, origin: { lat: null, lng: 69.2 } },
		]) {
			await expectResult(await call(body), 400, { status: 'unavailable', reason: 'invalid' })
		}
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('invalid: coordinates out of range', async () => {
		await expectResult(
			await call({ ...valid, origin: { lat: 91, lng: 69.2 } }),
			400,
			{ status: 'unavailable', reason: 'invalid' },
		)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('invalid: a point outside Uzbekistan', async () => {
		for (const outside of [
			{ lat: 55.7558, lng: 37.6173 }, // Moscow
			{ lat: 43.2389, lng: 76.8897 }, // Almaty
		]) {
			await expectResult(await call({ ...valid, destination: outside }), 400, {
				status: 'unavailable',
				reason: 'invalid',
			})
		}
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('invalid: modes that are not routed yet — never mapped to another mode', async () => {
		// Provider names are not B SPACE modes either: 'walking' and
		// 'driving' are refused, not passed through.
		for (const mode of ['scooter', 'metro', 'truck', 'pedestrian', 'walking', 'driving', null]) {
			await expectResult(await call({ ...valid, mode }), 400, { status: 'unavailable', reason: 'invalid' })
		}
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('invalid: an oversized body', async () => {
		const raw = JSON.stringify({ ...valid, padding: 'x'.repeat(2000) })
		await expectResult(await call(null, { raw }), 400, { status: 'unavailable', reason: 'invalid' })
	})

	it('refuses a cross-site browser call', async () => {
		await expectResult(await call(valid, { headers: { 'Sec-Fetch-Site': 'cross-site' } }), 403, {
			status: 'unavailable',
			reason: 'invalid',
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

describe('POST /api/directions — upstream failures', () => {
	it('upstream: 4xx (e.g. a key without the Routing product)', async () => {
		upstreamJson({ message: `Invalid key ${KEY}` }, 403)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: 5xx', async () => {
		upstreamJson({ error: 'internal' }, 500)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: network error', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError(`fetch failed: ${TWO_GIS_ROUTING_ENDPOINT}?key=${KEY}`))
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('timeout: aborts the upstream call and says so', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		let upstreamSignal: AbortSignal | undefined
		fetchMock.mockImplementationOnce((_url, init) => {
			upstreamSignal = init?.signal ?? undefined
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () =>
					reject(new DOMException('aborted', 'AbortError')),
				)
			})
		})
		const pending = call(valid)
		await vi.advanceTimersByTimeAsync(ROUTING_TIMEOUT_MS)
		await expectResult(await pending, 504, { status: 'unavailable', reason: 'timeout' })
		expect(upstreamSignal?.aborted).toBe(true)
	})

	it('cancels the upstream call when the caller goes away', async () => {
		let upstreamSignal: AbortSignal | undefined
		fetchMock.mockImplementationOnce((_url, init) => {
			upstreamSignal = init?.signal ?? undefined
			return new Promise((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () =>
					reject(new DOMException('aborted', 'AbortError')),
				)
			})
		})
		const caller = new AbortController()
		const pending = call(valid, { signal: caller.signal })
		await vi.waitFor(() => expect(upstreamSignal).toBeDefined())
		caller.abort()
		const response = await pending
		expect(upstreamSignal?.aborted).toBe(true)
		expect(response.status).toBe(502)
	})

	it('upstream: body that is not JSON', async () => {
		fetchMock.mockResolvedValueOnce(new Response('<html>gateway</html>', { status: 200 }))
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('no_route: 204', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
		await expectResult(await call(valid), 404, { status: 'unavailable', reason: 'no_route' })
	})

	it('no_route: empty or missing result', async () => {
		upstreamJson({ status: 'OK', result: [] })
		await expectResult(await call(valid), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'OK' })
		await expectResult(await call(valid), 404, { status: 'unavailable', reason: 'no_route' })
	})

	it('body-level status: route not found is no_route, anything else upstream', async () => {
		upstreamJson({ status: 'ROUTE_NOT_FOUND', message: 'no route' })
		await expectResult(await call(valid), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'FAIL', message: `bad key ${KEY}` })
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
		upstreamJson({ type: 'error', message: 'oops' })
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: malformed geometry is never drawn partially', async () => {
		const broken = structuredClone(TWO_GIS_ROUTE)
		broken.result[0].maneuvers[1].outcoming_path!.geometry![1].selection = 'LINESTRING(69.26 41.32, oops)'
		upstreamJson(broken)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: missing geometry, maneuvers or totals', async () => {
		const noManeuvers = structuredClone(TWO_GIS_ROUTE) as { result: Record<string, unknown>[] }
		delete noManeuvers.result[0].maneuvers
		upstreamJson(noManeuvers)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })

		const noDuration = structuredClone(TWO_GIS_ROUTE) as { result: Record<string, unknown>[] }
		noDuration.result[0].total_duration = 'soon'
		upstreamJson(noDuration)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })

		const summaryOnly = { status: 'OK', result: [{ total_distance: 10, total_duration: 5, maneuvers: [] }] }
		upstreamJson(summaryOnly)
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('result that is not a list', async () => {
		upstreamJson({ status: 'OK', result: { total_distance: 1 } })
		await expectResult(await call(valid), 502, { status: 'unavailable', reason: 'upstream' })
	})
})

describe('POST /api/directions — key separation warning', () => {
	it('warns, without the value, when the routing key is the public MapGL key', async () => {
		vi.stubEnv('NEXT_PUBLIC_MAPGL_API_KEY', KEY)
		upstreamJson(TWO_GIS_ROUTE)
		await call(valid)
		expect(warn.mock.calls.some(args => String(args[0]).includes('same value'))).toBe(true)
	})
})
