'use client'

import { useCallback, useEffect, useState } from 'react'

import {
	DEFAULT_LAYERS,
	readLayers,
	writeLayers,
	type MapLayerId,
	type MapLayerState,
} from '@/lib/map-layers'

// Which map layers are on. Read is deferred past the first render so the
// client's markup matches the server's — the same reason use-place-favorites
// and use-parking-filters defer theirs.
export function useMapLayers() {
	const [layers, setLayers] = useState<MapLayerState>(DEFAULT_LAYERS)
	const [hydrated, setHydrated] = useState(false)

	useEffect(() => {
		const timer = window.setTimeout(() => {
			setLayers(readLayers())
			setHydrated(true)
		}, 0)
		return () => window.clearTimeout(timer)
	}, [])

	useEffect(() => {
		if (!hydrated) return
		writeLayers(layers)
	}, [layers, hydrated])

	const toggle = useCallback((id: MapLayerId) => {
		setLayers(current => ({ ...current, [id]: !current[id] }))
	}, [])

	return { layers, toggle }
}
