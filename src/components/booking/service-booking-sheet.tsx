'use client'

import { Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { getPlace } from '@/data/places'
import {
	SERVICE_CONFLICT_MESSAGE,
	findConflictingServiceBooking,
} from '@/lib/booking-conflicts'
import { serviceBookingDraft, serviceBookingHref } from '@/lib/bookings'
import { tashkentDayKey } from '@/lib/format'
import {
	bookingDays,
	daySlots,
	defaultBookingSelection,
	resolveSlotTime,
	SAME_DAY_DEFAULT_SLOT,
	SAME_DAY_SLOTS,
	serviceWhenLabel,
	slotInstant,
} from '@/lib/service-slots'
import type { ServiceBookingKind } from '@/lib/types'

// Tables, cinema seats, clinic slots and event tickets. Parking and queues
// have their own flows because they have their own lifecycles; these four
// only need a time, a count and a confirmation, so one sheet covers them.
//
// Home already had this UI, but it ended in a toast and stored nothing —
// the booking never existed. It writes a real ServiceBooking now, which is
// why it shows up in the Booking Center.
//
// Tables also pick a day. A restaurant reservation is the one of the four a
// customer routinely makes for tomorrow, and the fixed «Bugun» list left the
// evening crowd choosing between eight times that had all gone by. Cinema,
// clinic and event keep the same-day list they have always had: their slots
// come from a schedule this sheet does not know about, and inventing a week
// of them would promise showings that do not exist. The date/time model in
// lib/service-slots is ready for them the day that schedule arrives. Their
// same-day list is still read against Tashkent's clock, though: a showing at
// 12:30 cannot be booked at 21:00.

const COPY: Record<
	ServiceBookingKind,
	{ title: string; countLabel: string; unit: string; confirm: string }
> = {
	table: {
		title: 'Stol bron qilish',
		countLabel: 'Mehmonlar',
		unit: 'kishi',
		confirm: 'Stolni bron qilish',
	},
	cinema: {
		title: 'Kino chiptasi',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
	},
	clinic: {
		title: 'Klinikaga yozilish',
		countLabel: 'Bemorlar',
		unit: 'kishi',
		confirm: 'Qabulga yozilish',
	},
	event: {
		title: 'Tadbirga bron',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
	},
}

export function ServiceBookingSheet({
	kind,
	refId,
	venueName,
	onClose,
	onNotify,
}: {
	kind: ServiceBookingKind
	// A place or an event id — whatever the card that opened this refers to.
	refId: string
	venueName?: string
	onClose: () => void
	onNotify: (message: string) => void
}) {
	const router = useRouter()
	const { createServiceBooking, serviceBookings } = useApp()
	const dated = kind === 'table'
	// Two taps can both land before the sheet unmounts; only a ref is already
	// set by the time the second handler runs. The store refuses the second
	// booking as a duplicate anyway — this keeps it from reading as an error.
	const submittingRef = useRef(false)

	// Read once, so the grid does not reshuffle under a thumb while the sheet
	// is open. Confirm re-reads the real clock and refreshes this if the
	// chosen slot has gone by in the meantime.
	const [now, setNow] = useState(() => Date.now())
	const [selection, setSelection] = useState(() => defaultBookingSelection(now))
	// null once every one of today's times has gone by.
	const [slot, setSlot] = useState(() =>
		resolveSlotTime(tashkentDayKey(now), SAME_DAY_DEFAULT_SLOT, now, SAME_DAY_SLOTS),
	)
	const [count, setCount] = useState(2)

	const days = useMemo(() => bookingDays(now), [now])
	const slots = useMemo(
		() => daySlots(selection.dayKey, now),
		[selection.dayKey, now],
	)
	const todayKey = tashkentDayKey(now)
	const todaySlots = useMemo(() => daySlots(todayKey, now, SAME_DAY_SLOTS), [todayKey, now])

	const copy = COPY[kind]
	const place = getPlace(refId)
	const title = venueName ?? place?.title ?? copy.title
	// Every service booking still points at somewhere to park, which is the
	// whole reason this app is the one making the booking.
	const parking = place?.parkingId ? getParking(place.parkingId) : undefined

	// The instant being booked, for both shapes of the sheet: a table's chosen
	// day and time, or today at one of the fixed slots.
	const startAt = dated
		? selection.time
			? slotInstant(selection.dayKey, selection.time)
			: null
		: slot
			? slotInstant(todayKey, slot)
			: null

	const whenLabel = startAt ? serviceWhenLabel(startAt, now) : '—'

	// The live booking the customer already holds for this venue at this
	// time, shown before they reach for the button. It is only the early
	// warning: createServiceBooking() applies the same rule when it stores.
	const conflict = startAt
		? findConflictingServiceBooking(serviceBookings, {
				kind,
				refId,
				startAt: startAt.toISOString(),
			})
		: undefined

	// Moving to another day must not carry a time that day cannot honour —
	// coming back to today from tomorrow is exactly where an already-passed
	// slot would otherwise stay selected and be booked.
	function selectDay(dayKey: string) {
		setSelection(current => ({
			dayKey,
			time: resolveSlotTime(dayKey, current.time, now),
		}))
	}

	function confirm() {
		if (submittingRef.current) return
		if (!startAt) return onNotify('Bu kunda bo‘sh vaqt qolmadi')
		if (conflict) return onNotify(SERVICE_CONFLICT_MESSAGE[kind])

		// The clock moved on while the sheet was open: re-pick against the
		// real time and let the customer see the new choice before it is
		// stored, rather than booking a table for a time that has passed.
		const currentTime = Date.now()
		if (startAt.getTime() <= currentTime) {
			setNow(currentTime)
			if (dated) {
				const time = resolveSlotTime(selection.dayKey, selection.time, currentTime)
				setSelection(current => ({ ...current, time }))
			} else {
				setSlot(resolveSlotTime(tashkentDayKey(currentTime), slot, currentTime, SAME_DAY_SLOTS))
			}
			return onNotify('Bu vaqt o‘tib ketdi — boshqasini tanlang')
		}

		submittingRef.current = true
		const attempt = createServiceBooking(
			serviceBookingDraft({
				kind,
				// The venue this sheet was opened on, never a default: the
				// generic shortcut asks which restaurant precisely so this is
				// the one the customer chose.
				refId,
				title,
				count,
				unit: copy.unit,
				startAt,
				now,
			}),
		)
		if (!attempt.ok) {
			// Booked from somewhere else since this render. The notice below
			// picks it up from the store on the next render.
			submittingRef.current = false
			return onNotify(SERVICE_CONFLICT_MESSAGE[kind])
		}
		// Straight to the booking itself, the way parking lands on its
		// reservation: the page is the confirmation. A toast on the screen
		// being left would be gone before it could be read.
		onClose()
		router.push(serviceBookingHref(attempt.created.id))
	}

	return (
		<BottomSheet title={copy.title} onClose={onClose}>
			<Card>
				<p className='text-[15px] font-extrabold text-ink'>{title}</p>
				{place && (
					<p className='mt-1 text-[12px] text-ink-3'>{place.address}</p>
				)}
			</Card>

			{dated && (
				<Card className='mt-3'>
					<p className='text-[14px] font-bold text-ink'>Sana</p>
					<HorizontalRail className='mt-3 gap-2'>
						{days.map(day => (
							<Chip
								key={day.key}
								active={selection.dayKey === day.key}
								onClick={() => selectDay(day.key)}
							>
								{day.label}
							</Chip>
						))}
					</HorizontalRail>
				</Card>
			)}

			<Card className='mt-3'>
				<p className='text-[14px] font-bold text-ink'>Vaqt</p>
				<div className='mt-3 grid grid-cols-4 gap-2'>
					{dated
						? slots.map(option => (
								<Chip
									key={option.time}
									active={selection.time === option.time}
									// A time that has gone by stays on screen rather than
									// vanishing, so the grid keeps its shape as the day
									// wears on and it is obvious why it cannot be picked.
									disabled={option.past}
									onClick={() =>
										setSelection(current => ({
											...current,
											time: option.time,
										}))
									}
									className='justify-center disabled:cursor-not-allowed disabled:opacity-40'
								>
									{option.time}
								</Chip>
							))
						: todaySlots.map(option => (
								<Chip
									key={option.time}
									active={slot === option.time}
									disabled={option.past}
									onClick={() => setSlot(option.time)}
									className='justify-center disabled:cursor-not-allowed disabled:opacity-40'
								>
									{option.time}
								</Chip>
							))}
				</div>
				{dated && !selection.time && (
					<p className='mt-3 text-[11.5px] text-ink-3'>
						Bugungi vaqtlar tugadi. Boshqa kunni tanlang.
					</p>
				)}
				{!dated && !slot && (
					<p className='mt-3 text-[11.5px] text-ink-3'>
						Bugungi vaqtlar tugadi.
					</p>
				)}
			</Card>

			<Card className='mt-3'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-[14px] font-bold text-ink'>{copy.countLabel}</p>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							aria-label='Kamaytirish'
							onClick={() => setCount(Math.max(1, count - 1))}
							className='grid size-10 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Minus className='size-4' />
						</button>
						<strong className='min-w-10 text-center text-[17px] font-black text-ink'>
							{count}
						</strong>
						<button
							type='button'
							aria-label='Ko‘paytirish'
							onClick={() => setCount(Math.min(12, count + 1))}
							className='grid size-10 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Plus className='size-4' />
						</button>
					</div>
				</div>
			</Card>

			<Card className='mt-3'>
				<KeyValueList>
					<KeyValue label='Vaqt' value={whenLabel} />
					<KeyValue label={copy.countLabel} value={`${count} ${copy.unit}`} />
					{parking && <KeyValue label='Yaqin parking' value={parking.name} />}
					<KeyValue label='Joyni ushlab turamiz' value='15 daqiqa' />
				</KeyValueList>
			</Card>

			{conflict && (
				<Card className='mt-3 bg-warn-bg'>
					<p className='text-[13px] font-bold text-ink'>
						{SERVICE_CONFLICT_MESSAGE[kind]}
					</p>
					<p className='mt-1 text-[11.5px] text-ink-3'>
						{conflict.code} · boshqa vaqtni tanlang yoki bronni oching.
					</p>
					<Button
						variant='outline'
						block
						className='mt-3'
						onClick={() => {
							onClose()
							router.push(serviceBookingHref(conflict.id))
						}}
					>
						Bronni ko‘rish
					</Button>
				</Card>
			)}

			<Button
				variant='primary'
				block
				className='mt-4'
				disabled={!startAt || Boolean(conflict)}
				onClick={confirm}
			>
				{startAt ? copy.confirm : 'Vaqtni tanlang'}
			</Button>
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				Bir soat oldin bepul bekor qilish mumkin
			</p>
		</BottomSheet>
	)
}
