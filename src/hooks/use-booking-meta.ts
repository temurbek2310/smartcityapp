'use client'

import { useEffect, useState } from 'react'

import { readBookingMeta, type ParkingBookingMeta } from '@/lib/booking-meta'

// Bay and level live outside the reservation, under their own localStorage
// key per booking. Reading them has to be deferred past the first render or
// the client output disagrees with the server's — the same reason
// use-place-favorites and use-parking-filters defer theirs.
//
// Extracted from the bookings list once the parking screen's active-booking
// banner needed the same values.
export function useBookingMeta(reservationId: string | undefined) {
	const [meta, setMeta] = useState<ParkingBookingMeta | null>(null)

	useEffect(() => {
		// Everything goes through the timeout, the no-id case included — a
		// synchronous setState here would cascade an extra render.
		const timer = window.setTimeout(() => {
			setMeta(reservationId ? (readBookingMeta(reservationId) ?? null) : null)
		}, 0)
		return () => window.clearTimeout(timer)
	}, [reservationId])

	return meta
}

// The list form: every reservation's meta in one map, so a list renders in
// a single pass rather than mounting a hook per row.
export function useBookingMetaMap(reservationIds: string[]) {
	const [map, setMap] = useState<Record<string, ParkingBookingMeta>>({})
	const key = reservationIds.join(',')

	useEffect(() => {
		const timer = window.setTimeout(() => {
			const next: Record<string, ParkingBookingMeta> = {}
			for (const id of key ? key.split(',') : []) {
				const found = readBookingMeta(id)
				if (found) next[id] = found
			}
			setMap(next)
		}, 0)
		return () => window.clearTimeout(timer)
	}, [key])

	return map
}
