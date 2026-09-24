'use client'

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
	type ReactNode,
} from 'react'

import { LocationPermissionSheet } from '@/components/location/location-permission-sheet'
import type { Coordinate } from '@/lib/geo'
import {
	createLocationStore,
	distanceFromUser,
	INITIAL_LOCATION_STATE,
	locationGate,
	type LocationGate,
	type LocationState,
} from '@/lib/location'

type LocationContextValue = LocationState & {
	// For every location feature the customer taps — «Joylashuvim», picking
	// «Mening joylashuvim», refreshing the origin. Goes to the browser only
	// when that is already allowed or has just been explained.
	requestLocation: () => void
	// Ask the browser again what it currently allows.
	recheckLocation: () => Promise<void>
}

const LocationContext = createContext<LocationContextValue | null>(null)

const serverSnapshot = () => INITIAL_LOCATION_STATE

// One location state for the whole session. Mounted above every screen, so a
// fix taken on Home is still there on /parking and /transport, and a screen
// opening never triggers a request of its own. Nothing is persisted: the
// fix lives exactly as long as the tab.
export function LocationProvider({ children }: { children: ReactNode }) {
	const [store] = useState(() =>
		createLocationStore(
			typeof navigator === 'undefined'
				? {}
				: {
						geolocation: navigator.geolocation,
						permissions: navigator.permissions,
					},
		),
	)
	const state = useSyncExternalStore(store.subscribe, store.getState, serverSnapshot)
	const [sheet, setSheet] = useState<Exclude<LocationGate, 'locate'> | null>(null)

	// Permission check on start: granted fetches straight away, prompt waits,
	// denied stays quiet. Also follows changes made in the browser settings.
	useEffect(() => store.start(), [store])

	const requestLocation = useCallback(() => {
		const gate = locationGate(store.getState())
		if (gate === 'locate') store.request()
		else setSheet(gate)
	}, [store])

	const recheckLocation = useCallback(() => store.recheck(), [store])

	// A sheet opened for a question the browser has since answered — the
	// customer allowed location in settings while it was up — closes itself.
	const openSheet =
		sheet === 'denied' && state.permission !== 'denied' && state.status !== 'fallback'
			? null
			: sheet

	const value = useMemo(
		() => ({ ...state, requestLocation, recheckLocation }),
		[state, requestLocation, recheckLocation],
	)

	return (
		<LocationContext.Provider value={value}>
			{children}
			{openSheet && (
				<LocationPermissionSheet
					kind={openSheet}
					state={state}
					onAllow={() => {
						setSheet(null)
						store.request()
					}}
					onRecheck={recheckLocation}
					onClose={() => setSheet(null)}
				/>
			)}
		</LocationContext.Provider>
	)
}

export function useLocation() {
	const value = useContext(LocationContext)
	if (!value) throw new Error('useLocation must be used inside LocationProvider')
	return value
}

// Distance from the customer's fix, or null. For list rows that used to print
// a catalog's fixed demo distance as if it were measured from the customer.
export function useDistanceFromUser() {
	const { position } = useLocation()
	return useCallback((point: Coordinate) => distanceFromUser(position, point), [position])
}
