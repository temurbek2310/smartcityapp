'use client'

import {
	CalendarClock,
	CheckCircle2,
	CircleParking,
	MapPin,
	Navigation,
	QrCode,
	X,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue } from '@/components/ui/key-value'
import { QrImage } from '@/components/ui/qr-image'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { formatDateTime, formatDuration, formatUZS } from '@/lib/format'
import { reservationCode } from '@/lib/reservation'

export default function ReservationPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations, cancelReservation, enterReservation } = useApp()

	const reservation = reservations.find(item => item.id === params.id)
	const parking = reservation ? getParking(reservation.parkingId) : undefined
	const meta = useBookingMeta(reservation?.id)

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
					title='Bron'
					subtitle={parking.name}
					onBack={() => router.push('/bookings')}
				/>
				{children}
			</div>
		</div>
	)

	if (reservation.status === 'active') {
		return frame(
			<EmptyState
				icon={CircleParking}
				title='Bron faol sessiyaga aylandi'
				text='Avtomobil parkingda — taymer ishlamoqda.'
				href={`/session/${reservation.id}`}
				action='Faol sessiya'
			/>,
		)
	}

	if (reservation.status === 'completed') {
		return frame(
			<EmptyState
				icon={CheckCircle2}
				title='Sessiya yakunlangan'
				text='To‘lov amalga oshirildi — chekni ko‘rishingiz mumkin.'
				href={`/receipt/${reservation.id}`}
				action='Chekni ko‘rish'
			/>,
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
				<Button
					variant='outline'
					onClick={() => router.push(`/navigate/parking/${parking.id}`)}
				>
					<Navigation className='size-4' /> Yo‘nalish
				</Button>
				<Button
					variant='primary'
					onClick={() => {
						enterReservation(reservation.id)
						router.push(`/session/${reservation.id}`)
					}}
				>
					<QrCode className='size-4' /> Kirishni boshlash
				</Button>
			</div>

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
