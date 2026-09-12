'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { parkingAvailability } from '@/lib/availability'
import { distanceKm, type Coordinate } from '@/lib/geo'
import type { Parking } from '@/lib/types'

// Every control on the parking screen writes here, and the list reads back
// one filtered, sorted array. Kept out of the page so the screen stays a
// composition and the same state can drive a full-screen map later.

export type ParkingChip =
	| 'all'
	| 'covered'
	| 'open'
	| 'ev'
	| 'bike'
	| 'free'
	| 'h24'
	| 'accessible'

export type ParkingSort = 'distance' | 'price' | 'available' | 'rating'

// How full a lot is, banded. This is the strongest filter on the screen:
// "show me somewhere I will actually get in".
export type LoadBand = 'all' | 'free' | 'some' | 'tight' | 'full'

export type AdvancedFilters = {
	covered: boolean
	ev: boolean
	accessible: boolean
	secure: boolean
	freeOnly: boolean
	h24: boolean
	maxPrice: number | null
	maxDistanceKm: number | null
}

const EMPTY_ADVANCED: AdvancedFilters = {
	covered: false,
	ev: false,
	accessible: false,
	secure: false,
	freeOnly: false,
	h24: false,
	maxPrice: null,
	maxDistanceKm: null,
}

export const PARKING_CHIPS: { id: ParkingChip; label: string }[] = [
	{ id: 'all', label: 'Barchasi' },
	{ id: 'covered', label: 'Yopiq' },
	{ id: 'open', label: 'Ochiq' },
	{ id: 'ev', label: 'EV quvvatlash' },
	{ id: 'bike', label: 'Velosiped' },
	{ id: 'free', label: 'Bepul' },
	{ id: 'h24', label: '24/7' },
	{ id: 'accessible', label: 'Nogironlar uchun' },
]

export const PARKING_SORTS: { id: ParkingSort; label: string }[] = [
	{ id: 'distance', label: 'Yaqinroq' },
	{ id: 'price', label: 'Arzonroq' },
	{ id: 'available', label: 'Ko‘proq bo‘sh joy' },
	{ id: 'rating', label: 'Yuqori reyting' },
]

export const LOAD_BANDS: { id: LoadBand; label: string; tone: string }[] = [
	{ id: 'all', label: 'Barchasi', tone: 'bg-ink-3' },
	{ id: 'free', label: 'Bo‘sh', tone: 'bg-ok' },
	{ id: 'some', label: 'Joy bor', tone: 'bg-warn' },
	{ id: 'tight', label: 'Kam joy', tone: 'bg-load-high' },
	{ id: 'full', label: 'To‘la', tone: 'bg-bad' },
]

export const PRICE_CEILINGS = [3000, 5000, 8000, 10000, 12000]
export const DISTANCE_CEILINGS_KM = [0.3, 0.6, 1, 2, 5]

const STORAGE_KEY = 'citygoo-parking-filters'

function bandOf(parking: Parking): Exclude<LoadBand, 'all'> {
	if (parking.availableSpaces <= 0) return 'full'
	const { percent } = parkingAvailability(parking)
	if (percent >= 30) return 'free'
	if (percent >= 15) return 'some'
	return 'tight'
}

function matchesChip(parking: Parking, chip: ParkingChip) {
	switch (chip) {
		case 'covered':
			return parking.amenities.includes('Covered')
		case 'open':
			return !parking.amenities.includes('Covered')
		case 'ev':
			return parking.evChargers > 0
		case 'bike':
			return parking.amenities.includes('Bike Parking')
		case 'free':
			return parking.pricePerHour === 0
		case 'h24':
			return parking.workingHours === '24/7'
		case 'accessible':
			return parking.accessibleSpaces > 0
		default:
			return true
	}
}

