'use client'

import { CircleParking, Minus, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'
import { saveBookingMeta } from '@/lib/booking-meta'
import { formatDayMonth, formatTime, formatUZS } from '@/lib/format'

// The one parking booking UI in the app. It used to live inline in Home
// and duplicated an older standalone /reserve/[id] form; both are gone and
// every "Bron qilish" entry point (Home cards, Home AI tip, Home services,
// Favorites, Transport destination card and notice, parking detail) opens
// this sheet. The UI layer only — reservations are still created by
// B SPACE's own createReservation().

export type ParkingBookingDraft = {
	parkingId: string
	dayIndex: number
	dayLabels: string[]
	slot: string
	hours: number
	bay: string
	level: number
	nowLabel: string
}

const ARRIVAL_SLOTS = [
	'Hozir',
	'11:30',
	'12:00',
	'12:30',
	'13:00',
	'14:00',
	'18:00',
	'19:00',
]

function makeBookingDayLabels() {
	const labels = ['Bugun', 'Ertaga']
	const now = new Date()
	for (let offset = 2; offset <= 3; offset += 1) {
		const date = new Date(now)
		date.setDate(now.getDate() + offset)
		labels.push(formatDayMonth(date))
	}
	return labels
}

function suggestedBay(parkingId: string) {
	const code = parkingId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
	return `A-${String((code % 18) + 1).padStart(2, '0')}`
}

function makeDraft(parkingId: string): ParkingBookingDraft {
	const now = new Date()
	now.setMinutes(now.getMinutes() + 15)
	now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
	const nowLabel = formatTime(now)

	return {
		parkingId,
		dayIndex: 0,
		dayLabels: makeBookingDayLabels(),
		slot: 'Hozir',
		hours: 2,
		bay: suggestedBay(parkingId),
		level: 1,
		nowLabel,
	}
}

function bookingStartDate(draft: ParkingBookingDraft) {
	const start = new Date()
	start.setSeconds(0, 0)
	start.setDate(start.getDate() + draft.dayIndex)

	if (draft.slot === 'Hozir') {
		start.setMinutes(start.getMinutes() + 15)
		start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0)
		return start
	}

	const [hour, minute] = draft.slot.split(':').map(Number)
	start.setHours(hour, minute, 0, 0)
	return start
}

type ParkingBookingSheetProps = {
	// The parking to book, or null while the sheet is closed. Every value in
	// the sheet is read from this parking — nothing is hardcoded.
	parkingId: string | null
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
	if (!parkingId) return null
	return <ParkingBookingSheetBody parkingId={parkingId} {...props} />
}

