import { distanceKm, isInsideUzbekistan, TASHKENT_CENTER, type Coordinate } from '@/lib/geo'

// The one location system for the app. Framework-free so it can be driven by
// mocked browser APIs in tests; the React side (context/location-context.tsx)
// only subscribes to it and adds the permission sheets.

// What the browser will let us do. 'checking' until the Permissions API has
// answered; 'unknown' when there is no Permissions API to ask, so the only way
// to find out is an explicit request; 'unsupported' when there is no
// geolocation at all.
export type LocationPermission =
	| 'checking'
	| 'unknown'
	| 'prompt'
	| 'granted'
	| 'denied'
	| 'unsupported'

// 'idle' — nothing asked yet. 'ready' — `position` is a real fix. 'fallback'
// — an attempt ended without one, and `error` says why.
export type LocationStatus = 'idle' | 'loading' | 'ready' | 'fallback'

export type LocationError =
	| null
	| 'unsupported'
	| 'denied'
	| 'unavailable'
	| 'timeout'
	| 'outside-uzbekistan'

export type LocationState = {
	permission: LocationPermission
	status: LocationStatus
	error: LocationError
	// A real GPS fix, and nothing else. Never the city centre: a screen that
	// needs somewhere to centre a map uses FALLBACK_CENTRE explicitly.
	position: Coordinate | null
}

// Where a map opens before (or without) a fix. Map context only — it is not
// the customer's position and is never drawn or labelled as one.
export const FALLBACK_CENTRE = TASHKENT_CENTER

export const GEOLOCATION_OPTIONS: PositionOptions = {
	enableHighAccuracy: false,
	timeout: 30_000,
	maximumAge: 10 * 60_000,
}

export const INITIAL_LOCATION_STATE: LocationState = {
	permission: 'checking',
	status: 'idle',
	error: null,
	position: null,
}

type LocationEnvironment = {
	geolocation?: Pick<Geolocation, 'getCurrentPosition'>
	permissions?: Pick<Permissions, 'query'>
}

export type LocationStore = ReturnType<typeof createLocationStore>

