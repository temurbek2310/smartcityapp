'use client'

import { CalendarClock, CircleParking, Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'
import { BayGrid } from '@/components/parking/bay-grid'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { bayMap, firstFreeBay, isBaySelectable } from '@/lib/bay-map'
import { saveBookingMeta } from '@/lib/booking-meta'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { formatTime, formatUZS } from '@/lib/format'
import { PARKING_BOOK_LABEL } from '@/lib/lexicon'
import {
	isParkingStartPast,
	PARKING_ARRIVAL_SLOTS,
	PARKING_NOW_SLOT,
	parkingBookingDays,
	parkingBookingWindow,
} from '@/lib/parking-time'
import type { BookingDay } from '@/lib/service-slots'
import {
	findLiveReservationForParking,
	findOverlappingReservation,
	reservationHref,
} from '@/lib/reservation'

// The one parking booking UI in the app. It used to live inline in Home
// and duplicated an older standalone /reserve/[id] form; both are gone and
// every "Band qilish" entry point (Home cards, Home AI tip, Home services,
// Favorites, Transport destination card and notice, parking detail) opens
// this sheet. The UI layer only — reservations are still created by
// SmartCity's own createReservation().

export type ParkingBookingDraft = {
	parkingId: string
	// A Tashkent calendar day key, one of `days`.
	dayKey: string
	days: BookingDay[]
	slot: string
	hours: number
	bay: string
	level: number
	// When the sheet opened. The day chips and «Hozir» are read against it so
	// they hold still while the sheet is open; confirm re-reads the clock.
	now: number
}

function makeDraft(
	parkingId: string,
	initialBay?: string | null,
	initialLevel?: number,
): ParkingBookingDraft {
	const now = Date.now()
	const days = parkingBookingDays(now)
	const parking = PARKINGS.find(item => item.id === parkingId)!
	const level = initialLevel && Number.isInteger(initialLevel) && initialLevel > 0 && initialLevel <= parking.levels
		? initialLevel : 1
	const candidate = bayMap(parking, level).bays.find(bay => bay.id === initialBay)

	return {
		parkingId,
		dayKey: days[0].key,
		days,
		slot: PARKING_NOW_SLOT,
		hours: 2,
		// The detail screen's floor plan is the same plan this sheet shows, so
		// a bay picked there carries straight through instead of being reset.
		level,
		bay: candidate && isBaySelectable(candidate.state) ? candidate.id : firstFreeBay(parking, level) ?? '',
		now,
	}
}

// The window this draft occupies, on Tashkent's clock — never the device's.
function bookingWindow(draft: ParkingBookingDraft, now: number = draft.now) {
	return parkingBookingWindow({
		dayKey: draft.dayKey,
		time: draft.slot,
		hours: draft.hours,
		now,
	})
}

type ParkingBookingSheetProps = {
	// The parking to book, or null while the sheet is closed. Every value in
	// the sheet is read from this parking — nothing is hardcoded.
	parkingId: string | null
	// Carried in from the parking detail screen when the user picked a bay on
	// its floor plan before tapping through.
	initialBay?: string | null
	initialLevel?: number
	onClose: () => void
	// Routed to the host screen's existing toast rather than a second one.
	onNotify: (message: string) => void
}

export function ParkingBookingSheet({
	parkingId,
	...props
}: ParkingBookingSheetProps) {
	// Mounted only while open, so each visit builds a fresh draft the way
	// the original openParkingBooking() did.
	if (!parkingId || !PARKINGS.some(parking => parking.id === parkingId)) return null
	return <ParkingBookingSheetBody key={parkingId} parkingId={parkingId} {...props} />
}

function ParkingBookingSheetBody({
	parkingId,
	initialBay,
	initialLevel,
	onClose,
	onNotify,
}: ParkingBookingSheetProps & { parkingId: string }) {
	const router = useRouter()
	const { createReservation, reservations } = useApp()
	const [booking, setBooking] = useState<ParkingBookingDraft>(() =>
		makeDraft(parkingId, initialBay, initialLevel),
	)
	const [bayOpen, setBayOpen] = useState(false)
	// Guards a double tap on the confirm button. A ref rather than state
	// because two clicks can land before React re-renders, and only the ref is
	// already updated by the time the second handler runs.
	const submittingRef = useRef(false)
	const [submitting, setSubmitting] = useState(false)
	const heldReservation = findLiveReservationForParking(reservations, parkingId)
	const heldMeta = useBookingMeta(heldReservation?.id)
	const heldBay = heldMeta?.level === booking.level ? heldMeta.bay : null

	// The booking the customer already holds across the window this draft
	// asks for. Computed as the draft changes so the clash is on screen
	// before they reach for the confirm button; confirmParkingBooking()
	// re-checks, because a «Hozir» start keeps moving.
	const conflict = useMemo(
		() => findOverlappingReservation(reservations, bookingWindow(booking)),
		[reservations, booking],
	)
	const conflictParking = conflict
		? PARKINGS.find(item => item.id === conflict.parkingId)
		: undefined

	const parking = PARKINGS.find(item => item.id === booking.parkingId)
	if (!parking) return null

	// Bays this customer holds on the given level, excluded from auto-picks.
	function heldBaysOn(level: number) {
		return heldMeta && heldMeta.level === level ? [heldMeta.bay] : []
	}

	// The bay the booking will actually use. Derived rather than stored,
	// because the held bay arrives from storage a tick after the draft is
	// built: the floor plan marks it «yours» and refuses to select it, so a
	// draft left sitting on one opens the sheet on a bay its own confirm
	// button rejects.
	const selectedBay =
		booking.bay && booking.bay !== heldBay
			? booking.bay
			: (firstFreeBay(parking, booking.level, heldBaysOn(booking.level)) ?? '')

	function confirmParkingBooking() {
		if (!parking) return
		// Two taps before the sheet unmounts would otherwise book twice.
		if (submittingRef.current) return
		if (parking.availableSpaces <= 0) {
			onNotify('Bu parking hozir to‘la')
			return
		}

		// Against the real clock, not the one the sheet opened with: «Hozir»
		// keeps moving, and a fixed time can go by while the sheet is open.
		const currentTime = new Date().getTime()
		const span = bookingWindow(booking, currentTime)
		const start = span.startAt
		if (isParkingStartPast(start, currentTime)) {
			onNotify('Tanlangan kelish vaqti o‘tib ketgan')
			return
		}

		// Before anything about bays: if the customer is already parked
		// somewhere during this window, no choice of bay makes the booking
		// valid, and telling them to pick another one sends them the wrong way.
		const clash = findOverlappingReservation(reservations, span)
		if (clash) {
			onNotify('Bu vaqtda sizda boshqa parking broni mavjud')
			return
		}

		const bay = bayMap(parking, booking.level).bays.find(item => item.id === selectedBay)
		if (!bay || !isBaySelectable(bay.state)) {
			onNotify('Bo‘sh joyni tanlang')
			return
		}

		submittingRef.current = true
		setSubmitting(true)

		try {
			const attempt = createReservation({
				parkingId: parking.id,
				startAt: start.toISOString(),
				durationHours: booking.hours,
				pricePerHour: parking.pricePerHour,
			})
			// The store applies the same overlap rule as the check above; it
			// only refuses here when the list it holds is newer than this render.
			if (!attempt.ok) {
				submittingRef.current = false
				setSubmitting(false)
				onNotify('Bu vaqtda sizda boshqa parking broni mavjud')
				return
			}
			const reservation = attempt.created

			saveBookingMeta(reservation.id, {
				bay: selectedBay,
				level: booking.level,
				holdMinutes: 15,
			})

			// A reservation is not a favorite: booking touches the reservation
			// store only. It lands on the booking's own confirmation screen
			// rather than on the Bron list — that screen already carries the
			// «Bron tasdiqlandi» badge, the QR, the countdown and the way in,
			// and its back button goes to Bron. Dropping the user straight into
			// a list left the booking with no confirmation moment at all.
			onClose()
			router.push(`/reservation/${reservation.id}`)
		} catch {
			// Nothing was stored, so let the customer try again.
			submittingRef.current = false
			setSubmitting(false)
			onNotify('Bron yaratilmadi. Profilga qayta kirib ko‘ring.')
		}
	}

	if (bayOpen) {
		return (
			<BottomSheet
				title='Parking joyini tanlang'
				onClose={() => setBayOpen(false)}
			>
				<Card>
					<div className='flex items-center justify-between gap-3'>
						<div className='min-w-0'>
							<p className='truncate text-[14px] font-bold text-ink'>
								{parking.name}
							</p>
							<p className='mt-0.5 text-[11.5px] text-ink-3'>
								Bo‘sh joylardan birini tanlang
							</p>
						</div>
						<div className='flex gap-1.5'>
							{Array.from({ length: parking.levels }, (_, index) => (
								<Chip
									key={index}
									active={booking.level === index + 1}
									onClick={() =>
										setBooking(current => ({
											...current,
											level: index + 1,
											bay:
												firstFreeBay(
													parking!,
													index + 1,
													heldBaysOn(index + 1),
												) ?? '',
										}))
									}
									className='h-7 px-2.5 text-[11.5px]'
								>
									{index + 1}
								</Chip>
							))}
						</div>
					</div>

					<div className='mt-3'>
						<BayGrid
							parking={parking}
							level={booking.level}
							selectedBay={selectedBay}
							heldBay={heldBay}
							onSelect={(bay, state) => {
								if (!isBaySelectable(state)) return onNotify('Bu joy band')
								setBooking(current => ({ ...current, bay }))
							}}
						/>
					</div>
				</Card>

				<Button
					variant='primary'
					block
					className='mt-4'
					disabled={!selectedBay}
					onClick={() => setBayOpen(false)}
				>
					{selectedBay ? `${selectedBay} joyini tanlash` : 'Bu darajada bo‘sh joy yo‘q'}
				</Button>
			</BottomSheet>
		)
	}

	const total = parking.pricePerHour * booking.hours
	// Read off the instant that will be stored, so the sheet cannot say one
	// time while the confirmation and Bron say another.
	const arrival = formatTime(bookingWindow(booking).startAt)
	const hasAnpr = parking.plateRecognition

	return (
		<BottomSheet title={PARKING_BOOK_LABEL} onClose={onClose}>
			<div className='rounded-2xl bg-white p-3 shadow-card'>
				<div className='flex items-center gap-3'>
					<span className='grid size-12 shrink-0 place-items-center rounded-2xl bg-ink text-white'>
						<CircleParking className='size-5' strokeWidth={2} />
					</span>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-sm font-black text-ink'>
							{parking.name}
						</p>
						<p className='mt-1 truncate text-xs text-ink-3'>
							{parking.address} · {parking.availableSpaces} ta bo‘sh
						</p>
					</div>
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
				<p className='text-sm font-black text-ink'>Sana</p>
				<HorizontalRail className='mt-3 gap-2'>
					{booking.days.map(day => (
						<button
							key={day.key}
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									dayKey: day.key,
								}))
							}
							className={`h-11 shrink-0 rounded-xl px-4 text-xs font-black transition duration-200 ${
								booking.dayKey === day.key
									? 'bg-brand text-white shadow-lg shadow-[0_8px_24px_rgb(108_71_224/.22)]'
									: 'bg-white text-ink-2 ring-1 ring-line'
							}`}
						>
							{day.label}
						</button>
					))}
				</HorizontalRail>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
				<p className='text-sm font-black text-ink'>Kelish vaqti</p>
				<div className='mt-3 grid grid-cols-4 gap-2'>
					{PARKING_ARRIVAL_SLOTS.map(slot => (
						<button
							key={slot}
							type='button'
							onClick={() => setBooking(current => ({ ...current, slot }))}
							className={`h-11 rounded-xl text-[11px] font-black transition duration-200 ${
								booking.slot === slot
									? 'bg-brand text-white shadow-lg shadow-[0_8px_24px_rgb(108_71_224/.22)]'
									: 'bg-white text-ink-2 ring-1 ring-line'
							}`}
						>
							{slot}
						</button>
					))}
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-sm font-black text-ink'>Davomiyligi</p>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									hours: Math.max(1, current.hours - 1),
								}))
							}
							className='grid size-11 place-items-center rounded-xl bg-canvas text-ink'
							aria-label='Bir soat kamaytirish'
						>
							<Minus className='size-5' />
						</button>
						<strong className='min-w-12 text-center text-lg font-black text-ink'>
							{booking.hours} s
						</strong>
						<button
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									hours: Math.min(24, current.hours + 1),
								}))
							}
							className='grid size-11 place-items-center rounded-xl bg-canvas text-ink'
							aria-label='Bir soat qo‘shish'
						>
							<Plus className='size-5' />
						</button>
					</div>
				</div>
				<div className='mt-3 grid grid-cols-5 gap-2'>
					{[1, 2, 3, 5, 24].map(hours => (
						<button
							key={hours}
							type='button'
							onClick={() => setBooking(current => ({ ...current, hours }))}
							className={`h-10 rounded-xl text-[11px] font-black transition duration-200 ${
								booking.hours === hours
									? 'bg-brand text-white'
									: 'bg-white text-ink-2 ring-1 ring-line'
							}`}
						>
							{hours === 24 ? 'sutka' : `${hours} s`}
						</button>
					))}
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-card'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-sm font-black text-ink'>Joy</p>
					<button
						type='button'
						onClick={() => setBayOpen(true)}
						className='h-9 rounded-xl bg-white px-3 text-[11px] font-black text-ink-2 ring-1 ring-line'
					>
						Boshqasini tanlash
					</button>
				</div>
				<div className='mt-3 flex items-center gap-3'>
					<div className='w-22 shrink-0 rounded-2xl bg-brand-50 px-2 py-3 text-center'>
						<p className='font-mono text-xl font-black text-brand'>
							{selectedBay || '—'}
						</p>
						<p className='mt-1 text-[10px] text-ink-3'>
							{booking.level}-daraja
						</p>
					</div>
					<p className='text-xs leading-5 text-ink-3'>
						Joy siz uchun biriktiriladi. Shlagbaum{' '}
						{hasAnpr ? 'avtomobil raqami yoki QR orqali' : 'QR-kod orqali'}{' '}
						ochiladi.
					</p>
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white px-4 shadow-card'>
				{[
					['Tarif', `${formatUZS(parking.pricePerHour)}/soat`],
					['Davomiyligi', `${booking.hours} soat`],
					['Kelish', arrival],
					['Joyni ushlab turamiz', 'kelishdan keyin 15 daqiqa'],
				].map(([label, value], index) => (
					<div
						key={label}
						className={`flex items-center justify-between gap-4 py-3 text-xs ${index ? 'border-t border-line' : ''}`}
					>
						<span className='text-ink-3'>{label}</span>
						<strong className='text-right text-ink'>{value}</strong>
					</div>
				))}
				<div className='flex items-center justify-between gap-4 border-t border-line py-3'>
					<span className='text-xs text-ink-3'>Jami</span>
					<strong className='text-lg font-black text-ink'>
						{total ? formatUZS(total) : 'Bepul'}
					</strong>
				</div>
			</div>

			{/* One driver cannot occupy two spaces at once, whichever lot each
			    one is in. Shown as the draft changes rather than only on
			    submit, so the clash is visible before the bay is fiddled with. */}
			{conflict && (
				<div className='mt-3 rounded-2xl bg-warn-bg p-4'>
					<div className='flex items-start gap-3'>
						<CalendarClock className='mt-0.5 size-4 shrink-0 text-warn' />
						<div className='min-w-0 flex-1'>
							<p className='text-[13px] font-black text-ink'>
								Bu vaqtda sizda boshqa parking broni mavjud
							</p>
							<p className='mt-1 text-[11.5px] leading-5 text-ink-2'>
								{conflictParking?.name ?? 'Parking'} ·{' '}
								{formatTime(conflict.startAt)}–{formatTime(conflict.endAt)}.
								Boshqa vaqtni tanlang yoki avvalgi bronni bekor qiling.
							</p>
						</div>
					</div>
					<button
						type='button'
						onClick={() => {
							onClose()
							// The one lifecycle rule, not a second copy of it: an
							// entered conflict opens its session, a not-yet-entered
							// one its confirmation.
							router.push(reservationHref(conflict))
						}}
						className='mt-3 h-10 w-full rounded-xl border border-line-2 bg-white text-[12px] font-black text-ink'
					>
						Bronni ko‘rish
					</button>
				</div>
			)}

			<button
				type='button'
				onClick={confirmParkingBooking}
				disabled={submitting || Boolean(conflict)}
				className='mt-4 h-13 w-full rounded-2xl bg-brand px-4 text-sm font-black text-white shadow-lg shadow-[0_6px_16px_rgb(108_71_224/.28)] disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none'
			>
				{conflict
					? 'Vaqt band'
					: total
						? 'To‘lash va band qilish'
						: 'Band qilish'}
			</button>
			<p className='mt-2 text-center text-[11px] text-ink-3'>
				Kelishdan 1 soat oldin bepul bekor qilish mumkin
			</p>
		</BottomSheet>
	)
}
