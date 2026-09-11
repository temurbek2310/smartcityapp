'use client'

import { useEffect, useRef, useState } from 'react'

import type { Coordinate } from '@/lib/geo'
import { TASHKENT_CENTER, UZBEKISTAN_BOUNDS } from '@/lib/geo'
import type { Parking } from '@/lib/types'

type MapLibreModule = typeof import('maplibre-gl')
type MapInstance = InstanceType<MapLibreModule['Map']>
type MarkerInstance = InstanceType<MapLibreModule['Marker']>

type ParkingMapProps = {
	parkings: Parking[]
	onSelect?: (parkingId: string) => void
	selectedParkingId?: string | null
	userLocation?: Coordinate
	routeTo?: Coordinate
	className?: string
}

const ROUTE_SOURCE = 'bspace-route-source'
const ROUTE_LAYER = 'bspace-route-layer'

function isCompactGroup(parkings: Parking[]) {
	if (parkings.length < 2) return false

	const lats = parkings.map(parking => parking.lat)
	const lngs = parkings.map(parking => parking.lng)

	return (
		Math.max(...lats) - Math.min(...lats) < 1.2 &&
		Math.max(...lngs) - Math.min(...lngs) < 1.2
	)
}

export function ParkingMap({
	parkings,
	onSelect,
	selectedParkingId,
	userLocation,
	routeTo,
	className = 'h-[46vh]',
}: ParkingMapProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<MapInstance | null>(null)
	const maplibreRef = useRef<MapLibreModule | null>(null)
	const parkingMarkersRef = useRef<MarkerInstance[]>([])
	const userMarkerRef = useRef<MarkerInstance | null>(null)
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
			const maplibregl = await import('maplibre-gl')

			if (disposed || !containerRef.current) return

			const container = containerRef.current
			maplibreRef.current = maplibregl

			const map = new maplibregl.Map({
				container,
				style: {
					version: 8,
					sources: {
						osm: {
							type: 'raster',
							tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
							tileSize: 256,
							attribution: '© OpenStreetMap contributors',
						},
					},
					layers: [
						{
							id: 'osm-base-map',
							type: 'raster',
							source: 'osm',
						},
					],
				},
				center: [TASHKENT_CENTER.lng, TASHKENT_CENTER.lat],
				zoom: 11.2,
				minZoom: 5,
				maxZoom: 18,
				maxBounds: [
					[UZBEKISTAN_BOUNDS.west, UZBEKISTAN_BOUNDS.south],
					[UZBEKISTAN_BOUNDS.east, UZBEKISTAN_BOUNDS.north],
				],
				// attributionControl: true,
			})

			mapRef.current = map

			map.addControl(
				new maplibregl.NavigationControl({
					showCompass: false,
				}),
				'top-right',
			)

			// DOM markers do not depend on raster tiles finishing their network load,
			// so mark the instance ready immediately after construction.
			setMapReady(true)

			map.once('load', () => {
				if (!disposed) map.resize()
			})

			if (typeof ResizeObserver !== 'undefined') {
				resizeObserver = new ResizeObserver(() => map.resize())
				resizeObserver.observe(container)
			}
		})()

		return () => {
			disposed = true
			resizeObserver?.disconnect()

			parkingMarkersRef.current.forEach(marker => marker.remove())
			parkingMarkersRef.current = []

			userMarkerRef.current?.remove()
			userMarkerRef.current = null

			mapRef.current?.remove()
			mapRef.current = null
			maplibreRef.current = null
		}
	}, [])

	// Parking markers. IMPORTANT: MapLibre owns the transform of the OUTER
	// element. Never put a CSS transition on that outer transform or markers
	// will visibly lag behind the map while panning/zooming. Visual focus is
	// applied only with inner box-shadow, so the geographic anchor stays fixed.
	useEffect(() => {
		const map = mapRef.current
		const maplibregl = maplibreRef.current

		if (!map || !maplibregl || !mapReady) return

		parkingMarkersRef.current.forEach(marker => marker.remove())
		parkingMarkersRef.current = []

		const nextMarkers: MarkerInstance[] = []

		for (const parking of parkings) {
			const selected = parking.id === selectedParkingId
			const full = parking.availableSpaces <= 0
			const low = !full && parking.availableSpaces <= 5

			const markerColor = full ? '#ef4444' : low ? '#f59e0b' : '#0f766e'

			const outer = document.createElement('button')
			outer.type = 'button'
			outer.title = `${parking.name} — ${parking.availableSpaces} bo‘sh joy`
			outer.setAttribute(
				'aria-label',
				`${parking.name}, ${parking.availableSpaces} bo‘sh joy`,
			)
			outer.style.cssText = `
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
        transition: box-shadow 160ms ease;
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

			outer.addEventListener('click', event => {
				event.preventDefault()
				event.stopPropagation()
				onSelectRef.current?.(parking.id)
			})

			const marker = new maplibregl.Marker({
				element: outer,
				anchor: 'bottom',
				offset: [0, -6],
			})
				.setLngLat([parking.lng, parking.lat])
				.addTo(map)

			nextMarkers.push(marker)
		}

		parkingMarkersRef.current = nextMarkers

		return () => {
			nextMarkers.forEach(marker => marker.remove())
			if (parkingMarkersRef.current === nextMarkers) {
				parkingMarkersRef.current = []
			}
		}
	}, [parkings, selectedParkingId, mapReady])

	// When search results change, show a useful local viewport. We deliberately
	// do NOT fit all Uzbekistan-wide demo records into one view because that
	// makes nearby Tashkent results tiny and hard to use.
	useEffect(() => {
		const map = mapRef.current
		const maplibregl = maplibreRef.current

		if (!map || !maplibregl || !mapReady || selectedParkingId || routeTo) return

		if (parkings.length === 0) return

		if (parkings.length === 1) {
			const parking = parkings[0]
			map.easeTo({
				center: [parking.lng, parking.lat],
				zoom: 14.5,
				duration: 500,
			})
			return
		}

		if (isCompactGroup(parkings)) {
			const bounds = new maplibregl.LngLatBounds()
			parkings.forEach(parking => bounds.extend([parking.lng, parking.lat]))
			map.fitBounds(bounds, {
				padding: 54,
				maxZoom: 14,
				duration: 550,
			})
			return
		}

		const center = userLocation ?? TASHKENT_CENTER
		map.easeTo({
			center: [center.lng, center.lat],
			zoom: 11.2,
			duration: 450,
		})
	}, [parkings, mapReady, selectedParkingId, routeTo, userLocation])

	// Selected parking focus mode.
	useEffect(() => {
		const map = mapRef.current
		if (!map || !mapReady || !selectedParkingId || routeTo) return

		const parking = parkings.find(item => item.id === selectedParkingId)
		if (!parking) return

		map.easeTo({
			center: [parking.lng, parking.lat],
			zoom: Math.max(map.getZoom(), 15),
			duration: 650,
		})
	}, [selectedParkingId, parkings, mapReady, routeTo])

	// User location dot.
	useEffect(() => {
		const map = mapRef.current
		const maplibregl = maplibreRef.current

		if (!map || !maplibregl || !mapReady) return

		userMarkerRef.current?.remove()
		userMarkerRef.current = null

		if (!userLocation) return

		const element = document.createElement('div')
		element.setAttribute('aria-label', 'Sizning joylashuvingiz')
		element.style.cssText = `
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 4px solid #ffffff;
      background: #0ea5e9;
      box-shadow: 0 0 0 7px rgba(14,165,233,.18), 0 4px 12px rgba(15,23,42,.18);
    `

		userMarkerRef.current = new maplibregl.Marker({
			element,
			anchor: 'center',
		})
			.setLngLat([userLocation.lng, userLocation.lat])
			.addTo(map)

		if (!selectedParkingId && !routeTo) {
			map.easeTo({
				center: [userLocation.lng, userLocation.lat],
				zoom: Math.max(map.getZoom(), 12),
				duration: 500,
			})
		}

		return () => {
			userMarkerRef.current?.remove()
			userMarkerRef.current = null
		}
	}, [userLocation, selectedParkingId, routeTo, mapReady])

	// Straight-line MVP navigation preview. The real road routing hand-off is
	// handled by the navigation page's external navigator button.
	useEffect(() => {
		const map = mapRef.current
		const maplibregl = maplibreRef.current

		if (!map || !maplibregl || !mapReady) return

		const removeRoute = () => {
			if (map.getLayer(ROUTE_LAYER)) map.removeLayer(ROUTE_LAYER)
			if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE)
		}

		if (!userLocation || !routeTo) {
			if (map.isStyleLoaded()) removeRoute()
			return
		}

		const drawRoute = () => {
			removeRoute()

			map.addSource(ROUTE_SOURCE, {
				type: 'geojson',
				data: {
					type: 'Feature',
					properties: {},
					geometry: {
						type: 'LineString',
						coordinates: [
							[userLocation.lng, userLocation.lat],
							[routeTo.lng, routeTo.lat],
						],
					},
				},
			})

			map.addLayer({
				id: ROUTE_LAYER,
				type: 'line',
				source: ROUTE_SOURCE,
				paint: {
					'line-color': '#0f766e',
					'line-width': 5,
					'line-opacity': 0.86,
				},
			})

			const bounds = new maplibregl.LngLatBounds()
			bounds.extend([userLocation.lng, userLocation.lat])
			bounds.extend([routeTo.lng, routeTo.lat])
			map.fitBounds(bounds, {
				padding: 64,
				maxZoom: 14,
				duration: 550,
			})
		}

		if (map.isStyleLoaded()) {
			drawRoute()
		} else {
			map.once('load', drawRoute)
		}

		return () => {
			map.off('load', drawRoute)
		}
	}, [userLocation, routeTo, mapReady])

	return (
		<div
			ref={containerRef}
			className={`relative overflow-hidden rounded-[2rem] bg-slate-100 ${className}`}
		/>
	)
}
