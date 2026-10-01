'use client'

import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Ref } from 'react'

import type { Coordinate } from '@/lib/geo'
import { TASHKENT_CENTER, UZBEKISTAN_BOUNDS } from '@/lib/geo'
import { mapObjectKey, type MapObject, type MapSymbol } from '@/lib/map-objects'
import type { MapLine } from '@/lib/home-map'
import { cameraFrameKey, diffMapLines, mapLineSignature, type CameraFrame } from '@/lib/map-geometry'

type MapglModule = Awaited<ReturnType<typeof import('@2gis/mapgl').load>>
type MapInstance = InstanceType<MapglModule['Map']>
type MarkerInstance = InstanceType<MapglModule['HtmlMarker']>
type PolylineInstance = InstanceType<MapglModule['Polyline']>

// What the screen above can ask the map to do. ParkingMap drives its camera
// from props alone because its screen only ever reacts to a selection; /map
// has explicit locate and fit-bounds buttons, which are commands rather than
// state, so they come through a handle instead of a prop that has to be
// toggled back.
export type CityMapHandle = {
	flyTo: (object: MapObject) => void
	fitAll: () => void
	goToUser: () => void
}

function boundsOf(points: { lat: number; lng: number }[]) {
	const lats = points.map(point => point.lat)
	const lngs = points.map(point => point.lng)
	return {
		southWest: [Math.min(...lngs), Math.min(...lats)],
		northEast: [Math.max(...lngs), Math.max(...lats)],
	}
}

