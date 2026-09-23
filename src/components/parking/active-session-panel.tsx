'use client'

import { Clock3, LogOut, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KeyValue } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { useApp } from '@/context/app-context'
import { ACTION_LABELS } from '@/lib/booking-journey'
import { cn } from '@/lib/cn'
import { formatDuration, formatTime, formatUZS } from '@/lib/format'
import type { ParkingBookingMeta } from '@/lib/booking-meta'
import { displayUzbekPlate } from '@/lib/plate'
import { calculateFinalTotal } from '@/lib/reservation'
import type { Reservation } from '@/lib/types'

// The running half of a parking booking: the clock, the bill as it grows and
// the way out. This was the whole of /session/[id]. It lives here because the
// booking detail page is where a customer meets it now, and because a second
// copy of the timer, the running total or the exit is exactly the kind of
// drift that ends with two screens disagreeing about what a session costs.
export function ActiveSessionPanel({
	reservation,
	meta,
}: {
	reservation: Reservation
	meta: ParkingBookingMeta | null
}) {
	const router = useRouter()
	const { extendReservation, exitReservation } = useApp()

	// Deferred past the first paint so the countdown does not disagree between
	// the server's render and the client's.
	const [now, setNow] = useState<number | null>(null)
	const [showExitQr, setShowExitQr] = useState(false)

	// «Chiqish» on the parking banner links straight at the exit, so ending a
	// session stays one tap from wherever it is shown. Read off location
	// rather than through useSearchParams(), the way AuthGate does, so the
	// page hosting this panel keeps its own rendering mode.
	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (new URLSearchParams(window.location.search).get('exit') === '1') {
				setShowExitQr(true)
			}
		}, 0)
		return () => window.clearTimeout(timer)
	}, [])

	useEffect(() => {
		const update = () => setNow(Date.now())
		const initial = window.setTimeout(update, 0)
		const interval = window.setInterval(update, 1000)
		return () => {
			window.clearTimeout(initial)
			window.clearInterval(interval)
		}
	}, [])

	const reservationId = reservation.id
	const remaining = now === null ? 0 : new Date(reservation.endAt).getTime() - now
	const overstayed = remaining <= 0

	// Billed by the hour from entry, so it only matches estimatedTotal while
	// the car sits inside its booked duration.
	const runningTotal =
		now === null
			? reservation.estimatedTotal
			: calculateFinalTotal(reservation, new Date(now))

	return (
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
								{displayUzbekPlate(reservation.vehiclePlate)}
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

				<Button
					size='sm'
					variant='outline'
					block
					className='mt-4'
					onClick={() => extendReservation(reservation.id, 1)}
				>
					<Plus className='size-3.5 text-brand' /> {ACTION_LABELS.extend}
				</Button>

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

			{/* The one way out, and the only place the exit QR is drawn — the
			    active session's primary action in reservationJourney(). */}
			<Button variant='primary' block onClick={() => setShowExitQr(true)}>
				<LogOut className='size-4' /> {ACTION_LABELS.exit}
			</Button>

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
							// replace: the booking is paid up, and its detail page would
							// only redirect here again. Back belongs to Bron.
							router.replace(`/receipt/${reservationId}`)
						}}
					>
						<LogOut className='size-4' /> Chiqish va to‘lov (demo)
					</Button>
				</BottomSheet>
			)}
		</>
	)
}
