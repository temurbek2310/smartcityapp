import type { QueueCategory, QueueDeskKind } from '@/lib/types'

// One name per intention, in one file, because the same journey was being
// called two or three things depending on which screen you reached it from:
// a car park was «bron qilish» on its card and «band qilish» in the sheet, a
// café offered «Navbat olish» for what is really a takeaway counter, and a
// clinic offered it for what is really a doctor's appointment.
//
// The rules, in the words the product uses:
//   a car park            → «Parking band qilish»        (never «bron»)
//   a table              → «Stol band qilish»
//   food to carry away   → «Olib ketish»
//   a doctor             → «Shifokor qabuliga yozilish»  (never «Navbat olish»)
//   a bank or state desk → «Navbat olish»
//   what a line hands you → «Talon»                      (never «chipta», never «raqam»)
//
// «Joy» is reserved: it is a parking space or a place to sit, never a clinic
// room and never a counter. See DESK_NOUN below.

export const PARKING_BOOK_LABEL = 'Parking band qilish'
export const TABLE_BOOK_LABEL = 'Stol band qilish'
export const TAKEAWAY_LABEL = 'Olib ketish'
export const CLINIC_BOOK_LABEL = 'Shifokor qabuliga yozilish'
export const QUEUE_TAKE_LABEL = 'Navbat olish'
export const TICKET_NOUN = 'Talon'

// The one line a food venue keeps in the queue catalog. Eating in is a table
// booking, not a number, so the takeaway counter is all that is left.
export const TAKEAWAY_SERVICE_ID = 'takeaway'

// Joining a line, named by what the organisation actually does rather than by
// the mechanism behind it.
const QUEUE_ACTION: Record<QueueCategory, string> = {
	cafe: TAKEAWAY_LABEL,
	clinic: CLINIC_BOOK_LABEL,
	bank: QUEUE_TAKE_LABEL,
	gov: QUEUE_TAKE_LABEL,
	auto: QUEUE_TAKE_LABEL,
}

export function queueActionLabel(category: QueueCategory | undefined) {
	return (category && QUEUE_ACTION[category]) ?? QUEUE_TAKE_LABEL
}

// What one of a line's desks is called, by what kind of place it is in. The
// kind alone is not enough: a bank's window is an «oyna», a café's is a
// «kassa», and a workshop's bay is a «boks» — and none of them is a «joy».
const DESK_NOUN: Record<QueueCategory, Record<QueueDeskKind, string>> = {
	cafe: { window: 'Kassa', desk: 'Kassa', specialist: 'Xodim' },
	bank: { window: 'Oyna', desk: 'Xona', specialist: 'Mutaxassis' },
	gov: { window: 'Oyna', desk: 'Xona', specialist: 'Mutaxassis' },
	clinic: { window: 'Oyna', desk: 'Xona', specialist: 'Shifokor' },
	auto: { window: 'Kassa', desk: 'Boks', specialist: 'Usta' },
}

export function deskNoun(
	category: QueueCategory | undefined,
	kind: QueueDeskKind = 'window',
) {
	return (category && DESK_NOUN[category]?.[kind]) ?? DESK_NOUN.bank[kind]
}
