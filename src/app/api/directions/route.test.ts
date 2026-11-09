import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/directions/route'
import { ROUTING_TIMEOUT_MS, TWO_GIS_ROUTING_ENDPOINT } from '@/lib/two-gis-routing'
import { TWO_GIS_TRANSIT_ENDPOINT } from '@/lib/two-gis-transit'

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
				{ comment: 'start', icon: 'start' },
				{
					comment: 'Left turn onto проспект Амира Темура',
					icon: 'crossroad_left',
					outcoming_path: {
						distance: 6300,
						geometry: [
							{ selection: 'LINESTRING(69.2797 41.3111, 69.26 41.32)', color: 'fast', length: 2500 },
							{ selection: 'LINESTRING(69.26 41.32, 69.25 41.33)', color: 'slow', length: 1800 },
							{ selection: 'LINESTRING(69.25 41.33, 69.2194 41.3398)', color: 'slow-jams', length: 2000 },
						],
					},
				},
				{ comment: 'finish', icon: 'finish' },
			],
			end_pedestrian_path: {
				geometry: { selection: 'LINESTRING(69.2194 41.3398, 69.21938 41.33983)' },
			},
		},
		{
			id: '2',
			total_distance: 7100,
			total_duration: 960,
			maneuvers: [
				{
					icon: 'start',
					outcoming_path: {
						geometry: [{ selection: 'LINESTRING(69.27968 41.31108, 69.24 41.30, 69.21938 41.33983)', color: 'fast' }],
					},
				},
				{ icon: 'finish' },
			],
		},
	],
}

