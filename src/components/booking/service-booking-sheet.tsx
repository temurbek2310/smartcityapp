'use client'

import {
	CalendarClock,
	Check,
	Clapperboard,
	Minus,
	Plus,
	Stethoscope,
	Ticket,
	Utensils,
	type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { TableParkingOffer } from '@/components/booking/table-parking-offer'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { SegmentedTabs } from '@/components/ui/segmented-tabs'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { getPlace, tableSeatingAreas } from '@/data/places'
import {
	SERVICE_CONFLICT_MESSAGE,
	findConflictingServiceBooking,
} from '@/lib/booking-conflicts'
import {
	expectedEndAt,
	FALLBACK_SERVICE_DURATION_MINUTES,
} from '@/lib/booking-lifecycle'
import { serviceBookingDraft, serviceBookingHref } from '@/lib/bookings'
import { formatTime, tashkentDayKey } from '@/lib/format'
import { CLINIC_BOOK_LABEL, TABLE_BOOK_LABEL } from '@/lib/lexicon'
import {
	bookingDays,
	daySlots,
	DEFAULT_TABLE_DURATION,
	defaultBookingSelection,
	durationLabel,
	resolveSlotTime,
	SAME_DAY_DEFAULT_SLOT,
	SAME_DAY_SLOTS,
	serviceWhenLabel,
	slotInstant,
	TABLE_DURATIONS,
} from '@/lib/service-slots'
import type { ServiceBooking, ServiceBookingKind } from '@/lib/types'

// Tables, cinema seats, clinic slots and event tickets. Parking and queues
// have their own flows because they have their own lifecycles; these four
// only need a time, a count and a confirmation, so one sheet covers them.
//
// Laid out the way the parking sheet is — venue, then when, then how long
// and where, then one summary and one button — so booking a table and booking
// the space beside it read as the same product.
//
// Tables also pick a day, a duration and, where the venue has more than one,
// a seating area. A restaurant reservation is the one of the four a customer
// routinely makes for tomorrow and for a length of their own choosing.
// Cinema, clinic and event keep the same-day list they have always had: their
// slots come from a schedule this sheet does not know about, and inventing a
// week of them would promise showings that do not exist. Their duration is
// the lifecycle default, stored so the booking never leans on a fallback.

const COPY: Record<
	ServiceBookingKind,
	{
		title: string
		countLabel: string
		unit: string
		confirm: string
		// What the confirmation says it did, and the way back to it: the
		// sheet used to report «Stol muvaffaqiyatli band qilindi» whatever
		// the customer had actually booked.
		done: string
		view: string
		icon: LucideIcon
	}
> = {
	table: {
		title: TABLE_BOOK_LABEL,
		countLabel: 'Mehmonlar',
		unit: 'kishi',
		confirm: 'Stolni band qilish',
		done: 'Stol band qilindi!',
		view: 'Stol bandligini ko‘rish',
		icon: Utensils,
	},
	cinema: {
		title: 'Kino chiptasi',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
		done: 'Chipta olindi!',
		view: 'Chiptani ko‘rish',
		icon: Clapperboard,
	},
	clinic: {
		title: CLINIC_BOOK_LABEL,
		countLabel: 'Bemorlar',
		unit: 'kishi',
		confirm: 'Qabulga yozilish',
		done: 'Qabulga yozildingiz!',
		view: 'Yozuvni ko‘rish',
		icon: Stethoscope,
	},
	event: {
		title: 'Tadbir chiptasi',
		countLabel: 'Chiptalar',
		unit: 'ta',
		confirm: 'Chiptani olish',
		done: 'Chipta olindi!',
		view: 'Chiptani ko‘rish',
		icon: Ticket,
	},
}

const DURATION_TABS = TABLE_DURATIONS.map(minutes => ({
	id: String(minutes),
	label: durationLabel(minutes),
}))

const MINUTE = 60_000

// «Bugun, 19:30–21:30», read back off what the store kept.
function bookedWhenLabel(booking: ServiceBooking) {
	if (!booking.startAt) return booking.whenLabel
	const end = expectedEndAt(booking)
	const when = serviceWhenLabel(booking.startAt)
	return end === null ? when : `${when}–${formatTime(end)}`
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
	// The table just stored, once confirm succeeds — the sheet then shows its
	// success view instead of the form.
	const [booked, setBooked] = useState<ServiceBooking | null>(null)

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

	const copy = COPY[kind]
	const place = getPlace(refId)
	const title = venueName ?? place?.title ?? copy.title
	// Every service booking still points at somewhere to park, which is the
	// whole reason this app is the one making the booking.
	const parking = place?.parkingId ? getParking(place.parkingId) : undefined

	// A venue with one room gets no picker — its main hall is simply where
	// the table is, and says so in the summary.
	const seatingAreas = dated ? tableSeatingAreas(place) : []
	const [seating, setSeating] = useState(() => seatingAreas[0])
	const [duration, setDuration] = useState(DEFAULT_TABLE_DURATION)
	const durationMinutes = dated ? duration : FALLBACK_SERVICE_DURATION_MINUTES[kind]

	const days = useMemo(() => bookingDays(now), [now])
	const slots = useMemo(
		() => daySlots(selection.dayKey, now),
		[selection.dayKey, now],
	)
	const todayKey = tashkentDayKey(now)
	const todaySlots = useMemo(() => daySlots(todayKey, now, SAME_DAY_SLOTS), [todayKey, now])

	// The instant being booked, for both shapes of the sheet: a table's chosen
	// day and time, or today at one of the fixed slots.
	const startAt = dated
		? selection.time
			? slotInstant(selection.dayKey, selection.time)
			: null
		: slot
			? slotInstant(todayKey, slot)
			: null

	// «Bugun, 19:30–21:30» for a table, whose end is the customer's own
	// choice; the other kinds show their start alone.
	const whenLabel = startAt
		? dated
			? `${serviceWhenLabel(startAt, now)}–${formatTime(startAt.getTime() + durationMinutes * MINUTE)}`
			: serviceWhenLabel(startAt, now)
		: '—'

	// The live booking the customer already holds for this venue across the
	// span asked for, shown before they reach for the button. It is only the
	// early warning: createServiceBooking() applies the same rule when it
	// stores.
	const conflict = startAt
		? findConflictingServiceBooking(serviceBookings, {
				kind,
				refId,
				startAt: startAt.toISOString(),
				durationMinutes,
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
				durationMinutes,
				seatingArea: dated ? seating : undefined,
				now,
			}),
		)
		if (!attempt.ok) {
			// Booked from somewhere else since this render. The notice below
			// picks it up from the store on the next render.
			submittingRef.current = false
			return onNotify(SERVICE_CONFLICT_MESSAGE[kind])
		}
		// A table stays in the sheet for one more step: the success view,
		// where the space beside it is one tap away.
		if (dated) return setBooked(attempt.created)
		// Straight to the booking itself, the way parking lands on its
		// reservation: the page is the confirmation. A toast on the screen
		// being left would be gone before it could be read.
		onClose()
		router.push(serviceBookingHref(attempt.created.id))
	}

	if (booked) {
		return (
			<BottomSheet title='Bron tasdiqlandi' onClose={onClose}>
				<div className='flex flex-col items-center pt-2 text-center'>
					<span className='grid size-14 place-items-center rounded-full bg-ok-bg text-ok'>
						<Check className='size-7' strokeWidth={2.5} />
					</span>
					<p className='mt-3 text-[17px] font-black text-ink'>
						{COPY[booked.kind].done}
					</p>
					<p className='mt-1 text-xs text-ink-3'>
						{booked.title} · {bookedWhenLabel(booked)}
					</p>
					<p className='mt-0.5 text-[11.5px] text-ink-3'>Bron kodi · {booked.code}</p>
				</div>

				<TableParkingOffer booking={booked} onClose={onClose} onNotify={onNotify} />

				<Button
					variant='outline'
					block
					className='mt-2'
					onClick={() => {
						onClose()
						router.push(serviceBookingHref(booked.id))
					}}
				>
					{COPY[booked.kind].view}
				</Button>
			</BottomSheet>
		)
	}

	const Icon = copy.icon

	return (
		<BottomSheet title={copy.title} onClose={onClose}>
			<Card>
				<div className='flex items-center gap-3'>
					<IconTile size={48} tone='bg-ink text-white'>
						<Icon className='size-5' strokeWidth={2} />
					</IconTile>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-sm font-black text-ink'>{title}</p>
						{place && (
							<p className='mt-1 truncate text-xs text-ink-3'>{place.address}</p>
						)}
					</div>
				</div>
			</Card>

			{dated && (
				<Card className='mt-3 p-4'>
					<p className='text-sm font-black text-ink'>Sana</p>
					<HorizontalRail className='mt-3 gap-2'>
						{days.map(day => (
							<Chip
								key={day.key}
								active={selection.dayKey === day.key}
								onClick={() => selectDay(day.key)}
								className='h-11 px-4'
							>
								{day.label}
							</Chip>
						))}
					</HorizontalRail>
				</Card>
			)}

			<Card className='mt-3 p-4'>
				<p className='text-sm font-black text-ink'>Vaqt</p>
				<div className='mt-3 grid grid-cols-4 gap-2'>
					{(dated ? slots : todaySlots).map(option => (
						<Chip
							key={option.time}
							active={(dated ? selection.time : slot) === option.time}
							// A time that has gone by stays on screen rather than
							// vanishing, so the grid keeps its shape as the day
							// wears on and it is obvious why it cannot be picked.
							disabled={option.past}
							onClick={() =>
								dated
									? setSelection(current => ({ ...current, time: option.time }))
									: setSlot(option.time)
							}
							className='h-11 justify-center disabled:cursor-not-allowed disabled:opacity-40'
						>
							{option.time}
						</Chip>
					))}
				</div>
				{!startAt && (
					<p className='mt-3 text-[11.5px] text-ink-3'>
						{dated
							? 'Bugungi vaqtlar tugadi. Boshqa kunni tanlang.'
							: 'Bugungi vaqtlar tugadi.'}
					</p>
				)}
			</Card>

			{dated && (
				<Card className='mt-3 p-4'>
					<p className='text-sm font-black text-ink'>Davomiyligi</p>
					<SegmentedTabs
						className='mt-3'
						items={DURATION_TABS}
						value={String(duration)}
						onChange={next => setDuration(Number(next))}
					/>
				</Card>
			)}

			{seatingAreas.length > 1 && (
				<Card className='mt-3 p-4'>
					<p className='text-sm font-black text-ink'>Joy</p>
					<HorizontalRail className='mt-3 gap-2'>
						{seatingAreas.map(area => (
							<Chip
								key={area}
								active={seating === area}
								onClick={() => setSeating(area)}
								className='h-11 px-4'
							>
								{area}
							</Chip>
						))}
					</HorizontalRail>
				</Card>
			)}

			<Card className='mt-3 p-4'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-sm font-black text-ink'>{copy.countLabel}</p>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							aria-label='Kamaytirish'
							onClick={() => setCount(Math.max(1, count - 1))}
							className='grid size-11 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Minus className='size-5' />
						</button>
						<strong className='min-w-12 text-center text-lg font-black text-ink'>
							{count}
						</strong>
						<button
							type='button'
							aria-label='Ko‘paytirish'
							onClick={() => setCount(Math.min(12, count + 1))}
							className='grid size-11 place-items-center rounded-xl bg-card-2 text-ink'
						>
							<Plus className='size-5' />
						</button>
					</div>
				</div>
			</Card>

			<Card className='mt-3 px-4 py-1'>
				<KeyValueList>
					<KeyValue label='Vaqt' value={whenLabel} />
					{dated && <KeyValue label='Davomiyligi' value={durationLabel(duration)} />}
					{dated && seating && <KeyValue label='Joy' value={seating} />}
					<KeyValue label={copy.countLabel} value={`${count} ${copy.unit}`} />
					{parking && <KeyValue label='Yaqin parking' value={parking.name} />}
					<KeyValue label='Joyni ushlab turamiz' value='15 daqiqa' />
					{dated && (
						<KeyValue
							label='Jami'
							value={<span className='text-lg font-black text-ink'>Bepul</span>}
							className='items-center'
						/>
					)}
				</KeyValueList>
			</Card>

			{conflict && (
				<div className='mt-3 rounded-card-lg bg-warn-bg p-4'>
					<div className='flex items-start gap-3'>
						<CalendarClock className='mt-0.5 size-4 shrink-0 text-warn' />
						<div className='min-w-0 flex-1'>
							<p className='text-[13px] font-black text-ink'>
								{SERVICE_CONFLICT_MESSAGE[kind]}
							</p>
							<p className='mt-1 text-[11.5px] leading-5 text-ink-2'>
								{conflict.code} · boshqa vaqtni tanlang yoki bronni oching.
							</p>
						</div>
					</div>
					<Button
						variant='outline'
						block
						className='mt-3 h-10'
						onClick={() => {
							onClose()
							router.push(serviceBookingHref(conflict.id))
						}}
					>
						Bronni ko‘rish
					</Button>
				</div>
			)}

			<Button
				variant='primary'
				block
				className='mt-4 h-13'
				disabled={!startAt || Boolean(conflict)}
				onClick={confirm}
			>
				{conflict ? 'Vaqt band' : startAt ? copy.confirm : 'Vaqtni tanlang'}
			</Button>
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				Bir soat oldin bepul bekor qilish mumkin
			</p>
		</BottomSheet>
	)
}
