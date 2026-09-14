'use client'

import { useEffect, useRef, useState } from 'react'

import { formatUZS } from '@/lib/format'
import type { Coordinate } from '@/lib/geo'
import { TASHKENT_CENTER, UZBEKISTAN_BOUNDS } from '@/lib/geo'
import type { Parking } from '@/lib/types'

type MapglModule = Awaited<ReturnType<typeof import('@2gis/mapgl').load>>
type MapInstance = InstanceType<MapglModule['Map']>
type MarkerInstance = InstanceType<MapglModule['HtmlMarker']>
type PolylineInstance = InstanceType<MapglModule['Polyline']>

type ParkingMapProps = {
	parkings: Parking[]
	onSelect?: (parkingId: string) => void
	selectedParkingId?: string | null
	userLocation?: Coordinate
	locateRevision?: number
	routeTo?: Coordinate
	// A real road-following route, when the navigate screen has fetched one
	// from 2GIS's Routing API. Falls back to the straight-line preview below
	// while it's loading or if the fetch fails.
	routePath?: Coordinate[]
	// City Goo puts a price tag under every parking pin, behind a toggle on the
	// map controls. The toggle existed here before this prop did, so it lit up
	// and changed nothing.
	showPrices?: boolean
	className?: string
}

function isCompactGroup(parkings: Parking[]) {
	if (parkings.length < 2) return false

	const lats = parkings.map(parking => parking.lat)
	const lngs = parkings.map(parking => parking.lng)

	return (
		Math.max(...lats) - Math.min(...lats) < 1.2 &&
		Math.max(...lngs) - Math.min(...lngs) < 1.2
	)
}

// Min/max reduction over a coordinate list, since 2GIS's LngLatBounds is a
// plain {southWest, northEast} object with no incremental `.extend()` builder
// like MapLibre's.
function boundsOf(points: Coordinate[]) {
	const lats = points.map(point => point.lat)
	const lngs = points.map(point => point.lng)
	return {
		southWest: [Math.min(...lngs), Math.min(...lats)],
		northEast: [Math.max(...lngs), Math.max(...lats)],
	}
}

