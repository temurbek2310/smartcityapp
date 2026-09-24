import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { TASHKENT_CENTER } from '@/lib/geo'
import {
	createLocationStore,
	currentLocationLabel,
	distanceFromUser,
	GEOLOCATION_OPTIONS,
	locationGate,
	locationProblem,
	type LocationState,
} from '@/lib/location'
import { resolveRouteEndpoint } from '@/lib/route-endpoints'

// The browser, mocked just enough: a PermissionStatus that can change, and a
// geolocation whose pending request the test answers by hand.

class FakePermissionStatus extends EventTarget {
	constructor(public state: PermissionState) {
		super()
	}
	change(next: PermissionState) {
		this.state = next
		this.dispatchEvent(new Event('change'))
	}
}

const TASHKENT_FIX = { lat: 41.3, lng: 69.25 }

function fakeGeolocation() {
	let pending: { ok: PositionCallback; fail?: PositionErrorCallback | null } | null = null
	const getCurrentPosition = vi.fn(
		(ok: PositionCallback, fail?: PositionErrorCallback | null, _options?: PositionOptions) => {
			void _options
			pending = { ok, fail }
		},
	)
	return {
		api: { getCurrentPosition },
		getCurrentPosition,
		succeed({ lat, lng } = TASHKENT_FIX) {
			pending!.ok({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition)
			pending = null
		},
		fail(code: 1 | 2 | 3) {
			pending!.fail!({
				code,
				message: 'raw browser text',
				PERMISSION_DENIED: 1,
				POSITION_UNAVAILABLE: 2,
				TIMEOUT: 3,
			} as GeolocationPositionError)
			pending = null
		},
	}
}

function fakePermissions(state: PermissionState) {
	const status = new FakePermissionStatus(state)
	return { status, api: { query: vi.fn(async () => status as unknown as PermissionStatus) } }
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

async function started(permission: PermissionState) {
	const geo = fakeGeolocation()
	const permissions = fakePermissions(permission)
	const store = createLocationStore({ geolocation: geo.api, permissions: permissions.api })
	const stop = store.start()
	await flush()
	return { store, geo, permissions, stop }
}

describe('permission check on start', () => {
	it('granted → locates automatically, with the existing options', async () => {
		const { store, geo } = await started('granted')
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
		expect(geo.getCurrentPosition.mock.calls[0][2]).toEqual(GEOLOCATION_OPTIONS)
		expect(GEOLOCATION_OPTIONS).toEqual({ enableHighAccuracy: false, timeout: 30_000, maximumAge: 600_000 })
		expect(store.getState()).toMatchObject({ permission: 'granted', status: 'loading' })
		geo.succeed()
		expect(store.getState()).toMatchObject({ status: 'ready', position: TASHKENT_FIX, error: null })
	})

	it('prompt → asks nothing until a feature needs it', async () => {
		const { store, geo } = await started('prompt')
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
		expect(store.getState()).toEqual({ permission: 'prompt', status: 'idle', error: null, position: null })
	})

	it('denied → never calls geolocation, and says so', async () => {
		const { store, geo } = await started('denied')
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
		expect(store.getState()).toMatchObject({ permission: 'denied', status: 'fallback', error: 'denied', position: null })
	})

	it('no Permissions API → waits for an explicit request, which then goes to the browser', () => {
		const geo = fakeGeolocation()
		const store = createLocationStore({ geolocation: geo.api })
		store.start()
		expect(store.getState().permission).toBe('unknown')
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
		expect(locationGate(store.getState())).toBe('locate')
		store.request()
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
	})

	it('a Permissions API that rejects the name is treated as absent', async () => {
		const geo = fakeGeolocation()
		const store = createLocationStore({
			geolocation: geo.api,
			permissions: { query: () => Promise.reject(new TypeError('bad name')) },
		})
		store.start()
		await flush()
		expect(store.getState().permission).toBe('unknown')
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
	})

	it('no geolocation → unsupported, without throwing', () => {
		const store = createLocationStore({})
		store.start()
		store.request()
		expect(store.getState()).toMatchObject({ permission: 'unsupported', status: 'fallback', error: 'unsupported', position: null })
		expect(locationGate(store.getState())).toBe('unsupported')
	})
})

describe('geolocation results', () => {
	async function afterRequest(code: 1 | 2 | 3, permission: PermissionState = 'granted') {
		const ctx = await started(permission)
		if (permission !== 'granted') ctx.store.request()
		ctx.geo.fail(code)
		await flush()
		return ctx.store.getState()
	}

	it('permission denied', async () => {
		const state = await afterRequest(1)
		expect(state).toMatchObject({ status: 'fallback', error: 'denied', permission: 'denied', position: null })
	})

	it('a dismissed prompt stays undecided rather than becoming a denial', async () => {
		// Chrome reports closing its prompt as PERMISSION_DENIED while the
		// permission itself is still 'prompt'.
		const state = await afterRequest(1, 'prompt')
		expect(state).toMatchObject({ permission: 'prompt', status: 'idle', error: null })
	})

	it('unavailable', async () => {
		expect(await afterRequest(2)).toMatchObject({ status: 'fallback', error: 'unavailable', position: null })
	})

	it('timeout', async () => {
		expect(await afterRequest(3)).toMatchObject({ status: 'fallback', error: 'timeout', position: null })
	})

	it('outside Uzbekistan is not a usable fix', async () => {
		const { store, geo } = await started('granted')
		geo.succeed({ lat: 51.5, lng: -0.12 })
		expect(store.getState()).toMatchObject({ status: 'fallback', error: 'outside-uzbekistan', position: null })
	})

	it('never shows the raw browser message', async () => {
		for (const code of [1, 2, 3] as const) {
			const problem = locationProblem(await afterRequest(code))
			expect(JSON.stringify(problem)).not.toContain('raw browser text')
		}
	})

	it('does not stack a second request on one already in flight', async () => {
		const { store, geo } = await started('granted')
		store.request()
		store.request()
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
	})
})

describe('permission changes', () => {
	it('denied → granted in the browser settings fetches a fix without a restart', async () => {
		const { store, geo, permissions } = await started('denied')
		permissions.status.change('granted')
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
		geo.succeed()
		expect(store.getState().position).toEqual(TASHKENT_FIX)
	})

	it('granted → denied drops the fix', async () => {
		const { store, geo, permissions } = await started('granted')
		geo.succeed()
		permissions.status.change('denied')
		expect(store.getState()).toMatchObject({ status: 'fallback', error: 'denied', position: null })
	})

	it('stops listening once cleaned up', async () => {
		const { store, geo, permissions, stop } = await started('denied')
		stop()
		permissions.status.change('granted')
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
		expect(store.getState().permission).toBe('denied')
	})

	it('«Qayta tekshirish» notices a permission changed in settings', async () => {
		const { store, geo, permissions, stop } = await started('denied')
		stop()
		permissions.status.state = 'granted'
		await store.recheck()
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
	})

	it('«Qayta tekshirish» on a hard denial changes nothing and requests nothing', async () => {
		const { store, geo } = await started('denied')
		await store.recheck()
		expect(geo.getCurrentPosition).not.toHaveBeenCalled()
		expect(store.getState().permission).toBe('denied')
	})
})

describe('one shared state', () => {
	it('survives consumers unmounting and remounting', async () => {
		const { store, geo } = await started('granted')
		geo.succeed()
		// Home subscribes, then /parking replaces it, then /transport.
		const home = vi.fn()
		const stopHome = store.subscribe(home)
		stopHome()
		const parking = vi.fn()
		const stopParking = store.subscribe(parking)
		expect(store.getState().position).toEqual(TASHKENT_FIX)
		stopParking()
		store.subscribe(vi.fn())
		expect(store.getState().position).toEqual(TASHKENT_FIX)
		expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
	})

	it('tells every subscriber about the same fix', async () => {
		const { store, geo } = await started('granted')
		const a = vi.fn()
		const b = vi.fn()
		store.subscribe(a)
		store.subscribe(b)
		geo.succeed()
		expect(a).toHaveBeenCalled()
		expect(b).toHaveBeenCalled()
	})

	it('is the only place in the app that calls getCurrentPosition', () => {
		const offenders: string[] = []
		const walk = (dir: string) => {
			for (const name of readdirSync(dir)) {
				const path = join(dir, name)
				if (statSync(path).isDirectory()) walk(path)
				else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts') && readFileSync(path, 'utf8').includes('getCurrentPosition('))
					offenders.push(path)
			}
		}
		walk(join(process.cwd(), 'src'))
		expect(offenders.map(path => path.replaceAll('\\', '/'))).toEqual([
			expect.stringMatching(/src\/lib\/location\.ts$/),
		])
	})
})

describe('what a tap does', () => {
	const state = (patch: Partial<LocationState>): LocationState => ({
		permission: 'prompt', status: 'idle', error: null, position: null, ...patch,
	})

	it('explains before the browser prompt when undecided', () => {
		expect(locationGate(state({ permission: 'prompt' }))).toBe('explain')
		expect(locationGate(state({ permission: 'checking' }))).toBe('explain')
	})

	it('goes straight to the browser when already allowed', () => {
		expect(locationGate(state({ permission: 'granted' }))).toBe('locate')
	})

	it('shows the denied state instead of re-requesting', () => {
		expect(locationGate(state({ permission: 'denied' }))).toBe('denied')
	})
})

describe('honest labels and markers', () => {
	const noFix: LocationState = { permission: 'prompt', status: 'idle', error: null, position: null }

	it('claims GPS only with a real fix', () => {
		expect(currentLocationLabel({ status: 'ready', position: TASHKENT_FIX })).toContain('GPS')
		for (const status of ['idle', 'loading', 'fallback'] as const)
			expect(currentLocationLabel({ status, position: null })).not.toContain('GPS')
		expect(currentLocationLabel({ status: 'fallback', position: null })).toBe('Joylashuv aniqlanmagan')
	})

	it('has no position — so no blue dot — in any state without a fix', async () => {
		for (const permission of ['prompt', 'denied'] as const)
			expect((await started(permission)).store.getState().position).toBeNull()
		for (const code of [1, 2, 3] as const) {
			const { store, geo } = await started('granted')
			geo.fail(code)
			expect(store.getState().position).toBeNull()
		}
	})

	it('flags «me» without a fix as approximate, so the route map draws no user marker', () => {
		const approximate = resolveRouteEndpoint('me', null)!
		expect(approximate).toMatchObject({ approximate: true, lat: TASHKENT_CENTER.lat, lng: TASHKENT_CENTER.lng })
		expect(resolveRouteEndpoint('me', TASHKENT_FIX)).toMatchObject({ approximate: false, ...TASHKENT_FIX })
	})

	it('shows no user-relative distance without a fix', () => {
		expect(distanceFromUser(null, TASHKENT_CENTER)).toBeNull()
		expect(distanceFromUser(TASHKENT_FIX, TASHKENT_CENTER)).toBeGreaterThan(0)
	})

	it('says nothing before anything was asked, and names the reason after', () => {
		expect(locationProblem(noFix)).toBeNull()
		expect(locationProblem({ ...noFix, permission: 'denied', status: 'fallback', error: 'denied' })?.title)
			.toBe('Joylashuvga ruxsat berilmagan')
		expect(locationProblem({ ...noFix, status: 'fallback', error: 'timeout' })).not.toBeNull()
		expect(locationProblem({ ...noFix, status: 'ready', position: TASHKENT_FIX })).toBeNull()
	})
})

describe('screens do not request location on open', () => {
	it.each(['home', 'map', 'parking', 'transport'])('/%s', screen => {
		const page = readFileSync(join(process.cwd(), `src/app/(app)/${screen}/page.tsx`), 'utf8')
		// A request is only ever a handler; no effect may start one.
		expect(page).not.toMatch(/useEffect\(\(\) => \{\s*(locate|requestLocation)\(\)/)
		expect(page).not.toContain('useUserLocation')
		expect(page).toContain('useLocation()')
	})
})
