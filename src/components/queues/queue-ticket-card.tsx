'use client'

import { Check, QrCode, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KeyValue, KeyValueList } from '@/components/ui/key-value'
import { Meter } from '@/components/ui/meter'
import { QrImage } from '@/components/ui/qr-image'
import { useApp } from '@/context/app-context'
import { cn } from '@/lib/cn'
import type { QueueOrg, QueueTicket } from '@/lib/types'

// The live ticket, or the button that creates one. City Goo gives this the
// top of the screen because it is the only thing on the page that is about
// *you* rather than about the organisation.
export function QueueTicketCard({
	org,
	ticket,
	onTake,
	onNotify,
}: {
	org: QueueOrg
	ticket: QueueTicket | undefined
	onTake: () => void
	onNotify: (message: string) => void
}) {
	const { advanceQueueTicket, completeQueueTicket, cancelQueueTicket } = useApp()
	const [sheet, setSheet] = useState<'qr' | 'cancel' | null>(null)

	if (!ticket) {
		return (
			<Card>
				<div className='flex items-center justify-between gap-3'>
					<p className='text-[15px] font-extrabold text-ink'>
						Elektron navbat
					</p>
					<Badge tone='gray'>{org.windows} ta oyna ishlamoqda</Badge>
				</div>
				<p className='mt-2 text-[12.5px] leading-5 text-ink-2'>
					Navbatni oldindan oling — kelguningizcha o‘rningiz saqlanadi va
					qachon chiqish kerakligini aytamiz.
				</p>
				<Button variant='primary' block className='mt-4' onClick={onTake}>
					Navbat olish
				</Button>
			</Card>
		)
	}

	const called = ticket.status === 'called'
	// How far through the queue: 0 people left reads as complete.
	const progress = ticket.initialPosition
		? ((ticket.initialPosition - ticket.position) / ticket.initialPosition) * 100
		: 100
	const service = org.services.find(item => item.id === ticket.serviceId)

	return (
		<>
			<Card className={cn('border-[1.5px]', called ? 'border-ok' : 'border-brand')}>
				<div className='flex items-center justify-between gap-3'>
					<Badge tone={called ? 'ok' : 'brand'}>
						{called ? 'Sizni chaqirishmoqda' : 'Siz navbatdasiz'}
					</Badge>
					<span className='truncate text-[11.5px] text-ink-3'>
						{service?.title}
					</span>
				</div>

				<div className='mt-3 flex items-center gap-3'>
					<div
						className={cn(
							'w-24 shrink-0 rounded-2xl px-2 py-3 text-center',
							called ? 'bg-ok-bg' : 'bg-brand-50',
						)}
					>
						<p
							className={cn(
								'font-mono text-2xl font-black',
								called ? 'text-ok' : 'text-brand',
							)}
						>
							{ticket.number}
						</p>
					</div>

					<div className='min-w-0 flex-1'>
						{called ? (
							<>
								<p className='text-[15px] font-extrabold text-ink'>
									{ticket.windowNumber}-oynaga o‘ting
								</p>
								<p className='mt-1 text-[11.5px] leading-4 text-ink-3'>
									Raqam chaqirilgandan keyin 5 daqiqa saqlanadi. Kechiksangiz
									navbatga qayta turishingiz mumkin.
								</p>
							</>
						) : (
							<>
								<p className='text-[15px] font-extrabold text-ink'>
									Oldingizda {ticket.position} kishi
								</p>
								<p className='mt-1 text-[11.5px] text-ink-3'>
									Taxminan {ticket.etaMinutes} daqiqadan keyin
								</p>
								<Meter
									value={progress}
									tone='bg-brand'
									height={5}
									className='mt-2'
								/>
							</>
						)}
					</div>
				</div>

				<div className='mt-3 grid grid-cols-3 gap-2'>
					<Button
						size='sm'
						variant='outline'
						disabled={called}
						onClick={() => advanceQueueTicket(ticket.id)}
					>
						<RefreshCw className='size-3.5' /> Yangilash
					</Button>
					<Button size='sm' variant='outline' onClick={() => setSheet('qr')}>
						<QrCode className='size-3.5' /> Talon
					</Button>
					<Button
						size='sm'
						variant='outline'
						danger
						onClick={() => setSheet('cancel')}
					>
						<X className='size-3.5' /> Bekor
					</Button>
				</div>

				{called && (
					<Button
						variant='primary'
						block
						className='mt-2'
						onClick={() => {
							completeQueueTicket(ticket.id)
							onNotify('Rahmat! Navbat yakunlandi')
						}}
					>
						<Check className='size-4' /> Men keldim
					</Button>
				)}
			</Card>

			{sheet === 'qr' && (
				<BottomSheet title='Talon' onClose={() => setSheet(null)}>
					<Card className='text-center'>
						<div className='mx-auto w-fit rounded-3xl border border-line bg-white p-3'>
							<QrImage value={`BSPACE:QUEUE:${ticket.id}`} size={170} />
						</div>
						<p className='mt-4 font-mono text-3xl font-black text-ink'>
							{ticket.number}
						</p>
						<p className='mt-2 text-[12.5px] text-ink-2'>
							Talonni oynada ko‘rsating. Internetsiz ham ishlaydi.
						</p>
					</Card>

					<Card className='mt-3'>
						<KeyValueList>
							<KeyValue label='Joy' value={org.title} />
							<KeyValue label='Xizmat' value={service?.title ?? '—'} />
							<KeyValue
								label='Oldingizda'
								value={`${ticket.position} kishi`}
							/>
							<KeyValue
								label='Taxminan'
								value={`${ticket.etaMinutes} daqiqa`}
							/>
							<KeyValue label='Oyna' value={`${ticket.windowNumber}-oyna`} />
						</KeyValueList>
					</Card>
				</BottomSheet>
			)}

			{sheet === 'cancel' && (
				<BottomSheet title='Navbatni bekor qilish?' onClose={() => setSheet(null)}>
					<Card>
						<p className='text-[13px] leading-5 text-ink-2'>
							Talon bekor qilinadi va uni tiklab bo‘lmaydi. Qaytadan navbat
							olsangiz, oxiridan boshlaysiz.
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
								cancelQueueTicket(ticket.id)
								setSheet(null)
								onNotify('Navbat bekor qilindi')
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
