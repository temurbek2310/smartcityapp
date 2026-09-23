'use client'

import { LogOut, Plus, QrCode, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { BookingQrPanel } from '@/components/booking/booking-qr-panel'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { formatTime, formatUZS } from '@/lib/format'
import { reservationQrPayload, reservationReference } from '@/lib/booking-qr'
import type { Reservation } from '@/lib/types'

// City Goo pins the live booking to the top of the parking screen so the
// code, the bay and the three things you might do to it are reachable
// without navigating away. Reads the same reservations the Bron tab does —
// there is no second store.
export function ActiveBookingBanner({
	reservation,
	onNotify,
}: {
	reservation: Reservation
	onNotify: (message: string) => void
}) {
	const router = useRouter()
	const { extendReservation, cancelReservation } = useApp()
	const meta = useBookingMeta(reservation.id)
	const [sheet, setSheet] = useState<'qr' | 'cancel' | null>(null)

	const parking = getParking(reservation.parkingId)
	if (!parking) return null
	const reference = reservationReference(reservation)

	return (
		<>
			<Card className='border-[1.5px] border-brand'>
				<div className='flex items-center justify-between gap-3'>
					<Badge tone='brand'>Faol bron</Badge>
					<span className='font-mono text-[11px] font-bold text-ink-3'>
						{reference.value}
					</span>
				</div>

				<div className='mt-3 flex items-center gap-3'>
					{meta && (
						<div className='w-20 shrink-0 rounded-2xl bg-brand-50 px-2 py-2.5 text-center'>
							<p className='font-mono text-lg font-black text-brand'>
								{meta.bay}
							</p>
							<p className='mt-0.5 text-[10px] text-ink-3'>
								{meta.level}-daraja
							</p>
						</div>
					)}
					<div className='min-w-0 flex-1'>
						<p className='truncate text-[15px] font-extrabold text-ink'>
							{parking.name}
						</p>
						<p className='mt-1 text-[11.5px] text-ink-3'>
							{formatTime(reservation.startAt)} – {formatTime(reservation.endAt)}
							{' · '}
							{reservation.durationHours} soat
						</p>
						{meta && reservation.status === 'reserved' && (
							<p className='mt-1 text-[11px] text-ink-3'>
								Joyni yana {meta.holdMinutes} daqiqa ushlab turamiz
							</p>
						)}
					</div>
				</div>

				<div className='mt-3 grid grid-cols-3 gap-2'>
					<Button size='sm' variant='outline' onClick={() => setSheet('qr')}>
						<QrCode className='size-3.5' /> QR
					</Button>
					<Button
						size='sm'
						variant='outline'
						onClick={() => {
							extendReservation(reservation.id, 1)
							onNotify('Bron 1 soatga uzaytirildi')
						}}
						// Extending only means anything while the car is inside; a
						// reserved-but-not-entered booking is changed by rebooking.
						disabled={reservation.status !== 'active'}
					>
						<Plus className='size-3.5' /> 1 soat
					</Button>
					{/* Same rule as the Bron list: once the car is inside, the
					    booking is ended by leaving, not by cancelling it. */}
					{reservation.status === 'reserved' ? (
						<Button
							size='sm'
							variant='outline'
							danger
							onClick={() => setSheet('cancel')}
						>
							<X className='size-3.5' /> Bekor
						</Button>
					) : (
						<Button
							size='sm'
							variant='outline'
							onClick={() => router.push(`/reservation/${reservation.id}?exit=1`)}
						>
							<LogOut className='size-3.5' /> Chiqish
						</Button>
					)}
				</div>
			</Card>

			{sheet === 'qr' && (
				<BottomSheet title='Bron QR kodi' onClose={() => setSheet(null)}>
					<BookingQrPanel
						payload={reservationQrPayload(reservation)}
						reference={reference}
						instruction={
							parking.plateRecognition
								? 'Shlagbaum avtomobil raqami orqali ochiladi. QR — zaxira variant.'
								: 'Shlagbaumda shu QR kodni ko‘rsating.'
						}
					/>

					<Card className='mt-3'>
						<KeyValueList>
							<KeyValue label='Parking' value={parking.name} />
							{meta && (
								<KeyValue
									label='Joy'
									value={`${meta.bay} · ${meta.level}-daraja`}
								/>
							)}
							<KeyValue label='Kelish' value={formatTime(reservation.startAt)} />
							<KeyValue label='Tugash' value={formatTime(reservation.endAt)} />
							<KeyValue
								label='To‘langan'
								value={formatUZS(reservation.estimatedTotal)}
							/>
						</KeyValueList>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'cancel' && (
				<BottomSheet title='Bronni bekor qilish?' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Bron bekor qilinadi va joy darhol bo‘shatiladi. To‘lov 1–3 ish
							kuni ichida kartaga qaytariladi.
						</p>
					</Card>
					<div className='mt-4 grid grid-cols-2 gap-2'>
						<Button variant='outline' onClick={() => setSheet(null)}>
							Qoldirish
						</Button>
						<Button
							variant='primary'
							danger
							onClick={() => {
								cancelReservation(reservation.id)
								setSheet(null)
								onNotify('Bron bekor qilindi')
								router.refresh()
							}}
						>
							Bekor qilish
						</Button>
					</div>
				</BottomSheet>
			)}
		</>
	)
}
