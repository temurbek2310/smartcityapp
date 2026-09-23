'use client'

import {
	CalendarDays,
	CalendarX,
	Check,
	Navigation,
	QrCode,
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

import {
	BookingQrPanel,
	QR_INSTRUCTIONS,
} from '@/components/booking/booking-qr-panel'
import { AppBar } from '@/components/ui/app-bar'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Meter } from '@/components/ui/meter'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { getPlace } from '@/data/places'
import { getQueueOrg } from '@/data/queue-orgs'
import { useClock } from '@/hooks/use-clock'
import { useDirections } from '@/hooks/use-directions'
import { useToast } from '@/hooks/use-toast'
import {
	ACTION_LABELS,
	presentActionLabel,
	queueTicketJourney,
	serviceBookingJourney,
	type BookingActionId,
} from '@/lib/booking-journey'
import { isQueueTicketLive } from '@/lib/booking-lifecycle'
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
	const { cancelQueueTicket, cancelServiceBooking, arriveQueueTicket } = app
	const toast = useToast<string>()
	const directions = useDirections()
	const [cancelOpen, setCancelOpen] = useState(false)
	const [presentOpen, setPresentOpen] = useState(false)
	// Minute precision is all the arrival window needs; the tick is only here
	// so a page left open moves its primary action across the threshold.
	const now = useClock(30_000)

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
	const reference = { label: row.codeLabel, value: row.code }
	const instruction = ticket ? QR_INSTRUCTIONS.queue : QR_INSTRUCTIONS.booking

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
	const queueLive = ticket && isQueueTicketLive(ticket.status)
	const checkedIn = ticket?.status === 'arrived'
	// Which action leads right now — derived from status, start time (or the
	// queue's estimate) and the clock, never stored.
	const availability = { hasDestination: Boolean(row.destinationId) }
	const journey = ticket
		? queueTicketJourney(ticket, availability)
		: serviceBookingJourney(booking!, now, availability)
	const supporting = journey.secondary.filter(
		id => id !== 'cancel' || row.cancellable,
	)

	function action(id: BookingActionId, primary = false) {
		const variant = primary ? 'primary' : 'outline'
		const icon = primary ? 'size-4' : 'size-4 text-brand'
		switch (id) {
			// Resolved by the shared destination model when the booking names
			// somewhere real, and simply absent when it does not.
			case 'directions':
				return (
					<Button
						key={id}
						variant={variant}
						block
						onClick={() => directions.openId(row!.destinationId)}
					>
						<Navigation className='size-4' /> {ACTION_LABELS.directions}
					</Button>
				)
			// The code staff will scan, drawn large — the arrival action for the
			// bookings that have no check-in of their own.
			case 'present':
				return booking && row!.qrValue ? (
					<Button
						key={id}
						variant={variant}
						block
						onClick={() => setPresentOpen(true)}
					>
						<QrCode className='size-4' /> {presentActionLabel(booking.kind)}
					</Button>
				) : null
			// The queue card's own «Men keldim», offered here once the number
			// is called. It checks the customer in — the ticket stays live
			// until the service itself is done.
			case 'arrived':
				return ticket ? (
					<Button
						key={id}
						variant={variant}
						block
						onClick={() => {
							arriveQueueTicket(ticket.id)
							toast.show('Kelganingiz qayd etildi')
						}}
					>
						<Check className='size-4' /> {ACTION_LABELS.arrived}
					</Button>
				) : null
			case 'track':
				return ticket ? (
					<Button
						key={id}
						variant={variant}
						block
						onClick={() => router.push(`/queues?org=${ticket.orgId}`)}
					>
						<Icon className={icon} /> {ACTION_LABELS.track}
					</Button>
				) : null
			case 'share':
				return (
					<Button key={id} variant={variant} block onClick={() => share()}>
						<Share2 className='size-4' /> {ACTION_LABELS.share}
					</Button>
				)
			case 'cancel':
				return (
					<Button
						key={id}
						variant='outline'
						danger
						block
						onClick={() => setCancelOpen(true)}
					>
						<X className='size-4' /> {ACTION_LABELS.cancel}
					</Button>
				)
			default:
				return null
		}
	}

	const progress =
		ticket && ticket.initialPosition
			? ((ticket.initialPosition - ticket.position) / ticket.initialPosition) * 100
			: 100

	return frame(
		<>
			<BookingQrPanel
				header={
					<div className='flex items-center justify-center gap-2'>
						<Badge tone={STATUS_TONE[row.status]}>{row.statusLabel}</Badge>
					</div>
				}
				payload={row.qrValue ?? null}
				reference={reference}
				instruction={instruction}
			/>

			{/* How far through the line this number is — the one thing a queue
			    has that the other bookings do not. */}
			{/* Checked in: the line no longer matters, the window does. */}
			{ticket && checkedIn && (
				<Card>
					<div className='flex items-center justify-between gap-3'>
						<div>
							<p className='text-[11.5px] text-ink-3'>Holat</p>
							<p className='mt-0.5 text-[16px] font-black text-ink'>
								Xizmat kutilmoqda
							</p>
						</div>
						<div className='text-right'>
							<p className='text-[11.5px] text-ink-3'>Oyna</p>
							<p className='mt-0.5 text-[16px] font-black text-ink'>
								{ticket.windowNumber}-oyna
							</p>
						</div>
					</div>
				</Card>
			)}

			{ticket && queueLive && !checkedIn && (
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

			{/* One filled action for what the customer most likely needs now;
			    everything else stays reachable underneath as outlines. */}
			<div className='space-y-2'>
				{journey.primary && action(journey.primary, true)}
				{supporting.map(id => action(id))}
			</div>

			{presentOpen && booking && row.qrValue && (
				<BottomSheet
					title={presentActionLabel(booking.kind)}
					onClose={() => setPresentOpen(false)}
				>
					<BookingQrPanel
						size='large'
						payload={row.qrValue}
						reference={reference}
						instruction={instruction}
					/>
				</BottomSheet>
			)}

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
