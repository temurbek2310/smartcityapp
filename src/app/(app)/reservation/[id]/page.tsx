'use client'

import {
	CalendarClock,
	CheckCircle2,
	MapPin,
	Navigation,
	QrCode,
	Share2,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ActiveSessionPanel } from '@/components/parking/active-session-panel'
import { DirectionsSheet } from '@/components/parking/directions-sheet'
import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime, formatDuration, formatUZS } from '@/lib/format'
import { reservationCode, supersededReservationHref } from '@/lib/reservation'

export default function ReservationPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations, cancelReservation, enterReservation } = useApp()
	const toast = useToast<string>()

	const reservation = reservations.find(item => item.id === params.id)
	const parking = reservation ? getParking(reservation.parkingId) : undefined
	const meta = useBookingMeta(reservation?.id)

	// A finished booking is the one stage this page cannot describe — its
	// figures are the receipt's. Every other stage renders here, entry
	// included: one page, one booking, no screen to bounce to.
	const redirectTo = reservation ? supersededReservationHref(reservation) : null

	useEffect(() => {
		// replace, not push: there is no reason to leave a paid-up booking's
		// pre-payment page sitting in the stack behind its receipt.
		if (redirectTo) router.replace(redirectTo)
	}, [redirectTo, router])

	const [directionsOpen, setDirectionsOpen] = useState(false)

	// Deferred past the first paint so the countdown does not disagree between
	// the server's render and the client's.
	const [now, setNow] = useState<number | null>(null)
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

	const countdown =
		now === null ? 0 : new Date(reservation.startAt).getTime() - now

	const frame = (children: React.ReactNode) => (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar
					// One page, so the heading is what says which stage the booking
					// has reached. The panel's FAOL / VAQT TUGADI badge below keeps
					// the live detail; repeating it here would say it twice.
					title={
						reservation.status === 'active' ? 'Parking sessiyasi faol' : 'Bron'
					}
					subtitle={parking.name}
					onBack={() => router.push('/bookings')}
				/>
				{children}
			</div>
			{directionsOpen && (
				<DirectionsSheet
					parking={parking}
					reservationId={reservation.id}
					onClose={() => setDirectionsOpen(false)}
				/>
			)}
			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)

	// The effect above is already on its way there; this is the one frame in
	// between, and it deliberately shows none of the confirmation UI.
	if (redirectTo) {
		return frame(
			<Card className='text-center'>
				<p className='text-[12.5px] text-ink-3'>Yo‘naltirilmoqda…</p>
			</Card>,
		)
	}

	if (reservation.status === 'cancelled') {
		return frame(
			<EmptyState
				icon={X}
				title='Bron bekor qilingan'
				text='Bu QR endi parkingga kirish uchun yaroqli emas.'
				href='/parking'
				action='Yangi parking topish'
			/>,
		)
	}

	// The booking is the same thing before and after entry; what changes is
	// which of its actions are still ahead of the customer.
	const entered = reservation.status === 'active'

	// Shared by both stages. The clipboard needs a secure context and
	// permission, so a refusal falls back to putting the code in the toast.
	async function share() {
		const text = `${parking!.name} · ${reservationCode(reservation!.id)}`
		try {
			await navigator.clipboard.writeText(text)
			toast.show('Bron nusxalandi')
		} catch {
			toast.show(text)
		}
	}

	const directions = (
		<Button variant='outline' onClick={() => setDirectionsOpen(true)}>
			<Navigation className='size-4' /> Yo‘nalish
		</Button>
	)

	const shareAction = (
		<Button variant='outline' onClick={() => share()}>
			<Share2 className='size-4' /> Ulashish
		</Button>
	)

	// Entered: the booking's own detail, with the running session in place of
	// the confirmation it has already used up. The panel is the same code
	// /session/[id] used to be, so there is one clock and one exit, not two.
	if (entered) {
		return frame(
			<>
				<ActiveSessionPanel reservation={reservation} meta={meta} />

				<Card>
					<KeyValue
						label='Parking'
						value={
							<Link href={`/parking/${parking.id}`} className='text-brand'>
								{parking.name}
							</Link>
						}
					/>
					<KeyValue
						label='Kelish vaqti'
						value={formatDateTime(reservation.startAt)}
					/>
					<KeyValue
						label='Davomiylik'
						value={`${reservation.durationHours} soat`}
					/>
					<KeyValue label='Bron raqami' value={reservation.id.slice(-8).toUpperCase()} />
				</Card>

				<div className='grid grid-cols-2 gap-2'>
					{directions}
					{shareAction}
				</div>
			</>,
		)
	}

	return frame(
		<>
			<Card className='text-center'>
				<Badge tone='ok' className='mx-auto'>
					<CheckCircle2 className='size-3' /> Bron tasdiqlandi
				</Badge>

				<div className='mx-auto mt-4 w-fit rounded-card-lg border border-line bg-white p-3'>
					<QrImage value={reservationCode(reservation.id)} />
				</div>

				<p className='mt-3 text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'>
					Bron raqami
				</p>
				<p className='mt-1 break-all font-mono text-[12px] font-bold text-ink-2'>
					{reservation.id}
				</p>
				<p className='mt-2 text-[11.5px] text-ink-3'>
					Kodni kirishda ko‘rsating. Internetsiz ham ishlaydi.
				</p>
			</Card>

			<Card>
				<div className='flex items-start gap-3'>
					<IconTile tone='bg-brand-50 text-brand'>
						<CalendarClock className='size-[18px]' />
					</IconTile>
					<div className='min-w-0 flex-1'>
						<p className='text-[11.5px] text-ink-3'>Kelish vaqti</p>
						<p className='mt-0.5 text-[14px] font-bold text-ink'>
							{formatDateTime(reservation.startAt)}
						</p>
						<p className='mt-1 text-[11.5px] text-ink-3'>
							{countdown > 0
								? `Boshlanishigacha ${formatDuration(countdown)}`
								: 'Kirish oynasi ochiq — QRni skaner qiling.'}
						</p>
					</div>
				</div>

				<div className='mt-3 border-t border-line pt-1'>
					<KeyValue
						label='Parking'
						value={
							<Link href={`/parking/${parking.id}`} className='text-brand'>
								{parking.name}
							</Link>
						}
					/>
					{meta && <KeyValue label='Joy' value={`${meta.bay} · ${meta.level}-daraja`} />}
					<KeyValue label='Davomiylik' value={`${reservation.durationHours} soat`} />
					<KeyValue
						label='Hisoblangan narx'
						value={formatUZS(reservation.estimatedTotal)}
					/>
				</div>
			</Card>

			<Card variant='flat'>
				<p className='flex items-start gap-2 text-[11.5px] leading-5 text-ink-2'>
					<MapPin className='mt-0.5 size-3.5 shrink-0 text-ink-3' />
					{parking.entranceNote}
				</p>
			</Card>

			<div className='grid grid-cols-2 gap-2'>
				{directions}
				<Button
					variant='primary'
					onClick={() => {
						// No navigation: the booking is already on its own page, and
						// this page renders the session. Sending the customer to a
						// second screen and back was the whole friction.
						enterReservation(reservation.id)
					}}
				>
					<QrCode className='size-4' /> Kirishni boshlash
				</Button>
			</div>

			{/* Sharing moved here off the Bron summary card, which now only
			    summarises. */}
			<Button variant='outline' block onClick={() => share()}>
				<Share2 className='size-4' /> Ulashish
			</Button>

			{/* An entered booking has no cancel: the car is already inside, and
			    the way out is the exit QR the session panel draws. */}
			<Button
				variant='outline'
				danger
				block
				onClick={() => {
					cancelReservation(reservation.id)
					router.push('/bookings')
				}}
			>
				<X className='size-4' /> Bronni bekor qilish
			</Button>

			<p className='pb-2 text-center text-[11px] text-ink-3'>
				Joyni bron vaqtidan keyin 15 daqiqa ushlab turamiz.
			</p>
		</>,
	)
}
