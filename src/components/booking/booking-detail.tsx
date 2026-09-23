'use client'

import {
	CalendarDays,
	CalendarX,
	Navigation,
	Share2,
	Stethoscope,
	Ticket,
	Users,
	X,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { DirectionsSheet } from '@/components/navigation/directions-sheet'
import { AppBar } from '@/components/ui/app-bar'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Meter } from '@/components/ui/meter'
import { QrImage } from '@/components/ui/qr-image'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { getPlace } from '@/data/places'
import { getQueueOrg } from '@/data/queue-orgs'
import { useDirections } from '@/hooks/use-directions'
import { useToast } from '@/hooks/use-toast'
import {
	resolveBookingDetail,
	type BookingDetail as ResolvedBookingDetail,
	type BookingRow,
} from '@/lib/bookings'
import { formatDateTime } from '@/lib/format'
import type { ServiceBookingKind } from '@/lib/types'

// The detail page for every booking that is not parking. Queue tickets and
// the service bookings — a table, a film, a clinic slot, an event — used to
// have no page at all: tapping their card in Bron opened a QR modal, which
// was the only place their own information lived. Parking had a real page,
// so half the Booking Center behaved one way and half the other.
//
// Two routes render it, one per booking object: /booking/[id] for a
// ServiceBooking and /queue-ticket/[id] for a QueueTicket. Each reads only
// its own store. Parking keeps /reservation/[id]: it is the one booking with
// an entry/exit lifecycle, a running meter and two QRs, and this page would
// have to be a second implementation of it.

const KIND_ICON: Record<ServiceBookingKind | 'queue', LucideIcon> = {
	queue: Users,
	table: CalendarDays,
	cinema: Ticket,
	clinic: Stethoscope,
	event: Ticket,
}

const STATUS_TONE: Record<BookingRow['status'], BadgeTone> = {
	active: 'ok',
	upcoming: 'brand',
	done: 'gray',
	cancelled: 'gray',
}