export function createLocationStore(env: LocationEnvironment) {
	let state: LocationState = env.geolocation
		? INITIAL_LOCATION_STATE
		: { ...INITIAL_LOCATION_STATE, permission: 'unsupported' }
	const listeners = new Set<() => void>()

	function set(patch: Partial<LocationState>) {
		state = { ...state, ...patch }
		listeners.forEach(listener => listener())
	}

	function fail(error: Exclude<LocationError, null>, patch: Partial<LocationState> = {}) {
		set({ status: 'fallback', error, position: null, ...patch })
	}

	// The only getCurrentPosition call in the app. Callers are expected to
	// have decided the customer wants this (see locationGate); the store does
	// not second-guess them beyond refusing to stack two requests.
	function request() {
		const geolocation = env.geolocation
		if (!geolocation) return fail('unsupported', { permission: 'unsupported' })
		if (state.status === 'loading') return

		set({ status: 'loading', error: null })
		geolocation.getCurrentPosition(
			result => {
				const next = { lat: result.coords.latitude, lng: result.coords.longitude }
				// A fix means access was granted, even where no Permissions API
				// said so.
				if (!isInsideUzbekistan(next)) return fail('outside-uzbekistan', { permission: 'granted' })
				set({ status: 'ready', error: null, position: next, permission: 'granted' })
			},
			failure => {
				if (failure.code === failure.PERMISSION_DENIED) {
					fail('denied', { permission: 'denied' })
					// Closing the browser's prompt also reports PERMISSION_DENIED,
					// yet leaves the choice undecided. Where the browser can say
					// which it was, believe it: an undecided prompt may be offered
					// again, a real denial may not.
					env.permissions
						?.query({ name: 'geolocation' })
						.then(result => {
							if (result.state === 'prompt' && state.error === 'denied')
								set({ permission: 'prompt', status: 'idle', error: null })
						})
						.catch(() => {})
					return
				}
				if (failure.code === failure.TIMEOUT) return fail('timeout')
				fail('unavailable')
			},
			GEOLOCATION_OPTIONS,
		)
	}

	function applyPermission(permission: PermissionState) {
		if (permission === 'granted') {
			set({ permission })
			// Already allowed: fetch without asking anyone anything.
			if (state.status !== 'ready') request()
			return
		}
		if (permission === 'denied') return fail('denied', { permission })
		// 'prompt' — undecided, or reset in the browser. Nothing is requested
		// until a location feature is used; a previous fix no longer holds.
		set({ permission, status: 'idle', error: null, position: null })
	}

	// Reads the permission once and follows its changes. Returns the
	// cleanup for the change listener.
	function start() {
		let disposed = false
		let status: PermissionStatus | null = null
		const onChange = () => {
			if (!disposed && status) applyPermission(status.state)
		}

		if (!env.geolocation) {
			fail('unsupported', { permission: 'unsupported' })
			return () => {}
		}
		if (!env.permissions) {
			set({ permission: 'unknown' })
			return () => {}
		}

		env.permissions
			.query({ name: 'geolocation' })
			.then(result => {
				if (disposed) return
				status = result
				status.addEventListener('change', onChange)
				applyPermission(result.state)
			})
			// Some browsers reject the 'geolocation' name; treat that exactly
			// like having no Permissions API.
			.catch(() => {
				if (!disposed && state.permission === 'checking') set({ permission: 'unknown' })
			})

		return () => {
			disposed = true
			status?.removeEventListener('change', onChange)
		}
	}

	// «Qayta tekshirish»: ask the browser again what it currently allows. A
	// hard denial cannot be reopened from the page; this only notices that the
	// customer changed it in the browser settings.
	async function recheck() {
		if (!env.permissions) return request()
		try {
			const result = await env.permissions.query({ name: 'geolocation' })
			applyPermission(result.state)
		} catch {
			request()
		}
	}

	return {
		getState: () => state,
		subscribe(listener: () => void) {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		start,
		request,
		recheck,
	}
}

// What a tap on a location feature should do, given where things stand.
// 'locate' goes straight to the browser; 'explain' shows B SPACE's own
// explanation first, so the browser's prompt never arrives unannounced.
export type LocationGate = 'locate' | 'explain' | 'denied' | 'unsupported'

export function locationGate(state: LocationState): LocationGate {
	switch (state.permission) {
		case 'unsupported':
			return 'unsupported'
		case 'denied':
			return 'denied'
		case 'prompt':
		// Still checking: the answer is moments away, and explaining first is
		// the safe side of it.
		case 'checking':
			return 'explain'
		default:
			// 'granted', or no Permissions API — the browser decides from here.
			return 'locate'
	}
}

export function hasFix(state: Pick<LocationState, 'position'>): boolean {
	return state.position !== null
}

// How «Mening joylashuvim» is described wherever it appears as a route end.
// GPS is only claimed for a real fix.
export function currentLocationLabel(state: Pick<LocationState, 'status' | 'position'>) {
	if (state.position) return 'Joriy joylashuvingiz (GPS)'
	if (state.status === 'loading') return 'Joylashuv aniqlanmoqda…'
	return 'Joylashuv aniqlanmagan'
}

// Where the in-app demo route starts when «Mening joylashuvim» has no fix.
export const APPROXIMATE_ORIGIN_LABEL = 'Toshkent markazi — taxminiy ko‘rinish'

// The notice a screen shows when it has no fix. null when there is nothing
// to say: a fix exists, one is on its way, or the customer simply has not
// been asked yet (that case is the invitation, not an error).
export function locationProblem(state: LocationState): { title: string; text: string } | null {
	if (state.position || state.status === 'loading') return null
	if (state.permission === 'denied' || state.error === 'denied')
		return {
			title: 'Joylashuvga ruxsat berilmagan',
			text: 'Joylashuvni brauzer sozlamalaridan yoqishingiz mumkin.',
		}
	switch (state.error) {
		case 'unsupported':
			return {
				title: 'Joylashuv mavjud emas',
				text: 'Bu brauzer geolokatsiyani qo‘llamaydi.',
			}
		case 'timeout':
			return {
				title: 'Joylashuv aniqlanmadi',
				text: 'GPS javob bermadi. Qayta urinib ko‘ring.',
			}
		case 'unavailable':
			return {
				title: 'Joylashuv aniqlanmadi',
				text: 'Qurilma joylashuvni aniqlay olmadi. Qayta urinib ko‘ring.',
			}
		case 'outside-uzbekistan':
			return {
				title: 'Joylashuv O‘zbekistondan tashqarida',
				text: 'B SPACE hozircha faqat O‘zbekiston bo‘ylab ishlaydi.',
			}
		default:
			return null
	}
}

// Distance from the customer, or null without a fix. Nothing may present a
// distance measured from the city centre as one measured from them.
export function distanceFromUser(position: Coordinate | null, point: Coordinate): number | null {
	return position ? distanceKm(position, point) : null
}
