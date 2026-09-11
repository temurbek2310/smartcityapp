'use client'

import { QrImage } from '@/components/ui/qr-image'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { formatDuration, formatTime, formatUZS } from '@/lib/format'
import { formatUzbekPlate } from '@/lib/plate'
import { calculateFinalTotal } from '@/lib/reservation'
import { Clock3, LogOut, Plus, QrCode as QrIcon } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function SessionPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations, extendReservation, exitReservation } = useApp()
	const reservation = reservations.find(item => item.id === params.id)
	const parking = reservation ? getParking(reservation.parkingId) : undefined
	const [now, setNow] = useState<number | null>(null)
	const [showExitQr, setShowExitQr] = useState(false)

	useEffect(() => {
		const updateNow = () => setNow(Date.now())
		const initialTimer = window.setTimeout(updateNow, 0)
		const intervalTimer = window.setInterval(updateNow, 1000)
		return () => {
			window.clearTimeout(initialTimer)
			window.clearInterval(intervalTimer)
		}
	}, [])

	if (!reservation || !parking)
		return (
			<div className='rounded-3xl bg-rose-50 p-6'>
				Parking sessiyasi topilmadi.
			</div>
		)
	if (reservation.status === 'completed')
		return (
			<div className='space-y-4'>
				<p className='rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800'>
					Bu sessiya yakunlangan.
				</p>
				<button
					onClick={() => router.push(`/receipt/${reservation.id}`)}
					className='h-12 w-full rounded-2xl bg-slate-950 font-bold text-white'
				>
					Chekni ko‘rish
				</button>
			</div>
		)
	if (reservation.status !== 'active')
		return (
			<div className='space-y-4'>
				<p className='rounded-2xl bg-amber-50 p-4 text-sm text-amber-800'>
					Bu booking hali active emas.
				</p>
				<button
					onClick={() => router.push(`/reservation/${reservation.id}`)}
					className='h-12 w-full rounded-2xl bg-slate-950 font-bold text-white'
				>
					Reservationga qaytish
				</button>
			</div>
		)

	const reservationId = reservation.id
	const remaining = now === null ? 0 : new Date(reservation.endAt).getTime() - now
	// Billed by the hour from entry, so it only matches estimatedTotal while
	// the car sits inside its booked duration.
	const runningTotal =
		now === null
			? reservation.estimatedTotal
			: calculateFinalTotal(reservation, new Date(now))

	function finish() {
		exitReservation(reservationId)
		router.push(`/receipt/${reservationId}`)
	}

	return (
		<div className='space-y-6'>
			<div className='text-center'>
				<span className='inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700'>
					<span className='size-2 animate-pulse rounded-full bg-emerald-500' />{' '}
					ACTIVE
				</span>
				<h1 className='mt-4 text-3xl font-black'>Parking in progress</h1>
				<p className='mt-2 text-sm text-slate-500'>{parking.name}</p>
			</div>
			<section className='rounded-4xl bg-slate-950 p-7 text-center text-white shadow-xl shadow-slate-950/10'>
				<Clock3 className='mx-auto size-7 text-sky-300' />
				<p className='mt-4 text-xs font-bold uppercase tracking-[.2em] text-slate-400'>
					Time remaining
				</p>
				<p className='mt-3 font-mono text-5xl font-black tracking-tight'>
					{formatDuration(remaining)}
				</p>
				<div className='mt-5 flex justify-between border-t border-white/10 pt-4 text-sm'>
					<span className='text-slate-400'>End time</span>
					<strong>{formatTime(reservation.endAt)}</strong>
				</div>
			</section>
			<section className='rounded-3xl border border-slate-200 p-5'>
				<div className='flex justify-between text-sm'>
					<span className='text-slate-500'>Vehicle</span>
					<strong>{formatUzbekPlate(reservation.vehiclePlate)}</strong>
				</div>
				<div className='mt-3 flex justify-between text-sm'>
					<span className='text-slate-500'>Current estimate</span>
					<strong>{formatUZS(runningTotal)}</strong>
				</div>
				<button
					onClick={() => extendReservation(reservation.id, 1)}
					className='mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 font-black text-sky-700'
				>
					<Plus className='size-5' /> +1 soat uzaytirish
				</button>
				<p className='mt-2 text-center text-[11px] text-slate-400'>
					Demo: future capacity check avtomatik ravishda available deb qabul
					qilinadi.
				</p>
			</section>

			{!showExitQr ? (
				<button
					onClick={() => setShowExitQr(true)}
					className='flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 font-black'
				>
					<QrIcon className='size-5' /> Exit QR ochish
				</button>
			) : (
				<section className='animate-slide-up rounded-4xl border border-slate-200 p-6 text-center'>
					<p className='text-xs font-bold uppercase tracking-[.2em] text-slate-400'>
						Exit QR
					</p>
					<div className='mx-auto mt-4 w-fit rounded-3xl border border-slate-100 p-3'>
						<QrImage value={`BSPACE:EXIT:${reservation.id}`} size={190} />
					</div>
					<p className='mt-3 text-xs text-slate-500'>
						Gate scanner o‘rniga MVP simulator ishlaydi.
					</p>
					<button
						onClick={finish}
						className='mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-rose-500 font-black text-white'
					>
						<LogOut className='size-5' /> Simulate exit & pay
					</button>
				</section>
			)}
		</div>
	)
}
