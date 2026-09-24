import { describe, expect, it } from 'vitest'

import { UZBEKISTAN_BOUNDS } from '@/lib/geo'
import type { MapLine } from '@/lib/home-map'
import {
	boundsOfPoints,
	cameraFrameKey,
	diffMapLines,
	mapLineSignature,
	routeFrame,
} from '@/lib/map-geometry'

const AMIR_TEMUR = { lat: 41.31108, lng: 69.27968 }
const HUMO_ARENA = { lat: 41.33983, lng: 69.21938 }
const SAMARKAND = { lat: 39.6542, lng: 66.9597 }

describe('boundsOfPoints', () => {
	it('spans every point, as [lng, lat] corners', () => {
		expect(boundsOfPoints([AMIR_TEMUR, HUMO_ARENA])).toEqual({
			southWest: [69.21938, 41.31108],
			northEast: [69.27968, 41.33983],
		})
	})

	it('is null with nothing usable', () => {
		expect(boundsOfPoints([])).toBeNull()
		expect(boundsOfPoints([{ lat: NaN, lng: 69 }])).toBeNull()
	})

	it('pulls stray points to the Uzbekistan border', () => {
		const bounds = boundsOfPoints([AMIR_TEMUR, { lat: 55.75, lng: 37.62 }])!
		expect(bounds.southWest[0]).toBe(UZBEKISTAN_BOUNDS.west)
		expect(bounds.northEast[1]).toBe(UZBEKISTAN_BOUNDS.north)
	})
})

describe('routeFrame', () => {
	it('includes both ends even with no line', () => {
		expect(routeFrame({ origin: AMIR_TEMUR, destination: HUMO_ARENA })).toEqual({
			kind: 'bounds',
			bounds: { southWest: [69.21938, 41.31108], northEast: [69.27968, 41.33983] },
		})
	})

	it('includes a curved route that bulges past both ends', () => {
		const bulge: [number, number][] = [[69.27968, 41.31108], [69.30, 41.36], [69.21938, 41.33983]]
		const frame = routeFrame({ origin: AMIR_TEMUR, destination: HUMO_ARENA, lines: [{ coordinates: bulge }] })
		expect(frame).toEqual({
			kind: 'bounds',
			bounds: { southWest: [69.21938, 41.31108], northEast: [69.3, 41.36] },
		})
	})

	it('includes the ends when the line stops short of them', () => {
		const shortLine: [number, number][] = [[69.25, 41.32], [69.24, 41.33]]
		const frame = routeFrame({ origin: AMIR_TEMUR, destination: HUMO_ARENA, lines: [{ coordinates: shortLine }] })
		expect(frame?.kind === 'bounds' && frame.bounds).toEqual({
			southWest: [69.21938, 41.31108],
			northEast: [69.27968, 41.33983],
		})
	})

	it('frames a short local route', () => {
		const next = { lat: AMIR_TEMUR.lat + 0.002, lng: AMIR_TEMUR.lng + 0.002 }
		expect(routeFrame({ origin: AMIR_TEMUR, destination: next })?.kind).toBe('bounds')
	})

	it('centres on a destination alone, or on two ends in the same spot', () => {
		expect(routeFrame({ destination: HUMO_ARENA })).toEqual({ kind: 'point', center: HUMO_ARENA })
		expect(routeFrame({ origin: HUMO_ARENA, destination: HUMO_ARENA })).toEqual({
			kind: 'point',
			center: HUMO_ARENA,
		})
	})

	it('is null with nothing to show', () => {
		expect(routeFrame({})).toBeNull()
	})

	// The old object fit gave up past 1.2° and parked the camera on Tashkent.
	it('frames an intercity route instead of refusing', () => {
		const frame = routeFrame({ origin: AMIR_TEMUR, destination: SAMARKAND })
		expect(frame).toEqual({
			kind: 'bounds',
			bounds: { southWest: [66.9597, 39.6542], northEast: [69.27968, 41.31108] },
		})
	})

	it('keys identical frames identically, and different ones differently', () => {
		const a = routeFrame({ origin: AMIR_TEMUR, destination: HUMO_ARENA })
		const b = routeFrame({ origin: { ...AMIR_TEMUR }, destination: { ...HUMO_ARENA } })
		expect(cameraFrameKey(a)).toBe(cameraFrameKey(b))
		expect(cameraFrameKey(a)).not.toBe(cameraFrameKey(routeFrame({ origin: AMIR_TEMUR, destination: SAMARKAND })))
		expect(cameraFrameKey(null)).toBe('')
	})
})

describe('diffMapLines', () => {
	const line = (id: string, color: string, coordinates: [number, number][]): MapLine => ({ id, color, coordinates })
	const drawn = (lines: MapLine[]) => new Map(lines.map(item => [item.id, mapLineSignature(item)]))
	const A = line('route', '#6c47e0', [[69.1, 41.1], [69.2, 41.2]])

	it('leaves unchanged lines alone', () => {
		expect(diffMapLines(drawn([A]), [{ ...A, coordinates: [...A.coordinates] }])).toEqual({ remove: [], add: [] })
	})

	it('redraws the same id with new coordinates', () => {
		const moved = { ...A, coordinates: [[69.1, 41.1], [69.3, 41.3]] as [number, number][] }
		expect(diffMapLines(drawn([A]), [moved])).toEqual({ remove: ['route'], add: [moved] })
	})

	it('redraws the same id with a new colour', () => {
		const recoloured = { ...A, color: '#12b76a' }
		expect(diffMapLines(drawn([A]), [recoloured])).toEqual({ remove: ['route'], add: [recoloured] })
	})

	it('adds new lines and removes hidden ones', () => {
		const B = line('other', '#f79009', [[69, 41], [69.5, 41.5]])
		expect(diffMapLines(drawn([A]), [B])).toEqual({ remove: ['route'], add: [B] })
		expect(diffMapLines(new Map(), [A])).toEqual({ remove: [], add: [A] })
		expect(diffMapLines(drawn([A]), [])).toEqual({ remove: ['route'], add: [] })
	})
})