function ParkingBookingSheetBody({
	parkingId,
	onClose,
	onNotify,
}: ParkingBookingSheetProps & { parkingId: string }) {
	const router = useRouter()
	const { createReservation } = useApp()
	const [booking, setBooking] = useState<ParkingBookingDraft>(() =>
		makeDraft(parkingId),
	)
	const [bayOpen, setBayOpen] = useState(false)

	const parking = PARKINGS.find(item => item.id === booking.parkingId)
	if (!parking) return null

	function confirmParkingBooking() {
		if (!parking) return
		if (parking.availableSpaces <= 0) {
			onNotify('Bu parking hozir to‘la')
			return
		}

		const start = bookingStartDate(booking)
		const currentTime = new Date().getTime()
		if (start.getTime() < currentTime - 60_000) {
			onNotify('Tanlangan kelish vaqti o‘tib ketgan')
			return
		}

		try {
			const reservation = createReservation({
				parkingId: parking.id,
				startAt: start.toISOString(),
				durationHours: booking.hours,
				pricePerHour: parking.pricePerHour,
			})

			saveBookingMeta(reservation.id, {
				bay: booking.bay,
				level: booking.level,
				holdMinutes: 15,
			})

			// A reservation is not a favorite: booking touches the reservation
			// store only, and lands the user on Bron.
			onClose()
			router.push('/bookings')
		} catch {
			onNotify('Bron yaratilmadi. Profilga qayta kirib ko‘ring.')
		}
	}

	if (bayOpen) {
		const prefix = String.fromCharCode(64 + booking.level)
		const bays = Array.from(
			{ length: 20 },
			(_, index) => `${prefix}-${String(index + 1).padStart(2, '0')}`,
		)

		return (
			<BottomSheet
				title='Parking joyini tanlang'
				onClose={() => setBayOpen(false)}
			>
				<div className='rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'>
					<p className='text-sm font-black text-slate-950'>{parking.name}</p>
					<p className='mt-1 text-xs text-slate-400'>
						Bo‘sh joylardan birini tanlang
					</p>
				</div>

				<div className='mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200'>
					{[1, 2, 3].map(level => (
						<button
							key={level}
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									level,
									bay: `${String.fromCharCode(64 + level)}-01`,
								}))
							}
							className={`h-11 rounded-xl text-xs font-black ${
								booking.level === level
									? 'bg-violet-600 text-white'
									: 'bg-slate-50 text-slate-600'
							}`}
						>
							{level}-daraja
						</button>
					))}
				</div>

				<div className='mt-3 flex items-center gap-4 px-1 text-[10px] font-bold text-slate-500'>
					<span className='flex items-center gap-1.5'>
						<i className='size-2 rounded-full bg-emerald-500' /> Bo‘sh
					</span>
					<span className='flex items-center gap-1.5'>
						<i className='size-2 rounded-full bg-slate-300' /> Band
					</span>
					<span className='flex items-center gap-1.5'>
						<i className='size-2 rounded-full bg-violet-600' /> Tanlangan
					</span>
				</div>

				<div className='mt-3 grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'>
					{bays.map((bay, index) => {
						const busy = index % 6 === 2 || index % 9 === 4
						const selected = booking.bay === bay
						return (
							<button
								key={bay}
								type='button'
								disabled={busy}
								onClick={() => setBooking(current => ({ ...current, bay }))}
								className={`h-11 rounded-xl text-[11px] font-black transition ${
									selected
										? 'bg-violet-600 text-white shadow-md'
										: busy
											? 'cursor-not-allowed bg-slate-100 text-slate-300'
											: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
								}`}
							>
								{bay}
							</button>
						)
					})}
				</div>

				<button
					type='button'
					onClick={() => setBayOpen(false)}
					className='mt-4 h-12 w-full rounded-2xl bg-violet-600 text-sm font-black text-white'
				>
					{booking.bay} joyini tanlash
				</button>
			</BottomSheet>
		)
	}

	const total = parking.pricePerHour * booking.hours
	const arrival = booking.slot === 'Hozir' ? booking.nowLabel : booking.slot
	const hasAnpr = parking.plateRecognition

	return (
		<BottomSheet title='Parkingni bron qilish' onClose={onClose}>
			<div className='rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200'>
				<div className='flex items-center gap-3'>
					<span className='grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white'>
						<CircleParking className='size-5' strokeWidth={2} />
					</span>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-sm font-black text-slate-950'>
							{parking.name}
						</p>
						<p className='mt-1 truncate text-xs text-slate-400'>
							{parking.address} · {parking.availableSpaces} ta bo‘sh
						</p>
					</div>
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
				<p className='text-sm font-black text-slate-900'>Sana</p>
				<HorizontalRail className='mt-3 gap-2'>
					{booking.dayLabels.map((label, index) => (
						<button
							key={`${label}-${index}`}
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									dayIndex: index,
								}))
							}
							className={`h-11 shrink-0 rounded-xl px-4 text-xs font-black transition ${
								booking.dayIndex === index
									? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
									: 'bg-white text-slate-600 ring-1 ring-slate-200'
							}`}
						>
							{label}
						</button>
					))}
				</HorizontalRail>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
				<p className='text-sm font-black text-slate-900'>Kelish vaqti</p>
				<div className='mt-3 grid grid-cols-4 gap-2'>
					{ARRIVAL_SLOTS.map(slot => (
						<button
							key={slot}
							type='button'
							onClick={() => setBooking(current => ({ ...current, slot }))}
							className={`h-11 rounded-xl text-[11px] font-black transition ${
								booking.slot === slot
									? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
									: 'bg-white text-slate-600 ring-1 ring-slate-200'
							}`}
						>
							{slot}
						</button>
					))}
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-sm font-black text-slate-900'>Davomiyligi</p>
					<div className='flex items-center gap-3'>
						<button
							type='button'
							onClick={() =>
								setBooking(current => ({
									...current,
									hours: Math.max(1, current.hours - 1),
								}))
							}
							className='grid size-11 place-items-center rounded-xl bg-slate-50 text-slate-800'
							aria-label='Bir soat kamaytirish'
						>
							<Minus className='size-5' />
						</button>
						<strong className='min-w-12 text-center text-lg font-black text-slate-950'>
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
							className='grid size-11 place-items-center rounded-xl bg-slate-50 text-slate-800'
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
							className={`h-10 rounded-xl text-[11px] font-black transition ${
								booking.hours === hours
									? 'bg-violet-600 text-white'
									: 'bg-white text-slate-600 ring-1 ring-slate-200'
							}`}
						>
							{hours === 24 ? 'sutka' : `${hours} s`}
						</button>
					))}
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200'>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-sm font-black text-slate-900'>Joy</p>
					<button
						type='button'
						onClick={() => setBayOpen(true)}
						className='h-9 rounded-xl bg-white px-3 text-[11px] font-black text-slate-700 ring-1 ring-slate-200'
					>
						Boshqasini tanlash
					</button>
				</div>
				<div className='mt-3 flex items-center gap-3'>
					<div className='w-22 shrink-0 rounded-2xl bg-violet-50 px-2 py-3 text-center'>
						<p className='font-mono text-xl font-black text-violet-600'>
							{booking.bay}
						</p>
						<p className='mt-1 text-[10px] text-slate-400'>
							{booking.level}-daraja
						</p>
					</div>
					<p className='text-xs leading-5 text-slate-500'>
						Joy siz uchun biriktiriladi. Shlagbaum{' '}
						{hasAnpr ? 'avtomobil raqami yoki QR orqali' : 'QR-kod orqali'}{' '}
						ochiladi.
					</p>
				</div>
			</div>

			<div className='mt-3 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-slate-200'>
				{[
					['Tarif', `${formatUZS(parking.pricePerHour)}/soat`],
					['Davomiyligi', `${booking.hours} soat`],
					['Kelish', arrival],
					['Joyni ushlab turamiz', 'kelishdan keyin 15 daqiqa'],
				].map(([label, value], index) => (
					<div
						key={label}
						className={`flex items-center justify-between gap-4 py-3 text-xs ${index ? 'border-t border-slate-100' : ''}`}
					>
						<span className='text-slate-500'>{label}</span>
						<strong className='text-right text-slate-900'>{value}</strong>
					</div>
				))}
				<div className='flex items-center justify-between gap-4 border-t border-slate-100 py-3'>
					<span className='text-xs text-slate-500'>Jami</span>
					<strong className='text-lg font-black text-slate-950'>
						{total ? formatUZS(total) : 'Bepul'}
					</strong>
				</div>
			</div>

			<button
				type='button'
				onClick={confirmParkingBooking}
				className='mt-4 h-13 w-full rounded-2xl bg-violet-600 px-4 text-sm font-black text-white shadow-lg shadow-violet-600/25'
			>
				{total ? 'To‘lash va bron qilish' : 'Bron qilish'}
			</button>
			<p className='mt-2 text-center text-[11px] text-slate-400'>
				Kelishdan 1 soat oldin bepul bekor qilish mumkin
			</p>
		</BottomSheet>
	)
}
