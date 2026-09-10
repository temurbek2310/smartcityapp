// Bay/level chosen in the booking sheet. The Reservation model has no place
// for it, so it is kept alongside the reservation under its own key — this
// is booking data, never favorites data. Written by the booking sheet and
// read by the Bron page, through this one helper rather than each side
// reaching into localStorage itself.
export type ParkingBookingMeta = {
	bay: string
	level: number
	holdMinutes: number
}

const keyFor = (reservationId: string) => `citygoo-parking-meta-${reservationId}`

export function saveBookingMeta(
	reservationId: string,
	meta: ParkingBookingMeta,
) {
	try {
		window.localStorage.setItem(keyFor(reservationId), JSON.stringify(meta))
	} catch {
		// The reservation itself stays valid without this extra detail.
	}
}

export function readBookingMeta(
	reservationId: string,
): ParkingBookingMeta | null {
	try {
		const raw = window.localStorage.getItem(keyFor(reservationId))
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<ParkingBookingMeta>
		if (typeof parsed?.bay !== 'string' || typeof parsed?.level !== 'number') {
			return null
		}
		return {
			bay: parsed.bay,
			level: parsed.level,
			holdMinutes:
				typeof parsed.holdMinutes === 'number' ? parsed.holdMinutes : 15,
		}
	} catch {
		return null
	}
}
