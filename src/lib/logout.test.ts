import { describe, expect, it } from 'vitest'

import { deleteAccount, logOut, resetDemoData } from './account-exit'
import { clearAccountStorage, clearUserOwnedStorage, MAIN_STATE_KEY } from './account-storage'
import { liveBookingCount } from './booking-lifecycle'
import { bookingRows } from './bookings'
import { initialState, loggedOutState, USER_ACTIVITY_KEYS } from './initial-state'
import type {
	QueueTicket,
	QueueTicketStatus,
	Reservation,
	ReservationStatus,
	ServiceBooking,
	ServiceBookingStatus,
	SmartCityState,
} from './types'

const reservation = (status: ReservationStatus, id = `r-${status}`): Reservation => ({
	id,
	parkingId: 'amir-temur',
	userPhone: '+998901111111',
	startAt: '2026-09-20T06:30:00.000Z',
	endAt: '2026-09-20T08:30:00.000Z',
	durationHours: 2,
	pricePerHour: 12000,
	estimatedTotal: 24000,
	status,
	createdAt: '2026-09-20T05:00:00.000Z',
})

const ticket = (status: QueueTicketStatus, id = `t-${status}`): QueueTicket => ({
	id,
	orgId: 'coffee-lab',
	serviceId: 'table',
	number: 'A-23',
	position: 0,
	initialPosition: 6,
	etaMinutes: 0,
	initialEtaMinutes: 18,
	windowNumber: 2,
	notify: true,
	status,
	createdAt: '2026-09-23T10:00:00.000Z',
})

const service = (status: ServiceBookingStatus, id = `s-${status}`): ServiceBooking => ({
	id,
	kind: 'table',
	refId: 'caravan',
	title: 'Caravan',
	subtitle: '2 kishi · 18:00',
	code: 'TB-1234',
	whenLabel: 'Bugun, 18:00',
	startAt: '2026-09-23T13:00:00.000Z',
	status,
	createdAt: '2026-09-23T08:00:00.000Z',
})

const bookings = (patch: Partial<Pick<SmartCityState, 'reservations' | 'queueTickets' | 'serviceBookings'>>) => ({
	reservations: [],
	queueTickets: [],
	serviceBookings: [],
	...patch,
})

// User A, signed in, with a full history and nothing live.
function userAState(): SmartCityState {
	return {
		...initialState,
		hydrated: true,
		onboardingDone: true,
		user: { name: 'User A', phone: '+998901111111', vehiclePlate: '01 A 123 BC' },
		favorites: ['amir-temur'],
		favoriteQueueOrgs: ['coffee-lab'],
		favoriteEvents: ['concert'],
		savedRoutes: [{ id: 'route-1', title: 'Uy', from: 'Men', to: 'Humo', mode: 'car', createdAt: '2026-09-20T05:00:00.000Z' }],
		reservations: [reservation('completed'), reservation('cancelled')],
		queueTickets: [ticket('served'), ticket('cancelled')],
		serviceBookings: [service('completed'), service('cancelled')],
		notifications: [{
			id: 'n1', title: 'Xush kelibsiz', message: 'User A, SmartCity profilingiz tayyor.',
			createdAt: '2026-09-20T05:00:00.000Z', read: true, type: 'system',
		}],
		notificationPrefs: { ...initialState.notificationPrefs, bookingReminders: false, partnerOffers: true },
	}
}

describe('loggedOutState', () => {
	it('clears the profile and every store of activity', () => {
		const next = loggedOutState(userAState())
		expect(next.user).toBeNull()
		for (const key of USER_ACTIVITY_KEYS) expect(next[key]).toEqual([])
	})

	it('returns notification preferences to their defaults', () => {
		expect(loggedOutState(userAState()).notificationPrefs).toEqual(initialState.notificationPrefs)
	})

	it('keeps the device facts: onboarding and hydration', () => {
		const next = loggedOutState(userAState())
		expect(next.onboardingDone).toBe(true)
		expect(next.hydrated).toBe(true)
		expect(loggedOutState({ ...userAState(), onboardingDone: false }).onboardingDone).toBe(false)
	})

	// Anything not deliberately kept is the fresh-install value, so a store
	// added later is cleared without anyone remembering to list it here.
	it('differs from a fresh install only in the device facts', () => {
		expect(loggedOutState(userAState())).toEqual({ ...initialState, hydrated: true, onboardingDone: true })
	})

	it('does not mutate the state it was given', () => {
		const before = userAState()
		const snapshot = structuredClone(before)
		loggedOutState(before)
		expect(before).toEqual(snapshot)
	})

	it('does not hand out the shared default preferences object', () => {
		expect(loggedOutState(userAState()).notificationPrefs).not.toBe(initialState.notificationPrefs)
	})
})