function matchesAdvanced(
	parking: Parking,
	advanced: AdvancedFilters,
	km: number,
) {
	if (advanced.covered && !parking.amenities.includes('Covered')) return false
	if (advanced.ev && parking.evChargers <= 0) return false
	if (advanced.accessible && parking.accessibleSpaces <= 0) return false
	if (advanced.secure && !parking.amenities.includes('Security')) return false
	if (advanced.freeOnly && parking.pricePerHour !== 0) return false
	if (advanced.h24 && parking.workingHours !== '24/7') return false
	if (advanced.maxPrice !== null && parking.pricePerHour > advanced.maxPrice)
		return false
	if (advanced.maxDistanceKm !== null && km > advanced.maxDistanceKm)
		return false
	return true
}

export function countActiveAdvanced(advanced: AdvancedFilters) {
	return Object.values(advanced).filter(value =>
		typeof value === 'boolean' ? value : value !== null,
	).length
}

export function useParkingFilters(parkings: Parking[], origin: Coordinate) {
	const [query, setQuery] = useState('')
	const [chip, setChip] = useState<ParkingChip>('all')
	const [sort, setSort] = useState<ParkingSort>('distance')
	const [band, setBand] = useState<LoadBand>('all')
	const [showPrices, setShowPrices] = useState(false)
	const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED)

	// Read after mount, so the first client render still matches the server —
	// the pattern use-place-favorites established.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY)
				if (!raw) return
				const saved = JSON.parse(raw)
				if (saved.chip) setChip(saved.chip)
				if (saved.sort) setSort(saved.sort)
				if (saved.band) setBand(saved.band)
				if (typeof saved.showPrices === 'boolean')
					setShowPrices(saved.showPrices)
				if (saved.advanced)
					setAdvanced({ ...EMPTY_ADVANCED, ...saved.advanced })
			} catch {
				// A corrupt blob just means the defaults stand.
			}
		}, 0)
		return () => window.clearTimeout(timer)
	}, [])

	useEffect(() => {
		try {
			window.localStorage.setItem(
				STORAGE_KEY,
				// The query is deliberately not persisted: coming back to a
				// screen silently filtered by text you typed yesterday reads as
				// missing data.
				JSON.stringify({ chip, sort, band, showPrices, advanced }),
			)
		} catch {
			// Filters still work without persistence.
		}
	}, [chip, sort, band, showPrices, advanced])

	const withDistance = useMemo(
		() =>
			parkings.map(parking => ({
				parking,
				km: distanceKm(origin, parking),
			})),
		[parkings, origin],
	)

	const results = useMemo(() => {
		const needle = query.trim().toLowerCase()

		const filtered = withDistance.filter(({ parking, km }) => {
			if (
				needle &&
				!`${parking.name} ${parking.address} ${parking.district}`
					.toLowerCase()
					.includes(needle)
			)
				return false
			if (!matchesChip(parking, chip)) return false
			if (band !== 'all' && bandOf(parking) !== band) return false
			if (!matchesAdvanced(parking, advanced, km)) return false
			return true
		})

		const sorted = [...filtered].sort((a, b) => {
			switch (sort) {
				case 'price':
					return a.parking.pricePerHour - b.parking.pricePerHour
				case 'available':
					return b.parking.availableSpaces - a.parking.availableSpaces
				case 'rating':
					return b.parking.rating - a.parking.rating
				default:
					return a.km - b.km
			}
		})

		return sorted
	}, [withDistance, query, chip, band, advanced, sort])

	const reset = useCallback(() => {
		setQuery('')
		setChip('all')
		setBand('all')
		setAdvanced(EMPTY_ADVANCED)
	}, [])

	const activeCount =
		countActiveAdvanced(advanced) +
		(chip === 'all' ? 0 : 1) +
		(band === 'all' ? 0 : 1)

	return {
		query, setQuery,
		chip, setChip,
		sort, setSort,
		band, setBand,
		showPrices, setShowPrices,
		advanced, setAdvanced,
		results,
		activeCount,
		reset,
	}
}
