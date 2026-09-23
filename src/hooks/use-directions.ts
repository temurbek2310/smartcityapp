'use client'

import { useCallback, useState } from 'react'

import { destinationIdFrom, type DestinationSource } from '@/lib/navigation'

// Every screen that offers «Yo‘nalish» holds one of these and renders one
// <DirectionsSheet>. The screen names what the customer is looking at; the
// shared model turns it into a destination, and nothing opens on a guess:
// open() returns false when the reference resolves to nowhere, so the caller
// can say so instead of routing somewhere else.
export function useDirections() {
	const [destinationId, setDestinationId] = useState<string | null>(null)

	const open = useCallback((source: DestinationSource) => {
		const id = destinationIdFrom(source)
		if (!id) return false
		setDestinationId(id)
		return true
	}, [])

	const openId = useCallback((id: string | null | undefined) => {
		if (!id) return false
		setDestinationId(id)
		return true
	}, [])

	const close = useCallback(() => setDestinationId(null), [])

	return { destinationId, open, openId, close }
}