// What TWO_GIS_ROUTE carries beyond the primary line, as SmartCity speaks it.
const CAR_EXTRAS = {
	alternatives: [
		{
			distanceMeters: 7100,
			durationSeconds: 960,
			geometry: [[69.27968, 41.31108], [69.24, 41.3], [69.21938, 41.33983]],
		},
	],
	maneuvers: [
		{ type: 'start', instruction: 'Yo‘lga chiqing', distanceMeters: 0 },
		{ type: 'left', instruction: 'Chapga buriling', distanceMeters: 6300 },
		{ type: 'finish', instruction: 'Manzilga yetib keldingiz', distanceMeters: 0 },
	],
	// Neighbouring slow and slow-jams segments merge into one stretch.
	traffic: [
		{ speed: 'fast', distanceMeters: 2500, geometry: [[69.2797, 41.3111], [69.26, 41.32]] },
		{ speed: 'slow', distanceMeters: 3800, geometry: [[69.26, 41.32], [69.25, 41.33], [69.2194, 41.3398]] },
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
	it('normalizes a 2GIS route into a SmartCity RealRoute', async () => {
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
				[69.25, 41.33],
				[69.2194, 41.3398],
				[69.21938, 41.33983],
			],
			...CAR_EXTRAS,
		})
		expect(response.headers.get('cache-control')).toBe('no-store')
	})

	it('drops an unreadable alternative on its own, never the primary', async () => {
		const broken = structuredClone(TWO_GIS_ROUTE)
		broken.result[1].maneuvers[0].outcoming_path!.geometry[0].selection = 'LINESTRING(oops)'
		upstreamJson(broken)
		const result = await (await call(valid)).json()
		expect(result.status).toBe('ok')
		expect(result.distanceMeters).toBe(6400)
		expect(result.alternatives).toEqual([])
	})

	it('maps unknown maneuver icons to a neutral step and leaves out colours with no speed', async () => {
		const odd = structuredClone(TWO_GIS_ROUTE)
		odd.result[0].maneuvers[1].icon = 'something_new'
		odd.result[0].maneuvers[1].outcoming_path!.geometry[1].color = 'no-data'
		upstreamJson(odd)
		const result = await (await call(valid)).json()
		expect(result.maneuvers[1]).toEqual({ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 6300 })
		expect(result.traffic).toEqual([
			{ speed: 'fast', distanceMeters: 2500, geometry: [[69.2797, 41.3111], [69.26, 41.32]] },
			{ speed: 'slow', distanceMeters: 2000, geometry: [[69.25, 41.33], [69.2194, 41.3398]] },
		])
	})

	it('never merges two stretches across one that was left out', async () => {
		const gap = structuredClone(TWO_GIS_ROUTE)
		gap.result[0].maneuvers[1].outcoming_path!.geometry[0].color = 'slow'
		gap.result[0].maneuvers[1].outcoming_path!.geometry[1].color = 'ignore'
		upstreamJson(gap)
		const result = await (await call(valid)).json()
		expect(result.traffic.map((segment: { distanceMeters: number }) => segment.distanceMeters)).toEqual([2500, 2000])
	})

	it('never passes on the provider’s English comment text', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		const text = await (await call(valid)).text()
		expect(text).not.toContain('Left turn')
		expect(text).not.toContain('comment')
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
			alternative: 2,
		})
	})

	it('never takes a key from the caller', async () => {
		upstreamJson(TWO_GIS_ROUTE)
		const response = await call({ ...valid, key: 'caller-key' })
		expect(response.status).toBe(400)
		expect(fetchMock).not.toHaveBeenCalled()
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
			alternatives: [],
			// No icons in this answer: each step is kept, claiming no direction.
			maneuvers: [
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
			],
			traffic: [],
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

// A 2GIS scooter answer, shaped like the one the feasibility check saw: a
// pedestrian connector at each end, one path of styled segments (a
// stairway among them — the filters are preferences, not guarantees) and a
// second, longer route after the primary one.
const TWO_GIS_SCOOTER = {
	status: 'OK',
	type: 'result',
	result: [
		{
			id: '1',
			total_distance: 7314,
			total_duration: 2138,
			begin_pedestrian_path: {
				geometry: { selection: 'LINESTRING(69.2215 41.2846, 69.22155 41.28465)' },
			},
			maneuvers: [
				{
					comment: 'start',
					outcoming_path: {
						geometry: [
							{ selection: 'LINESTRING(69.22155 41.28465, 69.24 41.29)', style: 'normal' },
							{ selection: 'LINESTRING(69.24 41.29, 69.26 41.30)', style: 'park_path' },
							{ selection: 'LINESTRING(69.26 41.30, 69.28012 41.31052)', style: 'stairway' },
						],
					},
				},
				{ comment: 'finish' },
			],
			end_pedestrian_path: {
				geometry: { selection: 'LINESTRING(69.28012 41.31052, 69.2801 41.3105)' },
			},
		},
		{
			id: '2',
			total_distance: 8087,
			total_duration: 2362,
			maneuvers: [
				{
					comment: 'start',
					outcoming_path: {
						geometry: [{ selection: 'LINESTRING(69.2215 41.2846, 69.2 41.35, 69.2801 41.3105)' }],
					},
				},
				{ comment: 'finish' },
			],
		},
	],
}

const MAGIC_CITY = { lat: 41.2846, lng: 69.2215 }
const COFFEE_LAB = { lat: 41.3105, lng: 69.2801 }
const scooter = { origin: MAGIC_CITY, destination: COFFEE_LAB, mode: 'scooter' }

describe('POST /api/directions — scooter', () => {
	it('asks 2GIS for a detailed scooter route that avoids car roads and stairs where it can', async () => {
		upstreamJson(TWO_GIS_SCOOTER)
		await call(scooter)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(String(url)).toBe(`${TWO_GIS_ROUTING_ENDPOINT}?key=${KEY}`)
		expect(String(url)).not.toContain('public_transport')
		expect(JSON.parse(String(init?.body))).toEqual({
			points: [
				{ type: 'stop', lon: MAGIC_CITY.lng, lat: MAGIC_CITY.lat },
				{ type: 'stop', lon: COFFEE_LAB.lng, lat: COFFEE_LAB.lat },
			],
			// The scooter itself — never bicycle, walking or driving in its place.
			transport: 'scooter',
			route_mode: 'fastest',
			output: 'detailed',
			filters: ['ban_car_road', 'ban_stairway'],
		})
	})

	it('sends the scooter filters with the scooter only — car and walking bodies carry none', async () => {
		for (const body of [valid, walk]) {
			upstreamJson(TWO_GIS_ROUTE)
			await call(body)
		}
		upstreamJson(TWO_GIS_SCOOTER)
		await call(scooter)
		const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
		expect(sent.map(body => body.transport)).toEqual(['driving', 'walking', 'scooter'])
		expect(sent[0]).not.toHaveProperty('filters')
		expect(sent[1]).not.toHaveProperty('filters')
		expect(sent[2].filters).toEqual(['ban_car_road', 'ban_stairway'])
		// Alternatives are asked for with the car only.
		expect(sent[0].alternative).toBe(2)
		expect(sent[1]).not.toHaveProperty('alternative')
		expect(sent[2]).not.toHaveProperty('alternative')
	})

	it('normalizes the primary route, and the second route as an alternative', async () => {
		upstreamJson(TWO_GIS_SCOOTER)
		await expectResult(await call(scooter), 200, {
			status: 'ok',
			source: '2gis',
			mode: 'scooter',
			distanceMeters: 7314,
			durationSeconds: 2138,
			geometry: [
				[69.2215, 41.2846],
				[69.22155, 41.28465],
				[69.24, 41.29],
				[69.26, 41.3],
				[69.28012, 41.31052],
				[69.2801, 41.3105],
			],
			alternatives: [
				{
					distanceMeters: 8087,
					durationSeconds: 2362,
					geometry: [[69.2215, 41.2846], [69.2, 41.35], [69.2801, 41.3105]],
				},
			],
			maneuvers: [
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
				{ type: 'continue', instruction: 'Yo‘lda davom eting', distanceMeters: 0 },
			],
			traffic: [],
		})
	})

	it('no_route: 204, empty result, or a not-found status', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
		await expectResult(await call(scooter), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'OK', result: [] })
		await expectResult(await call(scooter), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson({ status: 'ROUTE_NOT_FOUND' })
		await expectResult(await call(scooter), 404, { status: 'unavailable', reason: 'no_route' })
	})

	it('upstream: malformed primary geometry is never drawn partially, nor replaced by the second route', async () => {
		const broken = structuredClone(TWO_GIS_SCOOTER)
		broken.result[0].maneuvers[0].outcoming_path!.geometry[1].selection = 'LINESTRING(69.24 41.29, oops)'
		upstreamJson(broken)
		await expectResult(await call(scooter), 502, { status: 'unavailable', reason: 'upstream' })

		const noDistance = structuredClone(TWO_GIS_SCOOTER) as { result: Record<string, unknown>[] }
		delete noDistance.result[0].total_distance
		upstreamJson(noDistance)
		await expectResult(await call(scooter), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: HTTP failure', async () => {
		upstreamJson({ message: 'nope' }, 500)
		await expectResult(await call(scooter), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('timeout: aborts the upstream scooter call', async () => {
		vi.useFakeTimers()
		fetchMock.mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
				}),
		)
		const pending = call(scooter)
		await vi.advanceTimersByTimeAsync(ROUTING_TIMEOUT_MS + 1)
		await expectResult(await pending, 504, { status: 'unavailable', reason: 'timeout' })
	})

	it('invalid: a scooter point outside Uzbekistan is refused before any call', async () => {
		await expectResult(await call({ ...scooter, destination: { lat: 43.2389, lng: 76.8897 } }), 400, {
			status: 'unavailable',
			reason: 'invalid',
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

// A 2GIS public transport answer in the documented shape: walk to the
// station, one metro ride, walk out, then the finish marker. A walking-only
// journey comes first to prove it is never presented as public transport.
const TWO_GIS_TRANSIT = [
	{
		pedestrian: true,
		total_distance: 3200,
		total_duration: 2400,
		movements: [
			{
				type: 'walkway',
				distance: 3200,
				moving_duration: 2400,
				waypoint: { name: 'A', subtype: 'start' },
				alternatives: [{ geometry: [{ selection: 'LINESTRING(69.27968 41.31108, 69.21938 41.33983)' }] }],
			},
		],
	},
	{
		pedestrian: false,
		total_distance: 7000,
		total_duration: 1500,
		transfer_count: 0,
		movements: [
			{
				type: 'walkway',
				distance: 400,
				moving_duration: 300,
				waiting_duration: 0,
				waypoint: { name: 'A', subtype: 'start', comment: 'пешком 400 м' },
				alternatives: [{ geometry: [{ selection: 'LINESTRING(69.27968 41.31108, 69.2787 41.3115)' }] }],
			},
			{
				type: 'passage',
				distance: 6300,
				moving_duration: 840,
				waiting_duration: 180,
				waypoint: { name: 'Amir Temur xiyoboni', subtype: 'metro' },
				metro: { line_name: 'Chilonzor yo‘li', color: '#e90101' },
				platforms: { names: ['Mustaqillik maydoni', 'Paxtakor'] },
				routes: [{ names: ['1'], subtype: 'metro', color: '' }],
				alternatives: [{ geometry: [{ selection: 'LINESTRING(69.2787 41.3115, 69.25 41.32, 69.2205 41.3390)' }] }],
			},
			{
				type: 'walkway',
				distance: 300,
				moving_duration: 180,
				waypoint: { name: 'Bunyodkor', subtype: 'pedestrian', comment: 'пешком 300 м' },
				alternatives: [{ geometry: [{ selection: 'LINESTRING(69.2205 41.3390, 69.21938 41.33983)' }] }],
			},
			{ type: 'walkway', waypoint: { name: 'B', subtype: 'finish', comment: 'Вы на месте в 17:53.' } },
		],
	},
]

const metro = { origin: AMIR_TEMUR, destination: HUMO_ARENA, mode: 'metro' }

describe('POST /api/directions — metro (public transport)', () => {
	it('asks the 2GIS Public Transport API, never the road Routing API', async () => {
		upstreamJson(TWO_GIS_TRANSIT)
		await call(metro)
		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0]
		expect(String(url)).toBe(`${TWO_GIS_TRANSIT_ENDPOINT}?key=${KEY}`)
		const body = JSON.parse(String(init?.body))
		expect(body.source.point).toEqual({ lat: AMIR_TEMUR.lat, lon: AMIR_TEMUR.lng })
		expect(body.target.point).toEqual({ lat: HUMO_ARENA.lat, lon: HUMO_ARENA.lng })
		expect(body.transport).toContain('metro')
		expect(body).not.toHaveProperty('points')
	})

	it('normalizes the first riding journey into legs; the walking-only one is skipped', async () => {
		upstreamJson(TWO_GIS_TRANSIT)
		const response = await call(metro)
		expect(response.status).toBe(200)
		const route = await response.json()
		expect(route).toMatchObject({ status: 'ok', source: '2gis', mode: 'metro', distanceMeters: 7000, durationSeconds: 1500 })
		expect(route.transitLegs).toEqual([
			{
				type: 'walk', durationSeconds: 300, distanceMeters: 400,
				geometry: [[69.27968, 41.31108], [69.2787, 41.3115]],
				lineInfo: null, fromStop: null, toStop: null, stopCount: null,
			},
			{
				type: 'ride', durationSeconds: 1020, distanceMeters: 6300,
				geometry: [[69.2787, 41.3115], [69.25, 41.32], [69.2205, 41.339]],
				lineInfo: { vehicle: 'metro', name: 'Chilonzor yo‘li', color: '#e90101' },
				fromStop: 'Amir Temur xiyoboni', toStop: 'Bunyodkor', stopCount: 3,
			},
			{
				type: 'walk', durationSeconds: 180, distanceMeters: 300,
				geometry: [[69.2205, 41.339], [69.21938, 41.33983]],
				lineInfo: null, fromStop: null, toStop: null, stopCount: null,
			},
		])
		// The whole line is the legs joined, start to finish.
		expect(route.geometry[0]).toEqual([69.27968, 41.31108])
		expect(route.geometry.at(-1)).toEqual([69.21938, 41.33983])
		// Russian provider prose never reaches the wire.
		expect(JSON.stringify(route)).not.toMatch(/пешком|Вы на месте/)
	})

	it('no_route: 204, an empty list, or walking-only journeys', async () => {
		fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
		await expectResult(await call(metro), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson([])
		await expectResult(await call(metro), 404, { status: 'unavailable', reason: 'no_route' })
		upstreamJson([TWO_GIS_TRANSIT[0]])
		await expectResult(await call(metro), 404, { status: 'unavailable', reason: 'no_route' })
	})

	it('upstream: a journey with one unreadable leg is never shown partially or as a straight line', async () => {
		const broken = structuredClone(TWO_GIS_TRANSIT[1])
		broken.movements[1].alternatives = [{ geometry: [{ selection: 'LINESTRING(69.2787)' }] }]
		upstreamJson([broken])
		await expectResult(await call(metro), 502, { status: 'unavailable', reason: 'upstream' })

		const noDuration = structuredClone(TWO_GIS_TRANSIT[1]) as { movements: Record<string, unknown>[] }
		delete noDuration.movements[1].moving_duration
		upstreamJson([noDuration])
		await expectResult(await call(metro), 502, { status: 'unavailable', reason: 'upstream' })

		upstreamJson({ type: 'error', message: 'bad' })
		await expectResult(await call(metro), 502, { status: 'unavailable', reason: 'upstream' })
	})

	it('upstream: HTTP failure; timeout aborts the transit call', async () => {
		upstreamJson({ message: 'nope' }, 422)
		await expectResult(await call(metro), 502, { status: 'unavailable', reason: 'upstream' })

		vi.useFakeTimers()
		fetchMock.mockImplementationOnce(
			(_url, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
				}),
		)
		const pending = call(metro)
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
		// Provider names are not SmartCity modes either: 'walking' and
		// 'driving' are refused, not passed through. Nor is 2GIS's
		// 'bicycle' a stand-in for the scooter.
		for (const mode of ['public_transport', 'bicycle', 'truck', 'pedestrian', 'walking', 'driving', null]) {
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