describe('liveBookingCount — what blocks logout', () => {
	it.each(['reserved', 'active'] as const)('parking %s is live', status => {
		expect(liveBookingCount(bookings({ reservations: [reservation(status)] }))).toBe(1)
	})

	it.each(['waiting', 'called', 'arrived'] as const)('queue %s is live', status => {
		expect(liveBookingCount(bookings({ queueTickets: [ticket(status)] }))).toBe(1)
	})

	it('a service booking that is active is live', () => {
		expect(liveBookingCount(bookings({ serviceBookings: [service('active')] }))).toBe(1)
	})

	it.each([
		['parking completed', bookings({ reservations: [reservation('completed')] })],
		['parking cancelled', bookings({ reservations: [reservation('cancelled')] })],
		['queue served', bookings({ queueTickets: [ticket('served')] })],
		['queue cancelled', bookings({ queueTickets: [ticket('cancelled')] })],
		['service completed', bookings({ serviceBookings: [service('completed')] })],
		['service cancelled', bookings({ serviceBookings: [service('cancelled')] })],
	])('%s is history and does not block', (_, state) => {
		expect(liveBookingCount(state)).toBe(0)
	})

	it('one live record among history blocks', () => {
		expect(liveBookingCount(bookings({
			reservations: [reservation('completed')],
			serviceBookings: [service('cancelled')],
			queueTickets: [ticket('waiting')],
		}))).toBe(1)
	})

	it('counts live records across all three stores', () => {
		expect(liveBookingCount(bookings({
			reservations: [reservation('active'), reservation('completed')],
			queueTickets: [ticket('called')],
			serviceBookings: [service('active'), service('cancelled')],
		}))).toBe(3)
	})

	it('a whole history with nothing live allows logout', () => {
		expect(liveBookingCount(userAState())).toBe(0)
	})

	it('an empty account allows logout', () => {
		expect(liveBookingCount(initialState)).toBe(0)
	})
})

function memoryStorage(entries: [string, string][]) {
	const data = new Map(entries)
	const storage: Storage = {
		get length() { return data.size },
		key: index => [...data.keys()][index] ?? null,
		getItem: key => data.get(key) ?? null,
		setItem: (key, value) => { data.set(key, value) },
		removeItem: key => { data.delete(key) },
		clear: () => data.clear(),
	}
	return { data, storage }
}

const DEVICE_ENTRIES: [string, string][] = [
	['citygoo-parking-filters', '{"sort":"price"}'],
	['citygoo-map-layers', '{"traffic":false}'],
	['citygoo-favorites-active-tab', 'routes'],
]

const USER_ENTRIES: [string, string][] = [
	['citygoo-place-favorites', '["coffee-lab"]'],
	['citygoo-parking-meta-r1', '{"bay":"A-01"}'],
	// A finished booking's metadata that no reservation in state names any more.
	['citygoo-parking-meta-long-gone', '{"bay":"B-07"}'],
]

describe('logout storage cleanup', () => {
	it('removes place favorites and every parking metadata key', () => {
		const { data, storage } = memoryStorage([...USER_ENTRIES, ...DEVICE_ENTRIES, ['another-app', 'keep']])
		clearUserOwnedStorage(storage)
		for (const [key] of USER_ENTRIES) expect(data.has(key)).toBe(false)
	})

	it('keeps parking filters, map layers, the Favorites tab and other apps', () => {
		const { data, storage } = memoryStorage([...USER_ENTRIES, ...DEVICE_ENTRIES, ['another-app', 'keep']])
		clearUserOwnedStorage(storage)
		expect([...data.entries()]).toEqual([...DEVICE_ENTRIES, ['another-app', 'keep']])
	})

	// The store rewrites the main blob with the signed-out state; removing it
	// here would lose onboardingDone if the tab closed before that write.
	it('leaves the main blob for the store to rewrite', () => {
		const { data, storage } = memoryStorage([[MAIN_STATE_KEY, '{}'], ...USER_ENTRIES])
		clearUserOwnedStorage(storage)
		expect([...data.keys()]).toEqual([MAIN_STATE_KEY])
	})
})

describe('reset still means a fresh install', () => {
	it('clears the main blob, user-owned keys, parking filters and map layers', () => {
		const { data, storage } = memoryStorage([
			[MAIN_STATE_KEY, '{}'], ...USER_ENTRIES, ...DEVICE_ENTRIES, ['another-app', 'keep'],
		])
		clearAccountStorage(storage)
		// The Favorites tab selection was never part of reset and still is not.
		expect([...data.entries()]).toEqual([
			['citygoo-favorites-active-tab', 'routes'], ['another-app', 'keep'],
		])
	})
})