export function BookingDetail({
	source,
	id,
}: {
	source: ResolvedBookingDetail['source']
	id: string | undefined
}) {
	const router = useRouter()
	const app = useApp()
	const { cancelQueueTicket, cancelServiceBooking } = app
	const toast = useToast<string>()
	const directions = useDirections()
	const [cancelOpen, setCancelOpen] = useState(false)

	// One normalisation, shared with the Bron list, so a card and its page can
	// never disagree about a booking's status, code or destination.
	const detail = resolveBookingDetail(app, source, id)
	const row = detail?.row
	const ticket = detail?.source === 'queue' ? detail.ticket : undefined
	const booking = detail?.source === 'service' ? detail.booking : undefined

	const frame = (children: React.ReactNode) => (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar
					title={row?.title ?? 'Bron'}
					subtitle={row?.subtitle}
					onBack={() => router.push('/bookings')}
				/>
				{children}
			</div>

			<DirectionsSheet
				destinationId={directions.destinationId}
				onClose={directions.close}
			/>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)

	// A stale link, a cleared device or an id from the other store: say so
	// rather than render an empty shell.
	if (!row) {
		return frame(
			<EmptyState
				icon={CalendarX}
				title='Bron topilmadi'
				text='Bu bron bekor qilingan yoki o‘chirilgan bo‘lishi mumkin.'
				href='/bookings'
				action='Bronlarga qaytish'
			/>,
		)
	}

	const org = ticket ? getQueueOrg(ticket.orgId) : undefined
	const service = org?.services.find(item => item.id === ticket?.serviceId)
	const place = booking ? getPlace(booking.refId) : undefined
	const Icon = KIND_ICON[row.kind === 'parking' ? 'table' : row.kind]

	async function share() {
		const text = `${row!.title} · ${row!.code}`
		try {
			await navigator.clipboard.writeText(text)
			toast.show('Bron nusxalandi')
		} catch {
			// Clipboard needs a secure context and permission; the code is on
			// screen either way.
			toast.show(text)
		}
	}

	function cancel() {
		if (ticket) cancelQueueTicket(ticket.id)
		else if (booking) cancelServiceBooking(booking.id)
		setCancelOpen(false)
		toast.show('Bron bekor qilindi')
	}

	// Only while the ticket is live: a served or cancelled number has no
	// position left to report, and its stored one is whatever it was at close.
	const queueLive =
		ticket && (ticket.status === 'waiting' || ticket.status === 'called')
	const progress =
		ticket && ticket.initialPosition
			? ((ticket.initialPosition - ticket.position) / ticket.initialPosition) * 100
			: 100

	return frame(
		<>
			<Card className='text-center'>
				<div className='flex items-center justify-center gap-2'>
					<Badge tone={STATUS_TONE[row.status]}>{row.statusLabel}</Badge>
				</div>
				{row.qrValue && (
					<div className='mx-auto mt-4 w-fit rounded-3xl border border-line bg-white p-3'>
						<QrImage value={row.qrValue} size={170} />
					</div>
				)}
				<p className='mt-4 font-mono text-3xl font-black text-ink'>{row.code}</p>
				<p className='mt-2 text-[12.5px] text-ink-2'>
					{ticket
						? 'Talonni oynada ko‘rsating. Internetsiz ham ishlaydi.'
						: 'Kodni joyida ko‘rsating. Internetsiz ham ishlaydi.'}
				</p>
			</Card>

			{/* How far through the line this number is — the one thing a queue
			    has that the other bookings do not. */}
			{ticket && queueLive && (
				<Card>
					<div className='flex items-center justify-between gap-3'>
						<div>
							<p className='text-[11.5px] text-ink-3'>Oldingizda</p>
							<p className='mt-0.5 text-[16px] font-black text-ink'>
								{ticket.position} kishi
							</p>
						</div>
						<div className='text-right'>
							<p className='text-[11.5px] text-ink-3'>Taxminan</p>
							<p className='mt-0.5 text-[16px] font-black text-ink'>
								{ticket.etaMinutes} daqiqa
							</p>
						</div>
					</div>
					<Meter value={progress} className='mt-3' height={5} />
				</Card>
			)}

			<Card>
				<KeyValueList>
					<KeyValue
						label={ticket ? 'Joy' : 'Manzil'}
						value={
							place ? (
								<Link href={`/home?place=${place.id}`} className='text-brand'>
									{place.title}
								</Link>
							) : (
								(org?.title ?? row.title)
							)
						}
					/>
					{ticket && <KeyValue label='Xizmat' value={service?.title ?? '—'} />}
					{ticket && (
						<KeyValue label='Oyna' value={`${ticket.windowNumber}-oyna`} />
					)}
					{booking && <KeyValue label='Tafsilot' value={booking.subtitle} />}
					<KeyValue label='Vaqt' value={row.whenLabel} />
					{(org?.address ?? place?.address) && (
						<KeyValue
							label='Manzil'
							value={org?.address ?? place?.address ?? ''}
						/>
					)}
					<KeyValue
						label='Yaratilgan'
						value={formatDateTime(ticket?.createdAt ?? booking!.createdAt)}
					/>
				</KeyValueList>
			</Card>

			<div className='space-y-2'>
				{/* Resolved by the shared destination model when the booking
				    names somewhere real, and simply absent when it does not. */}
				{row.destinationId && (
					<Button
						variant='primary'
						block
						onClick={() => directions.openId(row.destinationId)}
					>
						<Navigation className='size-4' /> Yo‘nalish
					</Button>
				)}

				<Button variant='outline' block onClick={() => share()}>
					<Share2 className='size-4' /> Ulashish
				</Button>

				{ticket && (
					<Button
						variant='outline'
						block
						onClick={() => router.push(`/queues?org=${ticket.orgId}`)}
					>
						<Icon className='size-4 text-brand' /> Navbatni kuzatish
					</Button>
				)}

				{row.cancellable && (
					<Button
						variant='outline'
						danger
						block
						onClick={() => setCancelOpen(true)}
					>
						<X className='size-4' /> Bronni bekor qilish
					</Button>
				)}
			</div>

			{cancelOpen && (
				<BottomSheet
					title='Bronni bekor qilish?'
					onClose={() => setCancelOpen(false)}
				>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							{row.code} bekor qilinadi.
							{ticket &&
								' Talonni tiklab bo‘lmaydi — qaytadan navbat olishingiz kerak.'}
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setCancelOpen(false)}>
							Qoldirish
						</Button>
						<Button variant='primary' danger onClick={cancel}>
							Bekor qilish
						</Button>
					</div>
				</BottomSheet>
			)}
		</>,
	)
}
