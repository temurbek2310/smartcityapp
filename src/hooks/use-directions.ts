'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import {
	destinationIdFrom,
	routeHref,
	type DestinationSource,
} from '@/lib/navigation'
import { DEFAULT_TRANSPORT_MODE, type TransportMode } from '@/lib/transport'

// Every «Yo‘nalish» on a known destination goes through here: the screen
// names what the customer is looking at, the shared model turns it into a
// destination id, and the customer lands on /transport with it — no sheet
// asking them to confirm a place they already picked. Nothing opens on a
// guess: open() returns false when the reference resolves to nowhere, so the
// caller can say so instead of routing somewhere else.
export function useDirections() {
	const router = useRouter()

	const openId = useCallback(
		(
			id: string | null | undefined,
			// Callers that already know a mode pass it; the shared default
			// covers the rest, and /transport lets the customer switch.
			mode: TransportMode = DEFAULT_TRANSPORT_MODE,
		) => {
			if (!id) return false
			router.push(routeHref({ mode, destinationId: id }))
			return true
		},
		[router],
	)

	const open = useCallback(
		(source: DestinationSource, mode?: TransportMode) =>
			openId(destinationIdFrom(source), mode),
		[openId],
	)

	return { open, openId }
}
