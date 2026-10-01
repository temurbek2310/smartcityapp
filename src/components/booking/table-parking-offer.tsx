'use client'

import { CalendarClock, CircleParking } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { useApp } from '@/context/app-context'
import { getPlace } from '@/data/places'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { tableParkingHandoff } from '@/lib/booking-bridge'
import { saveBookingMeta } from '@/lib/booking-meta'
import { formatTime, formatUZS } from '@/lib/format'
import { isParkingStartPast } from '@/lib/parking-time'
import {
	findLiveReservationForParking,
	reservationHref,
} from '@/lib/reservation'
import type { ServiceBooking } from '@/lib/types'

// The space beside the table, one tap away. Shown on the table sheet's
// success view: nothing is chosen here, because everything — the lot, the
// start, the end and the bay — is read off the table just booked. The
// reservation itself is still made by the store's own createReservation(),
// which refuses a clash the same way the parking sheet's does.

export function TableParkingOffer({
	booking,
	onClose,
	onNotify,
}: {
	booking: ServiceBooking
	onClose: () => void
	onNotify: (message: string) => void
}) {
	const router = useRouter()
	const { createReservation, reservations } = useApp()
	// Two taps can land before the sheet unmounts; only a ref is already set
	// by the time the second handler runs.
	const submittingRef = useRef(false)
	const [submitting, setSubmitting] = useState(false)

	// The bay the customer already holds at this lot is never handed out
	// again — the same exclusion the parking sheet applies.
	const parkingId = getPlace(booking.refId)?.parkingId
	const held = findLiveReservationForParking(reservations, parkingId)
	const heldMeta = useBookingMeta(held?.id)
	const handoff = tableParkingHandoff(booking, reservations, {
		excludeBays: heldMeta ? [heldMeta.bay] : [],
	})
	if (!handoff) return null

	const { parking, bay, conflict } = handoff

	function book() {
		if (!handoff || !handoff.bay || handoff.conflict) return
		if (submittingRef.current) return
		if (isParkingStartPast(handoff.startAt, new Date().getTime())) {
			onNotify('Tanlangan kelish vaqti o‘tib ketgan')
			return
		}

		submittingRef.current = true
		setSubmitting(true)
		try {
			const attempt = createReservation({
				parkingId: handoff.parking.id,
				startAt: handoff.startAt,
				durationHours: handoff.durationHours,
				pricePerHour: handoff.pricePerHour,
			})
			if (!attempt.ok) {
				submittingRef.current = false
				setSubmitting(false)
				onNotify('Bu vaqtda sizda boshqa parking broni mavjud')
				return
			}
			saveBookingMeta(attempt.created.id, {
				bay: handoff.bay,
				level: handoff.level,
				holdMinutes: 15,
			})
			// The parking confirmation is the one with the gate QR — the page
			// the customer will need when they drive up.
			onClose()
			router.push(reservationHref(attempt.created))
		} catch {
			submittingRef.current = false
			setSubmitting(false)
			onNotify('Bron yaratilmadi. Profilga qayta kirib ko‘ring.')
		}
	}

	return (
		<>
			<Card className='mt-4 p-4'>
				<div className='flex items-center gap-3'>
					<IconTile size={44} tone='bg-brand-50 text-brand'>
						<CircleParking className='size-5' strokeWidth={2} />
					</IconTile>
					<div className='min-w-0 flex-1'>
						<p className='truncate text-sm font-black text-ink'>
							Yaqin parking: {parking.name}
						</p>
						<p className='mt-0.5 text-xs text-ink-3'>
							Aynan shu vaqtga avtoturargohdan joy band qilish
						</p>
					</div>
				</div>

				<KeyValueList className='mt-3'>
					<KeyValue
						label='Vaqt'
						value={`${formatTime(handoff.startAt)}–${formatTime(handoff.endAt)}`}
					/>
					{bay && <KeyValue label='Joy' value={`${bay} · ${handoff.level}-daraja`} />}
					<KeyValue
						label='Jami'
						value={handoff.estimatedTotal ? formatUZS(handoff.estimatedTotal) : 'Bepul'}
					/>
				</KeyValueList>
			</Card>

			{conflict ? (
				<div className='mt-3 rounded-card-lg bg-warn-bg p-4'>
					<div className='flex items-start gap-3'>
						<CalendarClock className='mt-0.5 size-4 shrink-0 text-warn' />
						<p className='min-w-0 flex-1 text-[13px] font-black text-ink'>
							Bu vaqtda sizda boshqa parking broni mavjud
						</p>
					</div>
					<Button
						variant='outline'
						block
						className='mt-3 h-10'
						onClick={() => {
							onClose()
							router.push(reservationHref(conflict))
						}}
					>
						Bronni ko‘rish
					</Button>
				</div>
			) : bay ? (
				<Button
					variant='primary'
					block
					className='mt-3 h-13'
					disabled={submitting}
					onClick={book}
				>
					Parkingni band qilish
				</Button>
			) : (
				<p className='mt-3 text-center text-[11.5px] text-ink-3'>
					Bu parkingda hozir bo‘sh joy yo‘q
				</p>
			)}
		</>
	)
}