export function ParkingMap({
	parkings,
	onSelect,
	selectedParkingId,
	userLocation,
	locateRevision = 0,
	routeTo,
	routePath,
	showPrices = false,
	className = 'h-[46vh]',
}: ParkingMapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<MapInstance | null>(null)
	const mapglRef = useRef<MapglModule | null>(null)
	const parkingMarkersRef = useRef<MarkerInstance[]>([])
	const userMarkerRef = useRef<MarkerInstance | null>(null)
	const userDotElRef = useRef<HTMLDivElement | null>(null)
	const routeRef = useRef<PolylineInstance | null>(null)
	const onSelectRef = useRef(onSelect)
	const [mapReady, setMapReady] = useState(false)

	useEffect(() => {
		onSelectRef.current = onSelect
	}, [onSelect])

	// Create the map once. Parking markers are managed separately so selecting,
	// searching or receiving GPS does not destroy/recreate the map instance.
	useEffect(() => {
		if (!containerRef.current) return

		let disposed = false
		let resizeObserver: ResizeObserver | undefined

		void (async () => {
			const { load } = await import('@2gis/mapgl')
			const mapgl = await load()

			if (disposed || !containerRef.current) return

			const container = containerRef.current
			mapglRef.current = mapgl

			const map = new mapgl.Map(container, {
				center: [TASHKENT_CENTER.lng, TASHKENT_CENTER.lat],
				zoom: 11.2,
				minZoom: 5,
				maxZoom: 18,
				maxBounds: {
					southWest: [UZBEKISTAN_BOUNDS.west, UZBEKISTAN_BOUNDS.south],
					northEast: [UZBEKISTAN_BOUNDS.east, UZBEKISTAN_BOUNDS.north],
				},
				key: process.env.NEXT_PUBLIC_MAPGL_API_KEY,
			})

			mapRef.current = map

			// DOM markers do not depend on any tile/network load, so mark the
			// instance ready immediately after construction.
			setMapReady(true)
			map.invalidateSize()

			if (typeof ResizeObserver !== 'undefined') {
				resizeObserver = new ResizeObserver(() => map.invalidateSize())
				resizeObserver.observe(container)
			}
		})()

		return () => {
			disposed = true
			resizeObserver?.disconnect()

			parkingMarkersRef.current.forEach(marker => marker.destroy())
			parkingMarkersRef.current = []

			userMarkerRef.current?.destroy()
			userMarkerRef.current = null
			userDotElRef.current = null

			routeRef.current?.destroy()
			routeRef.current = null

			mapRef.current?.destroy()
			mapRef.current = null
			mapglRef.current = null
		}
	}, [])

	// Parking markers. IMPORTANT: 2GIS owns the transform of the OUTER
	// element. Never put a CSS transition on that outer transform or markers
	// will visibly lag behind the map while panning/zooming. Visual focus is
	// applied only with inner box-shadow, so the geographic anchor stays fixed.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current

		if (!map || !mapgl || !mapReady) return

		parkingMarkersRef.current.forEach(marker => marker.destroy())
		parkingMarkersRef.current = []

		const nextMarkers: MarkerInstance[] = []

		for (const parking of parkings) {
			const selected = parking.id === selectedParkingId
			const full = parking.availableSpaces <= 0
			const low = !full && parking.availableSpaces <= 5

			const markerColor = full ? '#ef4444' : low ? '#f59e0b' : '#0f766e'

			const outer = document.createElement('button')
			outer.type = 'button'
			outer.className = 'citygo-map-pin'
			outer.title = `${parking.name} — ${parking.availableSpaces} bo‘sh joy`
			outer.setAttribute(
				'aria-label',
				`${parking.name}, ${parking.availableSpaces} bo‘sh joy`,
			)
			outer.style.cssText = `
        position: relative;
        width: 48px;
        height: 56px;
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        z-index: ${selected ? '20' : '1'};
      `

			const visual = document.createElement('span')
			visual.className = 'citygo-map-pin-bubble'
			visual.style.cssText = `
        position: relative;
        display: flex;
        width: 42px;
        height: 42px;
        align-items: center;
        justify-content: center;
        border-radius: 15px;
        border: 3px solid #ffffff;
        background: ${markerColor};
        color: #ffffff;
        font: 800 12px/1 var(--font-sans);
        box-sizing: border-box;
        box-shadow: ${
					selected
						? '0 0 0 5px rgba(20,184,166,.22), 0 10px 28px rgba(15,23,42,.32)'
						: '0 7px 18px rgba(15,23,42,.24)'
				};
        pointer-events: none;
      `

			// A bare count, including "0" when full: the pin is 42px, the red
			// band already reads as full, and "TO‘LA" sets badly at that size.
			// The Uzbek meaning is carried by title and aria-label above.
			visual.textContent = String(parking.availableSpaces)

			const tail = document.createElement('span')
			tail.style.cssText = `
        position: absolute;
        left: 50%;
        bottom: -6px;
        width: 10px;
        height: 10px;
        border-right: 3px solid #ffffff;
        border-bottom: 3px solid #ffffff;
        background: ${markerColor};
        transform: translateX(-50%) rotate(45deg);
        border-bottom-right-radius: 2px;
      `

			visual.appendChild(tail)
			outer.appendChild(visual)

			if (showPrices) {
				const price = document.createElement('span')
				price.textContent = parking.pricePerHour
					? `${formatUZS(parking.pricePerHour)}/soat`
					: 'Bepul'
				price.style.cssText = `
          position: absolute;
          left: 50%;
          bottom: -16px;
          transform: translateX(-50%);
          background: #ffffff;
          color: #0f172a;
          font: 700 10px/1 var(--font-sans);
          padding: 3px 6px;
          border-radius: 7px;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15,23,42,.2);
          pointer-events: none;
        `
				outer.appendChild(price)
			}

			outer.addEventListener('click', event => {
				event.preventDefault()
				event.stopPropagation()
				onSelectRef.current?.(parking.id)
			})

			const marker = new mapgl.HtmlMarker(map, {
				coordinates: [parking.lng, parking.lat],
				html: outer,
				// The tip should land on the tail's pointed tip, which extends
				// below the 56px-tall box — nudge visually if it looks off.
				anchor: [24, 62],
			})

			nextMarkers.push(marker)
		}

		parkingMarkersRef.current = nextMarkers

		return () => {
			nextMarkers.forEach(marker => marker.destroy())
			if (parkingMarkersRef.current === nextMarkers) {
				parkingMarkersRef.current = []
			}
		}
	}, [parkings, selectedParkingId, showPrices, mapReady])

	// When search results change, show a useful local viewport. We deliberately
	// do NOT fit all Uzbekistan-wide demo records into one view because that
	// makes nearby Tashkent results tiny and hard to use.
	useEffect(() => {
		const map = mapRef.current

		if (!map || !mapReady || selectedParkingId || routeTo) return

		if (parkings.length === 0) return

		if (parkings.length === 1) {
			const parking = parkings[0]
			map.setCenter([parking.lng, parking.lat], { animate: true, duration: 500 })
			map.setZoom(14.5, { animate: true, duration: 500 })
			return
		}

		if (isCompactGroup(parkings)) {
			const bounds = boundsOf(parkings)
			map.fitBounds(bounds, {
				padding: { top: 54, right: 54, bottom: 54, left: 54 },
				maxZoom: 14,
				animation: { duration: 550 },
			})
			return
		}

		const center = userLocation ?? TASHKENT_CENTER
		map.setCenter([center.lng, center.lat], { animate: true, duration: 450 })
		map.setZoom(11.2, { animate: true, duration: 450 })
	}, [parkings, mapReady, selectedParkingId, routeTo, userLocation])

	// Selected parking focus mode.
	useEffect(() => {
		const map = mapRef.current
		if (!map || !mapReady || !selectedParkingId || routeTo) return

		const parking = parkings.find(item => item.id === selectedParkingId)
		if (!parking) return

		map.setCenter([parking.lng, parking.lat], { animate: true, duration: 650 })
		map.setZoom(Math.max(map.getZoom(), 15), { animate: true, duration: 650 })
	}, [selectedParkingId, parkings, mapReady, routeTo])

	// User location dot.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current

		if (!map || !mapgl || !mapReady) return

		userMarkerRef.current?.destroy()
		userMarkerRef.current = null
		userDotElRef.current = null

		if (!userLocation) return

		const element = document.createElement('div')
		element.className = 'citygo-location-dot'
		element.setAttribute('aria-label', 'Sizning joylashuvingiz')
		element.style.cssText = `
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 4px solid #ffffff;
      background: #0ea5e9;
      box-shadow: 0 0 0 7px rgba(14,165,233,.18), 0 4px 12px rgba(15,23,42,.18);
    `
		userDotElRef.current = element

		userMarkerRef.current = new mapgl.HtmlMarker(map, {
			coordinates: [userLocation.lng, userLocation.lat],
			html: element,
			anchor: [9, 9],
		})

		if (!selectedParkingId && !routeTo) {
			map.setCenter([userLocation.lng, userLocation.lat], {
				animate: true,
				duration: 500,
			})
			map.setZoom(Math.max(map.getZoom(), 12), { animate: true, duration: 500 })
		}

		return () => {
			userMarkerRef.current?.destroy()
			userMarkerRef.current = null
			userDotElRef.current = null
		}
	}, [userLocation, selectedParkingId, routeTo, mapReady])

	useEffect(() => {
		if (!mapReady || !locateRevision || !userLocation) return
		const element = userDotElRef.current
		if (!element) return
		element.classList.remove('is-ping')
		void element.offsetWidth
		element.classList.add('is-ping')
	}, [mapReady, userLocation, locateRevision])

	// Route preview: a real road-following route (routePath) when the navigate
	// screen has fetched one, otherwise a straight-line MVP stand-in between
	// the user and the target.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current

		if (!map || !mapgl || !mapReady) return

		routeRef.current?.destroy()
		routeRef.current = null

		const points: Coordinate[] | undefined =
			routePath && routePath.length >= 2
				? routePath
				: userLocation && routeTo
					? [userLocation, routeTo]
					: undefined

		if (!points) return

		routeRef.current = new mapgl.Polyline(map, {
			coordinates: points.map(point => [point.lng, point.lat]),
			color: '#0f766e',
			width: 5,
		})

		const bounds = boundsOf(points)
		map.fitBounds(bounds, {
			padding: { top: 64, right: 64, bottom: 64, left: 64 },
			maxZoom: 14,
			animation: { duration: 550 },
		})
	}, [userLocation, routeTo, routePath, mapReady])

	return (
		<div
			ref={containerRef}
			className={`citygo-map-root relative overflow-hidden rounded-[2rem] bg-card-2 ${className}`}
		/>
	)
}
