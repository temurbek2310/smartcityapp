'use client'

import { LocateFixed, MapPinOff } from 'lucide-react'
import { useState } from 'react'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { locationProblem, type LocationState } from '@/lib/location'

// SmartCity's own explanation, shown before the browser's permission prompt
// and instead of it when the browser will not show one.
export function LocationPermissionSheet({
	kind,
	state,
	onAllow,
	onRecheck,
	onClose,
}: {
	kind: 'explain' | 'denied' | 'unsupported'
	state: LocationState
	onAllow: () => void
	onRecheck: () => Promise<void>
	onClose: () => void
}) {
	const [checked, setChecked] = useState(false)

	if (kind === 'explain') {
		return (
			<BottomSheet title='Joylashuvga ruxsat' onClose={onClose}>
				<Card className='flex items-start gap-3'>
					<span className='grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand'>
						<LocateFixed className='size-5' />
					</span>
					<p className='text-[13.5px] leading-5 text-ink-2'>
						Yaqin joylarni ko‘rsatish va marshrutni aniq boshlash uchun
						joylashuvingiz kerak.
					</p>
				</Card>
				<p className='mt-3 px-1 text-[11.5px] leading-4 text-ink-3'>
					Joylashuv faqat shu seans davomida ishlatiladi va saqlanmaydi.
				</p>
				<div className='mt-4 grid gap-2'>
					<Button variant='primary' block onClick={onAllow}>
						Ruxsat berish
					</Button>
					<Button block onClick={onClose}>
						Hozir emas
					</Button>
				</div>
			</BottomSheet>
		)
	}

	if (kind === 'unsupported') {
		return (
			<BottomSheet title='Joylashuv mavjud emas' onClose={onClose}>
				<Card className='text-[13.5px] leading-5 text-ink-2'>
					Bu brauzer geolokatsiyani qo‘llamaydi. Manzilni qo‘lda tanlashingiz
					mumkin.
				</Card>
				<Button block className='mt-4' onClick={onClose}>
					Yopish
				</Button>
			</BottomSheet>
		)
	}

	const problem = locationProblem(state)
	return (
		<BottomSheet title='Joylashuvga ruxsat berilmagan' onClose={onClose}>
			<Card className='flex items-start gap-3'>
				<span className='grid size-11 shrink-0 place-items-center rounded-2xl bg-warn-bg text-warn'>
					<MapPinOff className='size-5' />
				</span>
				<div className='text-[13.5px] leading-5 text-ink-2'>
					<p>Joylashuvni brauzer sozlamalaridan yoqishingiz mumkin.</p>
					<p className='mt-2 text-[12px] leading-4 text-ink-3'>
						Manzil satridagi qulf belgisini bosing → «Joylashuv» → «Ruxsat
						berish». Brauzer bu so‘rovni sahifadan qayta ochishga ruxsat
						bermaydi.
					</p>
				</div>
			</Card>
			{checked && problem && (
				<p role='status' className='mt-3 px-1 text-[12px] font-semibold text-warn'>
					Ruxsat hali ham o‘chirilgan.
				</p>
			)}
			<div className='mt-4 grid gap-2'>
				<Button
					variant='primary'
					block
					onClick={async () => {
						await onRecheck()
						setChecked(true)
					}}
				>
					Qayta tekshirish
				</Button>
				<Button block onClick={onClose}>
					Yopish
				</Button>
			</div>
		</BottomSheet>
	)
}
