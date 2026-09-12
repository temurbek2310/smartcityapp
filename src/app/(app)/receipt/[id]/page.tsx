'use client'

import { CheckCircle2, CreditCard, ReceiptText, Share2 } from 'lucide-react'
import { notFound, useParams, useRouter } from 'next/navigation'

import { AppBar } from '@/components/ui/app-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { KeyValue } from '@/components/ui/key-value'
import { Toast } from '@/components/ui/toast'
import { useApp } from '@/context/app-context'
import { getParking } from '@/data/parkings'
import { useBookingMeta } from '@/hooks/use-booking-meta'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime, formatUZS } from '@/lib/format'
import { formatUzbekPlate } from '@/lib/plate'

export default function ReceiptPage() {
	const params = useParams<{ id: string }>()
	const router = useRouter()
	const { reservations } = useApp()
	const toast = useToast<string>()

	const reservation = reservations.find(item => item.id === params.id)
	const parking = reservation ? getParking(reservation.parkingId) : undefined
	const meta = useBookingMeta(reservation?.id)

	if (!reservation || !parking) notFound()

	const total = reservation.finalTotal ?? reservation.estimatedTotal

	async function share() {
		const text = `${parking!.name} · ${formatUZS(total)} · ${reservation!.id}`
		try {
			await navigator.clipboard.writeText(text)
			toast.show('Chek nusxalandi')
		} catch {
			// Clipboard needs a secure context and permission; the figures are
			// on screen either way.
			toast.show(text)
		}
	}

	return (
		<div className='-mx-5 -mt-6 min-h-[calc(100dvh-var(--spacing-nav))] bg-canvas pb-28 pt-5'>
			<div className='mx-auto w-full max-w-md space-y-3 px-4'>
				<AppBar
					title='Chek'
					subtitle={parking.name}
					onBack={() => router.push('/bookings')}
				/>

				<Card className='text-center'>
					<Badge tone='ok' className='mx-auto'>
						<CheckCircle2 className='size-3' /> To‘lov muvaffaqiyatli
					</Badge>
					<p className='mt-3 text-[34px] font-black leading-none tracking-[-0.02em] text-ink'>
						{formatUZS(total)}
					</p>
					<p className='mt-2 text-[11.5px] text-ink-3'>
						Demo to‘lov — hech qanday real mablag‘ yechilmadi.
					</p>
				</Card>

				<Card>
					<div className='flex items-center gap-3 border-b border-line pb-3'>
						<IconTile tone='bg-card-2 text-ink-2'>
							<ReceiptText className='size-[18px]' />
						</IconTile>
						<div className='min-w-0 flex-1'>
							<p className='truncate text-[14px] font-bold text-ink'>
								{parking.name}
							</p>
							<p className='mt-0.5 text-[11.5px] text-ink-3'>
								{reservation.exitedAt
									? formatDateTime(reservation.exitedAt)
									: 'Sessiya yakunlandi'}
							</p>
						</div>
					</div>

					<div className='pt-1'>
						<KeyValue
							label='Bron'
							value={
								<span className='font-mono text-[11px]'>{reservation.id}</span>
							}
						/>
						<KeyValue
							label='Avtomobil'
							value={formatUzbekPlate(reservation.vehiclePlate)}
						/>
						{meta && (
							<KeyValue label='Joy' value={`${meta.bay} · ${meta.level}-daraja`} />
						)}
						<KeyValue
							label='Soatlik tarif'
							value={formatUZS(reservation.pricePerHour)}
						/>
						<KeyValue
							label='Davomiylik'
							value={`${reservation.durationHours} soat`}
						/>
						<KeyValue
							label={<b className='text-ink'>Jami to‘langan</b>}
							value={<b className='text-ink'>{formatUZS(total)}</b>}
						/>
					</div>

					<div className='mt-3 flex items-center gap-3 rounded-card-lg bg-card-2 p-3'>
						<CreditCard className='size-[18px] shrink-0 text-ink-2' />
						<div>
							<p className='text-[11px] text-ink-3'>To‘lov usuli</p>
							<p className='text-[13px] font-bold text-ink'>
								B SPACE Demo •••• 4242
							</p>
						</div>
					</div>
				</Card>

				<div className='grid grid-cols-2 gap-2'>
					<Button variant='outline' onClick={share}>
						<Share2 className='size-4' /> Ulashish
					</Button>
					<Button variant='primary' onClick={() => router.push('/bookings')}>
						Bronlar tarixi
					</Button>
				</div>
			</div>

			<Toast open={toast.open} message={toast.payload ?? ''} />
		</div>
	)
}