export function CityMap({
	objects,
	selectedKey,
	onSelect,
	userLocation,
	handleRef,
	lines = EMPTY_LINES,
	frame,
	viewportKey = '',
	locateRevision = 0,
	bottomPadding = 56,
	className = 'h-full',
}: {
	objects: MapObject[]
	selectedKey?: string | null
	onSelect?: (object: MapObject) => void
	// A real GPS fix, or nothing. The blue dot and every follow-the-user
	// recentre hang off this, so the city-centre fallback must never be passed.
	userLocation?: Coordinate
	handleRef?: Ref<CityMapHandle>
	lines?: MapLine[]
	// What the camera must show, when the screen knows better than "all the
	// pins" — a route view passes its line and both ends (see routeFrame()).
	// Given, it replaces the object-based first fit, and the map refits
	// whenever the frame itself changes. Left undefined, nothing changes.
	frame?: CameraFrame | null
	viewportKey?: string
	locateRevision?: number
	bottomPadding?: number
	className?: string
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<MapInstance | null>(null)
	const mapglRef = useRef<MapglModule | null>(null)
	const markersRef = useRef<MarkerInstance[]>([])
	const userMarkerRef = useRef<MarkerInstance | null>(null)
	const userDotElRef = useRef<HTMLDivElement | null>(null)
	const linesRef = useRef<Map<string, { polyline: PolylineInstance; signature: string }>>(new Map())
	const onSelectRef = useRef(onSelect)
	const objectsRef = useRef(objects)
	const [ready, setReady] = useState(false)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		onSelectRef.current = onSelect
	}, [onSelect])

	useEffect(() => {
		objectsRef.current = objects
	}, [objects])

	// Build the map once. Markers are managed in their own effect so changing
	// the filter never tears down the map instance.
	useEffect(() => {
		if (!containerRef.current) return

		let disposed = false
		let resizeObserver: ResizeObserver | undefined
		// Captured once: the Map instance itself never gets reassigned, only
		// mutated in place, so this stays valid for the cleanup below.
		const lines = linesRef.current

		void (async () => {
			const { load } = await import('@2gis/mapgl')
			const mapgl = await load()
			if (disposed || !containerRef.current) return

			const container = containerRef.current
			mapglRef.current = mapgl

			const map = new mapgl.Map(container, {
				center: [TASHKENT_CENTER.lng, TASHKENT_CENTER.lat],
				zoom: 12.2,
				zoomControl: false,
				minZoom: 5,
				maxZoom: 18,
				maxBounds: {
					southWest: [UZBEKISTAN_BOUNDS.west, UZBEKISTAN_BOUNDS.south],
					northEast: [UZBEKISTAN_BOUNDS.east, UZBEKISTAN_BOUNDS.north],
				},
				key: process.env.NEXT_PUBLIC_MAPGL_API_KEY,
			})

			mapRef.current = map
			setReady(true)
			map.invalidateSize()

			if (typeof ResizeObserver !== 'undefined') {
				resizeObserver = new ResizeObserver(() => map.invalidateSize())
				resizeObserver.observe(container)
			}
		})().catch(() => {
			if (!disposed) setFailed(true)
		})

		return () => {
			disposed = true
			resizeObserver?.disconnect()
			markersRef.current.forEach(marker => marker.destroy())
			markersRef.current = []
			userMarkerRef.current?.destroy()
			userMarkerRef.current = null
			userDotElRef.current = null
			lines.forEach(line => line.polyline.destroy())
			lines.clear()
			mapRef.current?.destroy()
			mapRef.current = null
			mapglRef.current = null
		}
	}, [])

	// Object pins. 2GIS owns the outer element's transform, so selection is
	// expressed with box-shadow and z-index on an inner span only — a CSS
	// transition on the outer transform makes pins lag the map while panning.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current
		if (!map || !mapgl || !ready) return

		markersRef.current.forEach(marker => marker.destroy())
		markersRef.current = []

		const next: MarkerInstance[] = []

		for (const object of objects) {
			const key = mapObjectKey(object)
			const selected = key === selectedKey

			const outer = document.createElement('button')
			outer.type = 'button'
			outer.className = 'citygo-map-pin'
			outer.setAttribute(
				'aria-label',
				`${object.title}${object.tag ? `, ${object.tag}` : ''}`,
			)
			outer.title = object.title
			outer.style.cssText = `
        padding: 0; margin: 0; border: 0; background: transparent;
        cursor: pointer; display: flex; flex-direction: column;
        align-items: center; gap: 3px;
        z-index: ${selected ? '30' : '1'};
      `

			const bubble = document.createElement('span')
			bubble.className = 'citygo-map-pin-bubble'
			bubble.style.cssText = `
        display: grid; place-items: center;
        width: 34px; height: 34px; border-radius: 12px;
        border: 2.5px solid #ffffff; background: ${object.color};
        box-sizing: border-box; pointer-events: none;
        box-shadow: ${
					selected
						? `0 0 0 5px ${object.color}38, 0 10px 26px rgba(15,23,42,.34)`
						: '0 6px 16px rgba(15,23,42,.24)'
				};
      `
			bubble.innerHTML = glyph(object.symbol ?? object.kind)
			outer.appendChild(bubble)

			let height = 34
			if (object.tag) {
				const tag = document.createElement('span')
				tag.textContent = object.tag
				tag.style.cssText = `
          background: #ffffff; color: #0f172a;
          font: 700 10px/1 var(--font-sans);
          padding: 3px 6px; border-radius: 7px; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15,23,42,.2); pointer-events: none;
        `
				outer.appendChild(tag)
				height += 3 + 16 // gap + approximate tag row height
			}

			outer.addEventListener('click', event => {
				event.preventDefault()
				event.stopPropagation()
				onSelectRef.current?.(object)
			})

			next.push(
				new mapgl.HtmlMarker(map, {
					coordinates: [object.lng, object.lat],
					html: outer,
					anchor: [17, height],
				}),
			)
		}

		markersRef.current = next

		return () => {
			next.forEach(marker => marker.destroy())
			if (markersRef.current === next) markersRef.current = []
		}
	}, [objects, selectedKey, ready])

	const fitted = useRef<string | null>(null)

	// An explicit frame (a route view). Fitted whatever its spread — a route
	// between two cities is still one route — and refitted only when what it
	// has to show changes, so a re-render never moves the camera.
	const frameKey = frame === undefined ? null : `${viewportKey}|${cameraFrameKey(frame)}`
	useEffect(() => {
		const map = mapRef.current
		if (!map || !ready || frame === undefined || frameKey === null) return
		if (!frame || fitted.current === frameKey) return

		fitted.current = frameKey
		map.invalidateSize()
		const padding = { top: 56, left: 56, right: 56, bottom: bottomPadding }
		if (frame.kind === 'point') {
			map.setPadding(padding)
			map.setCenter([frame.center.lng, frame.center.lat])
			map.setZoom(14.5)
			return
		}
		map.fitBounds(frame.bounds, { padding, maxZoom: 14.5, animation: { duration: 0 } })
	}, [frame, frameKey, ready, bottomPadding])

	// Otherwise, frame the first set of objects. Without this the camera opens
	// at a fixed zoom on Tashkent's centre and the pins sit clumped against
	// one edge.
	//
	// Only the first set: re-fitting on every filter change would yank the
	// camera out from under someone who had panned. And only when the set is
	// geographically compact — the parking catalog spans four cities, so
	// fitting all of it renders the Tashkent cluster as one unreadable dot.
	// Same guard ParkingMap makes for the same reason. (A route is not a
	// catalog, which is why a route view passes `frame` instead.)
	useEffect(() => {
		const map = mapRef.current
		if (!map || !ready || frame !== undefined || fitted.current === viewportKey) return
		if (objects.length === 0) return

		fitted.current = viewportKey
		// The container may still have been mid-layout when the map was built;
		// fitBounds against a stale size picks the wrong zoom.
		map.invalidateSize()

		const lats = objects.map(object => object.lat)
		const lngs = objects.map(object => object.lng)
		const spread =
			Math.max(...lats) - Math.min(...lats) > 1.2 ||
			Math.max(...lngs) - Math.min(...lngs) > 1.2

		if (spread) {
			const centre = userLocation ?? TASHKENT_CENTER
			map.setCenter([centre.lng, centre.lat])
			map.setZoom(11.8)
			return
		}
		if (objects.length === 1) {
			const [object] = objects
			map.setPadding({ top: 56, left: 56, right: 56, bottom: bottomPadding })
			map.setCenter([object.lng, object.lat])
			map.setZoom(14.5)
			return
		}

		map.fitBounds(boundsOf(objects), {
			padding: { top: 56, left: 56, right: 56, bottom: bottomPadding },
			maxZoom: 14.5,
			animation: { duration: 0 },
		})
	}, [objects, ready, userLocation, viewportKey, bottomPadding, frame])

	// Selection also arrives from list mode, before the map has mounted.
	useEffect(() => {
		if (!ready || !selectedKey) return
		const selected = objectsRef.current.find(object => mapObjectKey(object) === selectedKey)
		const map = mapRef.current
		if (!selected || !map) return

		map.setPadding({ top: 0, left: 0, right: 0, bottom: Math.max(0, bottomPadding - 56) })
		map.setCenter([selected.lng, selected.lat], { animate: true, duration: 600 })
		map.setZoom(15.5, { animate: true, duration: 600, useHeightForAnimation: true })
	}, [ready, selectedKey, bottomPadding])

	useEffect(() => {
		if (!ready || !locateRevision || !userLocation) return
		const map = mapRef.current
		if (!map) return
		map.setCenter([userLocation.lng, userLocation.lat], { animate: true, duration: 600 })
		map.setZoom(14.5, { animate: true, duration: 600, useHeightForAnimation: true })
	}, [ready, userLocation, locateRevision])

	// Overlay lines (bike lanes, illustrative route/traffic segments) — one
	// Polyline per line, keyed by id, rather than a single shared GeoJSON
	// source: 2GIS's GeoJsonSource styles by flat scalar attributes, not a
	// per-feature paint expression, so per-line color needs either the
	// low-level style-layer API or, far more simply, N Polyline instances —
	// which is all this already-small, discrete line list needs.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current
		if (!map || !mapgl || !ready) return

		// Same id with new coordinates or colour is a new line on screen: 2GIS
		// Polylines cannot be edited, so a changed line is replaced in place.
		const existing = linesRef.current
		const drawn = new Map([...existing].map(([id, line]) => [id, line.signature]))
		const { remove, add } = diffMapLines(drawn, lines)

		for (const id of remove) {
			existing.get(id)?.polyline.destroy()
			existing.delete(id)
		}

		for (const line of add) {
			existing.set(line.id, {
				signature: mapLineSignature(line),
				polyline: new mapgl.Polyline(map, {
					coordinates: line.coordinates,
					color: line.color,
					width: 5,
					...(line.zIndex === undefined ? {} : { zIndex: line.zIndex }),
				}),
			})
		}
	}, [lines, ready])

	// The blue "you are here" dot, kept separate so a filter change never
	// removes it.
	useEffect(() => {
		const map = mapRef.current
		const mapgl = mapglRef.current
		if (!map || !mapgl || !ready) return

		userMarkerRef.current?.destroy()
		userMarkerRef.current = null
		userDotElRef.current = null
		if (!userLocation) return

		const element = document.createElement('div')
		element.className = 'citygo-location-dot'
		element.setAttribute('aria-label', 'Sizning joylashuvingiz')
		element.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: #2e90fa; border: 3px solid #ffffff;
      box-shadow: 0 0 0 6px rgba(46,144,250,.18);
    `
		userDotElRef.current = element

		userMarkerRef.current = new mapgl.HtmlMarker(map, {
			coordinates: [userLocation.lng, userLocation.lat],
			html: element,
			anchor: [8, 8],
		})
	}, [userLocation, ready])

	useEffect(() => {
		if (!ready || !locateRevision || !userLocation) return
		const element = userDotElRef.current
		if (!element) return
		element.classList.remove('is-ping')
		void element.offsetWidth
		element.classList.add('is-ping')
	}, [ready, userLocation, locateRevision])

	useImperativeHandle(
		handleRef,
		() => ({
			flyTo(object: MapObject) {
				const map = mapRef.current
				if (!map) return
				map.setCenter([object.lng, object.lat], { animate: true, duration: 600 })
				map.setZoom(15.5, { animate: true, duration: 600, useHeightForAnimation: true })
			},
			fitAll() {
				const map = mapRef.current
				const list = objectsRef.current
				if (!map || list.length === 0) return

				if (list.length === 1) {
					map.setCenter([list[0].lng, list[0].lat], { animate: true, duration: 500 })
					map.setZoom(15, { animate: true, duration: 500 })
					return
				}

				map.fitBounds(boundsOf(list), {
					padding: { top: 60, left: 60, right: 60, bottom: bottomPadding },
					maxZoom: 15,
					animation: { duration: 550 },
				})
			},
			goToUser() {
				const map = mapRef.current
				if (!map || !userLocation) return
				map.setCenter([userLocation.lng, userLocation.lat], { animate: true, duration: 600 })
				map.setZoom(14.5, { animate: true, duration: 600, useHeightForAnimation: true })
			},
		}),
		[userLocation, bottomPadding],
	)

	return <div className={`relative ${className}`} data-no-ptr>
		<div ref={containerRef} className='citygo-map-root size-full' />
		{failed && <p role='status' className='absolute inset-0 grid place-items-center bg-card-2 p-5 text-center text-sm text-ink-2'>
			Xarita ochilmadi. Obyektlarni ro‘yxatdan tanlashingiz mumkin.
		</p>}
	</div>
}

const EMPTY_LINES: MapLine[] = []

// 2GIS markers are raw DOM, so the pin cannot mount a lucide React
// component. These are the same four lucide shapes the list rows use, written
// out as markup. Fixed strings — nothing here interpolates content.
const GLYPHS: Record<MapSymbol, string> = {
	place: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
	parking: '<circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
	queue:
		'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
	event:
		'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
	transit: '<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M7 19v2M17 19v2"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
	metro: '<rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 10h14M8 17l-3 4M16 17l3 4"/>',
	traffic: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 8v5M12 17h.01"/>',
	bike: '<circle cx="5" cy="17" r="4"/><circle cx="19" cy="17" r="4"/><path d="m5 17 5-9 4 9h5l-4-12h-3M8 8h4"/>',
	food: '<path d="M4 3v7a2 2 0 0 0 4 0V3M6 3v19M20 3c-4 3-4 9 0 9V3v19"/>',
	shops: '<path d="M3 8h18l-2 13H5L3 8ZM8 8V6a4 4 0 0 1 8 0v2"/>',
	health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
	fun: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
	camera: '<path d="M3 7h4l2-3h6l2 3h4v14H3V7Z"/><circle cx="12" cy="13" r="4"/>',
}

function glyph(kind: MapSymbol) {
	return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[kind]}</svg>`
}