// No real accounts exist, so the boundary is proven on the state itself:
// whatever A leaves behind is what B signs in to.
describe('User A signs out, User B signs in', () => {
	it('B inherits none of A’s activity', () => {
		const a = userAState()
		expect(liveBookingCount(a)).toBe(0)
		const afterLogout = loggedOutState(a)
		// login() in the store: spreads the current state, sets the profile and
		// prepends its welcome.
		const b: SmartCityState = {
			...afterLogout,
			onboardingDone: true,
			user: { name: 'User B', phone: '+998902222222' },
			notifications: [{
				id: 'n-b', title: 'Xush kelibsiz', message: 'User B, SmartCity profilingiz tayyor.',
				createdAt: '2026-09-24T05:00:00.000Z', read: false, type: 'system',
			}, ...afterLogout.notifications],
		}
		expect(b.favorites).toEqual([])
		expect(b.favoriteQueueOrgs).toEqual([])
		expect(b.favoriteEvents).toEqual([])
		expect(b.savedRoutes).toEqual([])
		expect(b.reservations).toEqual([])
		expect(b.queueTickets).toEqual([])
		expect(b.serviceBookings).toEqual([])
		expect(bookingRows(b)).toEqual([])
		expect(b.notifications.map(item => item.message)).toEqual(['User B, SmartCity profilingiz tayyor.'])
		expect(JSON.stringify(b)).not.toContain('User A')
		expect(JSON.stringify(b)).not.toContain('+998901111111')
		expect(b.notificationPrefs).toEqual(initialState.notificationPrefs)
	})

	it('B finds none of A’s side storage, and A’s device preferences remain', () => {
		const { data, storage } = memoryStorage([...USER_ENTRIES, ...DEVICE_ENTRIES])
		clearUserOwnedStorage(storage)
		expect([...data.keys()].filter(key => key.startsWith('citygoo-parking-meta-'))).toEqual([])
		expect(data.has('citygoo-place-favorites')).toBe(false)
		expect(data.get('citygoo-parking-filters')).toBe('{"sort":"price"}')
		expect(data.get('citygoo-map-layers')).toBe('{"traffic":false}')
	})
})

// The same guard, applied the way the store applies it.
const LIVE_CASES: [string, Partial<SmartCityState>][] = [
	['parking reserved', { reservations: [reservation('reserved')] }],
	['parking active', { reservations: [reservation('active')] }],
	['queue waiting', { queueTickets: [ticket('waiting')] }],
	['queue called', { queueTickets: [ticket('called')] }],
	['queue arrived', { queueTickets: [ticket('arrived')] }],
	['service active', { serviceBookings: [service('active')] }],
]

describe.each([
	['logout', logOut],
	['account deletion', deleteAccount],
	['demo reset', resetDemoData],
])('%s with a live booking', (_, exit) => {
	it.each(LIVE_CASES)('is blocked by %s', (__, live) => {
		const state = { ...userAState(), ...live }
		expect(exit(state)).toEqual({ ok: false, live: 1 })
	})

	it('is blocked when the live one sits among history', () => {
		const a = userAState()
		const state = { ...a, queueTickets: [...a.queueTickets, ticket('waiting', 't-live')] }
		expect(exit(state)).toEqual({ ok: false, live: 1 })
	})

	it('is allowed with history only', () => {
		expect(exit(userAState()).ok).toBe(true)
	})
})

describe('account deletion when allowed', () => {
	// Unchanged from before the guard: the state resetDemo() sets.
	it('is a fresh install, onboarding included', () => {
		const exit = deleteAccount(userAState())
		expect(exit).toEqual({ ok: true, state: { ...initialState, hydrated: true } })
	})

	it('differs from logout only in forgetting onboarding', () => {
		const out = logOut(userAState())
		const deleted = deleteAccount(userAState())
		if (!out.ok || !deleted.ok) throw new Error('expected both to be allowed')
		expect(out.state).toEqual({ ...deleted.state, onboardingDone: true })
	})
})

describe('demo reset when allowed', () => {
	// The decision only gates resetDemo(); what it produces is unchanged.
	it('is the same fresh install as account deletion', () => {
		expect(resetDemoData(userAState())).toEqual(deleteAccount(userAState()))
		expect(resetDemoData(userAState())).toEqual({ ok: true, state: { ...initialState, hydrated: true } })
	})
})
