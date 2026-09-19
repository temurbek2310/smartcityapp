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
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KeyValue } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { cn } from '@/lib/cn'
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

	// «Chiqish» on the Bron row and on the parking banner opens the exit sheet
	// directly, so ending a session is one tap from wherever it is shown.
	// Read off location rather than through useSearchParams(), the way
	// AuthGate does, so this page keeps its own rendering mode.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (new URLSearchParams(window.location.search).get('exit') === '1') {
				setShowExitQr(true)
			}
		}, 0)
		return () => window.clearTimeout(timer)
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
				text="To'lov amalga oshirildi."
				href={`/receipt/${reservation.id}`}
				action="Chekni ko'rish"
			/>,
		)
	}

	if (reservation.status !== 'active') {
		return frame(
			<EmptyState
				icon={CircleParking}
				title='Bron hali faol emas'
				text="Parkingga kirganingizdan so'ng taymer ishga tushadi."
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
			<Card
				className={
					overstayed ? 'border-[1.5px] border-bad' : 'border-[1.5px] border-brand'
				}
			>
				{/* Header: badge + id snippet */}
				<div className='flex items-center justify-between gap-3'>
					<Badge tone={overstayed ? 'bad' : 'ok'}>
						<span
							className={`size-1.5 rounded-full ${overstayed ? 'bg-bad' : 'animate-pulse bg-ok'}`}
						/>
						{overstayed ? 'VAQT TUGADI' : 'FAOL'}
					</Badge>
					<span className='font-mono text-[11px] font-bold text-ink-3'>
						{reservation.id.slice(-8).toUpperCase()}
					</span>
				</div>

				{/* Identity row: bay/level box + plate + entry time */}
				{meta && (
					<div className='mt-3 flex items-center gap-3'>
						<div className='w-20 shrink-0 rounded-2xl bg-brand-50 px-2 py-2.5 text-center'>
							<p className='font-mono text-lg font-black text-brand'>
								{meta.bay}
							</p>
							<p className='mt-0.5 text-[10px] text-ink-3'>
								{meta.level}-daraja
							</p>
						</div>
						<div className='min-w-0 flex-1'>
							<p className='truncate text-[15px] font-extrabold text-ink'>
								{formatUzbekPlate(reservation.vehiclePlate)}
							</p>
							<p className='mt-1 text-[11.5px] text-ink-3'>
								Kirish {formatTime(
									reservation.enteredAt ?? reservation.startAt,
								)}
							</p>
						</div>
					</div>
				)}

				{/* Countdown centerpiece */}
				<div className='mt-5 text-center'>
					<Clock3
						className={cn(
							'mx-auto size-6',
							overstayed ? 'text-bad' : 'text-brand',
						)}
					/>
					<p className='mt-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'>
						{overstayed ? 'Ortiqcha vaqt' : 'Qolgan vaqt'}
					</p>
					<p
						className={cn(
							'mt-2 font-mono text-[40px] font-black leading-none tracking-tight',
							overstayed ? 'text-bad' : 'text-ink',
						)}
					>
						{formatDuration(Math.abs(remaining))}
					</p>
				</div>

				{/* Footer divider row */}
				<div className='mt-5 flex items-center justify-between border-t border-line pt-3.5 text-[13px]'>
					<span className='text-ink-3'>Tugash vaqti</span>
					<b className='text-ink'>{formatTime(reservation.endAt)}</b>
				</div>

				{/* Action buttons */}
				<div className='mt-4 grid grid-cols-2 gap-2'>
					<Button
						size='sm'
						variant='outline'
						onClick={() => extendReservation(reservation.id, 1)}
					>
						<Plus className='size-3.5 text-brand' /> +1 soat
					</Button>
					<Button
						size='sm'
						variant='outline'
						onClick={() => setShowExitQr(true)}
					>
						<QrCode className='size-3.5 text-brand' /> Chiqish QR
					</Button>
				</div>

				{/* Demo note */}
				<p className='mt-2 text-center text-[11px] text-ink-3'>
					Demo: bo‘sh joy tekshiruvi avtomatik mavjud deb hisoblanadi.
				</p>
			</Card>

			{/* Billing card */}
			<Card>
				<KeyValue label='Soatlik tarif' value={formatUZS(reservation.pricePerHour)} />
				<KeyValue label='Joriy hisob' value={formatUZS(runningTotal)} />
			</Card>

			{/* Exit QR sheet */}
			{showExitQr && (
				<BottomSheet title='Chiqish QR kodi' onClose={() => setShowExitQr(false)}>
					<Card className='text-center'>
						<div className='mx-auto w-fit rounded-3xl border border-line bg-white p-3'>
							<QrImage value={`BSPACE:EXIT:${reservation.id}`} size={190} />
						</div>
						<p className='mt-3 text-[11.5px] text-ink-3'>
							Shlagbaum skaneri o‘rniga demo simulyator ishlaydi.
						</p>
					</Card>
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
				</BottomSheet>
			)}
		</>,
	)
}
