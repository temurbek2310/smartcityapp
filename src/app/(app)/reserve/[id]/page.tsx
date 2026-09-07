'use client'

import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { formatUZS } from '@/lib/format'
import { CalendarClock, CarFront, ShieldCheck } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { z } from 'zod'

const bookingSchema = z.object({
	startAt: z.string().min(1),
	durationHours: z.number().int().min(1).max(12),
})

function defaultLocalDateTime() {
	const date = new Date(Date.now() + 15 * 60_000)
	date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0)
	const offset = date.getTimezoneOffset()
	return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16)
}

export default function ReservePage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const parking = getParking(params.id)
	const { user, createReservation } = useApp()
	const [startAt, setStartAt] = useState(defaultLocalDateTime)
	const [durationHours, setDurationHours] = useState(2)
	const [error, setError] = useState('')
	const total = useMemo(
		() => (parking?.pricePerHour ?? 0) * durationHours,
		[parking, durationHours],
	)

	if (!parking) {
		return <div>Parking topilmadi.</div>
	}

	const selectedParking = parking

	function reserve() {
		setError('')
		const parsed = bookingSchema.safeParse({ startAt, durationHours })
		if (!parsed.success) {
			setError('Sana va davomiylikni tekshiring.')
			return
		}
		const start = new Date(parsed.data.startAt)
		if (
			Number.isNaN(start.getTime()) ||
			start.getTime() < Date.now() - 60_000
		) {
			setError("Kelish vaqti o'tmishda bo'lishi mumkin emas.")
			return
		}
		if (selectedParking.availableSpaces <= 0) {
			setError("Bu parking hozir to'lgan.")
			return
		}
		const reservation = createReservation({
			parkingId: selectedParking.id,
			startAt: start.toISOString(),
			durationHours: parsed.data.durationHours,
			pricePerHour: selectedParking.pricePerHour,
		})
		router.push(`/reservation/${reservation.id}`)
	}

	return (
		<div className='space-y-6'>
			<div>
				<p className='text-xs font-bold uppercase tracking-[.2em] text-slate-400'>
					New booking
				</p>
				<h1 className='mt-1 text-3xl font-black'>Parkingni bron qilish</h1>
				<p className='mt-2 text-sm text-slate-500'>{parking.name}</p>
			</div>
			<section className='space-y-4 rounded-3xl border border-slate-200 p-5'>
				<div className='flex items-center gap-3 rounded-2xl bg-slate-100 p-4'>
					<CarFront className='size-5' />
					<div>
						<p className='text-xs text-slate-500'>Avtomobil</p>
						<strong>{user?.vehiclePlate}</strong>
					</div>
				</div>
				<div>
					<label className='flex items-center gap-2 text-sm font-bold'>
						<CalendarClock className='size-4' /> Kelish vaqti
					</label>
					<input
						type='datetime-local'
						value={startAt}
						onChange={e => setStartAt(e.target.value)}
						className='mt-2 h-13 w-full rounded-2xl border border-slate-200 px-4 outline-none focus:border-slate-950'
					/>
				</div>
				<div>
					<label className='text-sm font-bold'>Turish davomiyligi</label>
					<div className='mt-2 grid grid-cols-4 gap-2'>
						{[1, 2, 3, 4].map(hours => (
							<button
								key={hours}
								onClick={() => setDurationHours(hours)}
								className={`h-12 rounded-2xl text-sm font-bold ${durationHours === hours ? 'bg-slate-950 text-white' : 'bg-slate-100'}`}
							>
								{hours} soat
							</button>
						))}
					</div>
					<select
						value={durationHours}
						onChange={e => setDurationHours(Number(e.target.value))}
						className='mt-2 h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none'
					>
						{Array.from({ length: 12 }, (_, i) => i + 1).map(hours => (
							<option key={hours} value={hours}>
								{hours} soat
							</option>
						))}
					</select>
				</div>
			</section>
			<section className='rounded-3xl bg-slate-950 p-5 text-white'>
				<div className='flex items-center justify-between'>
					<span className='text-sm text-slate-300'>
						{formatUZS(parking.pricePerHour)} × {durationHours} soat
					</span>
					<strong className='text-2xl'>{formatUZS(total)}</strong>
				</div>
				<p className='mt-3 flex items-center gap-2 text-xs text-slate-400'>
					<ShieldCheck className='size-4' /> MVPda bu bron real pul yechmaydi.
				</p>
			</section>
			{error && (
				<p className='rounded-2xl bg-rose-50 p-3 text-sm font-medium text-rose-700'>
					{error}
				</p>
			)}
			<button
				onClick={reserve}
				className='h-14 w-full rounded-2xl bg-emerald-500 font-black text-white shadow-lg shadow-emerald-500/20'
			>
				Bronni tasdiqlash
			</button>
		</div>
	)
}
