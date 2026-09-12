'use client'

import {
	CheckCircle2,
	CircleParking,
	Clock3,
	LogOut,
	Plus,
	QrCode,
} from 'lucide-react'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KeyValue } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { formatDuration, formatTime, formatUZS } from '@/lib/format'
import { formatUzbekPlate } from '@/lib/plate'
import { calculateFinalTotal } from '@/lib/reservation'

export default function SessionPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations, extendReservation, exitReservation } = useApp()

	const reservation = reservations.find(item => item.id === params.id)
	const parking = reservation ? getParking(reservation.parkingId) : undefined
	const meta = useBookingMeta(reservation?.id)

	const [now, setNow] = useState<number | null>(null)
	const [showExitQr, setShowExitQr] = useState(false)

	useEffect(() => {
		const update = () => setNow(Date.now())
		const initial = window.setTimeout(update, 0)
		const interval = window.setInterval(update, 1000)
		return () => {
			window.clearTimeout(initial)
			window.clearInterval(interval)
		}
	}, [])

	if (!reservation || !parking) notFound()

	const frame = (children: React.ReactNode) => (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar
					title='Parking sessiyasi'
					subtitle={parking.name}
					onBack={() => router.push('/bookings')}
				/>
				{children}
			</div>
		</div>
	)

	if (reservation.status === 'completed') {
		return frame(
			<EmptyState
				icon={CheckCircle2}
				title='Sessiya yakunlangan'
				text='To‘lov amalga oshirildi.'
				href={`/receipt/${reservation.id}`}
				action='Chekni ko‘rish'
			/>,
		)
	}

	if (reservation.status !== 'active') {
		return frame(
			<EmptyState
				icon={CircleParking}
				title='Bron hali faol emas'
				text='Parkingga kirganingizdan so‘ng taymer ishga tushadi.'
				href={`/reservation/${reservation.id}`}
				action='Bronga qaytish'
			/>,
		)
	}

	const reservationId = reservation.id
	const remaining = now === null ? 0 : new Date(reservation.endAt).getTime() - now
	const overstayed = remaining <= 0

	// Billed by the hour from entry, so it only matches estimatedTotal while
	// the car sits inside its booked duration.
	const runningTotal =
		now === null
			? reservation.estimatedTotal
			: calculateFinalTotal(reservation, new Date(now))

	return frame(
		<>
			{/* The countdown is the whole screen, so it gets the one dark surface
			    in the app — City Goo reserves that for a live timer too. */}
			<Card className='bg-ink px-5 py-6 text-center'>
				<Badge
					tone={overstayed ? 'bad' : 'ok'}
					className='mx-auto bg-white/12 text-white'
				>
					<span
						className={`size-1.5 rounded-full ${overstayed ? 'bg-bad' : 'animate-pulse bg-ok'}`}
					/>
					{overstayed ? 'VAQT TUGADI' : 'FAOL'}
				</Badge>

				<Clock3 className='mx-auto mt-4 size-6 text-white/55' />
				<p className='mt-2 text-[11px] font-bold uppercase tracking-[.16em] text-white/50'>
					{overstayed ? 'Ortiqcha vaqt' : 'Qolgan vaqt'}
				</p>
				<p className='mt-2 font-mono text-[40px] font-black leading-none tracking-tight text-white'>
					{formatDuration(Math.abs(remaining))}
				</p>

				<div className='mt-5 flex items-center justify-between border-t border-white/10 pt-3.5 text-[13px]'>
					<span className='text-white/55'>Tugash vaqti</span>
					<b className='text-white'>{formatTime(reservation.endAt)}</b>
				</div>
			</Card>

			<Card>
				<KeyValue
					label='Avtomobil'
					value={formatUzbekPlate(reservation.vehiclePlate)}
				/>
				{meta && <KeyValue label='Joy' value={`${meta.bay} · ${meta.level}-daraja`} />}
				<KeyValue label='Soatlik tarif' value={formatUZS(reservation.pricePerHour)} />
				<KeyValue label='Joriy hisob' value={formatUZS(runningTotal)} />

				<Button
					variant='outline'
					block
					className='mt-3'
					onClick={() => extendReservation(reservation.id, 1)}
				>
					<Plus className='size-4 text-brand' /> +1 soat uzaytirish
				</Button>
				<p className='mt-2 text-center text-[11px] text-ink-3'>
					Demo: bo‘sh joy tekshiruvi avtomatik mavjud deb hisoblanadi.
				</p>
			</Card>

			{showExitQr ? (
				<Card className='animate-slide-up text-center'>
					<p className='text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'>
						Chiqish QR kodi
					</p>
					<div className='mx-auto mt-3 w-fit rounded-card-lg border border-line p-3'>
						<QrImage value={`BSPACE:EXIT:${reservation.id}`} size={190} />
					</div>
					<p className='mt-3 text-[11.5px] text-ink-3'>
						Shlagbaum skaneri o‘rniga demo simulyator ishlaydi.
					</p>
					<Button
						variant='primary'
						danger
						block
						className='mt-4'
						onClick={() => {
							exitReservation(reservationId)
							router.push(`/receipt/${reservationId}`)
						}}
					>
						<LogOut className='size-4' /> Chiqish va to‘lov (demo)
					</Button>
				</Card>
			) : (
				<Button variant='outline' block onClick={() => setShowExitQr(true)}>
					<QrCode className='size-4 text-brand' /> Chiqish QR kodini ochish
				</Button>
			)}
		</>,
	)
}
