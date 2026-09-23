import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { bookingRows, isOpen } from '@/lib/bookings'
import { routeHref } from '@/lib/navigation'
import { reservationHref } from '@/lib/reservation'
import type { QueueTicket, Reservation, ServiceBooking } from '@/lib/types'

// One booking-detail pattern, one directions flow. These assert the shape of
// the cleanup rather than any one screen: a booking of any kind has a page to
// open, and nothing in the app routes through the deleted /navigate preview.

const reservation: Reservation = {
	id: 'r1', parkingId: 'tashkent-city', userPhone: '+998900000000',
	startAt: '2026-09-20T10:00:00.000Z', endAt: '2026-09-20T12:00:00.000Z',
	durationHours: 2, pricePerHour: 5000, estimatedTotal: 10000,
	status: 'reserved', createdAt: '2026-09-20T09:00:00.000Z',
}

const ticket: QueueTicket = {
	id: 't1', orgId: 'coffee-lab', serviceId: 'table', number: 'A-14',
	position: 3, initialPosition: 5, etaMinutes: 12, initialEtaMinutes: 20,
	windowNumber: 1, notify: true, status: 'waiting',
	createdAt: '2026-09-20T09:00:00.000Z',
}

function serviceBooking(
	id: string,
	kind: ServiceBooking['kind'],
	refId: string,
): ServiceBooking {
	return {
		id, kind, refId, title: refId, subtitle: '2 kishi · 19:00',
		code: `${kind.toUpperCase()}-1`, whenLabel: 'Bugun, 19:00',
		status: 'active', createdAt: '2026-09-20T09:00:00.000Z',
	}
}

const serviceBookings = [
	serviceBooking('s-table', 'table', 'basilic-cafe'),
	serviceBooking('s-cinema', 'cinema', 'cinema-magic'),
	serviceBooking('s-clinic', 'clinic', 'medical-plaza'),
	serviceBooking('s-event', 'event', 'concert'),
]

const rows = bookingRows({
	reservations: [reservation],
	queueTickets: [ticket],
	serviceBookings,
})
const byId = Object.fromEntries(rows.map(row => [row.id, row]))

describe('one booking-detail pattern', () => {
	it('gives every booking a page to open, whatever its kind', () => {
		// The rule the Booking Center relies on: a card is a summary and the
		// page is the booking. Queue tickets and service bookings used to have
		// no href at all — their only detail view was a QR modal in the list.
		for (const row of rows) expect(row.href).toBeTruthy()
	})

	it('keeps parking on its own lifecycle page', () => {
		expect(byId.r1.href).toBe(reservationHref(reservation))
		expect(byId.r1.href).toBe('/reservation/r1')
	})

	it('sends a queue ticket to its own booking, not to the organisation screen', () => {
		expect(byId.t1.href).toBe('/booking/t1')
		expect(byId.t1.href).not.toContain('/queues')
	})

	it.each(serviceBookings.map(booking => [booking.kind, booking.id] as const))(
		'sends a %s booking to its own detail page',
		(_kind, id) => {
			expect(byId[id].href).toBe(`/booking/${id}`)
		},
	)

	it('carries the code and status the page renders', () => {
		for (const row of rows) {
			expect(row.code).toBeTruthy()
			expect(row.statusLabel).toBeTruthy()
		}
		expect(isOpen(byId.t1)).toBe(true)
	})
})

describe('directions from a booking detail', () => {
	it('resolves the exact destination for every supported kind', () => {
		expect(byId.r1.destinationId).toBe('parking:tashkent-city')
		expect(byId.t1.destinationId).toBe('place:coffee-lab')
		expect(byId['s-table'].destinationId).toBe('place:basilic-cafe')
		expect(byId['s-cinema'].destinationId).toBe('place:cinema-magic')
		expect(byId['s-clinic'].destinationId).toBe('place:medical-plaza')
	})

	it('sends every one of them to /transport and nowhere else', () => {
		for (const row of rows) {
			if (!row.destinationId) continue
			const href = routeHref({ destinationId: row.destinationId })
			expect(href.startsWith('/transport?')).toBe(true)
			expect(href).not.toContain('/navigate')
		}
	})
})

// --- The source tree itself ---------------------------------------------
// Cheap, but it is the only way to assert that a deleted route stayed
// deleted and that a removed button did not come back under another caller.

const SRC = join(process.cwd(), 'src')

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap(entry => {
		const path = join(dir, entry)
		if (statSync(path).isDirectory()) return sourceFiles(path)
		return /\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : []
	})
}

const sources = sourceFiles(SRC).map(path => ({
	path: path.slice(SRC.length + 1).replace(/\\/g, '/'),
	text: readFileSync(path, 'utf8'),
}))

describe('the removed /navigate preview', () => {
	it('has no route left in the app directory', () => {
		expect(sources.some(file => file.path.includes('app/(app)/navigate/'))).toBe(
			false,
		)
	})

	it('is linked from nowhere', () => {
		const linking = sources.filter(file => /['"`]\/navigate\//.test(file.text))
		expect(linking.map(file => file.path)).toEqual([])
	})
})

describe('the standardized directions sheet', () => {
	const sheet = sources.find(
		file => file.path === 'components/navigation/directions-sheet.tsx',
	)!

	it('is the only directions sheet in the tree', () => {
		expect(sheet).toBeDefined()
		expect(
			sources.filter(file => file.path.endsWith('directions-sheet.tsx')),
		).toHaveLength(1)
	})

	it('offers viewing the route and starting navigation, and nothing else', () => {
		expect(sheet.text).toContain('Marshrutni ko‘rish')
		expect(sheet.text).toContain('Navigatsiyani boshlash')
		// The old wording: the customer views a route B SPACE calculated, they
		// do not construct one.
		expect(sheet.text).not.toContain('Marshrut qurish')
	})

	it('has no «Xaritada ko‘rish» branch anywhere in the flow', () => {
		// Two unrelated screens keep the words — /map's list/map toggle and an
		// AI tip that highlights a lot on the Home map. Neither is a way out of
		// the directions sheet, which no longer has a third door.
		const allowed = ['app/(app)/map/page.tsx', 'data/home-content.ts']
		const offenders = sources.filter(file => file.text.includes('Xaritada ko‘rish'))
		expect(offenders.map(file => file.path).sort()).toEqual(allowed.sort())
	})
})

describe('Home no longer plans trips', () => {
	const home = sources.find(file => file.path === 'app/(app)/home/page.tsx')!

	it('does not render the four transport modes', () => {
		// Choosing how to travel belongs on /transport, after a destination
		// exists. Home starts from a place and a «Yo‘nalish».
		expect(home.text).not.toContain('TRANSPORT_MODES')
	})

	it('still offers directions and the shared destination picker', () => {
		expect(home.text).toContain('Yo‘nalish')
		expect(home.text).toContain('DirectionsSheet')
		expect(home.text).toContain('DestinationSheet')
	})
})

describe('the transport modes themselves', () => {
	it('still live on /transport', () => {
		const transport = sources.find(
			file => file.path === 'app/(app)/transport/page.tsx',
		)!
		expect(transport.text).toContain('TransportModeSelector')
	})
})
