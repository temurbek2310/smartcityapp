import type { ReactNode } from 'react'

import { Card } from '@/components/ui/card'
import { QrImage } from '@/components/ui/qr-image'
import type { BookingReference } from '@/lib/booking-qr'
import { cn } from '@/lib/cn'

// The one way a booking's QR is drawn — on its detail page, in the large
// «Bronni ko‘rsatish» sheet, on the parking banner and at the exit gate.
// Only the presentation is shared: the QR itself, the human reference under
// it and one line of instruction. Everything a family has of its own — a
// queue's position, a parking bay, the session clock — stays on its screen
// around this card.
//
// The payload comes from lib/booking-qr and nowhere else. A null payload
// (a booking whose id cannot be encoded) draws the reference without a QR
// rather than a QR for something invented.

const SIZES = { inline: 180, large: 220 } as const

// What each family asks the customer to do with it.
export const QR_INSTRUCTIONS = {
	reservation: 'Kodni kirishda ko‘rsating. Internetsiz ham ishlaydi.',
	queue: 'Talonni oynada ko‘rsating. Internetsiz ham ishlaydi.',
	booking: 'Kodni joyida ko‘rsating. Internetsiz ham ishlaydi.',
} as const

export function BookingQrPanel({
	payload,
	reference,
	instruction,
	size = 'inline',
	header,
	className,
}: {
	payload: string | null
	reference: BookingReference
	instruction: ReactNode
	size?: keyof typeof SIZES
	// A status badge or similar, drawn above the QR.
	header?: ReactNode
	className?: string
}) {
	return (
		<Card className={cn('text-center', className)}>
			{header}
			{payload && (
				<div
					className={cn(
						'mx-auto w-fit rounded-3xl border border-line bg-white p-3',
						header ? 'mt-4' : undefined,
					)}
				>
					<QrImage value={payload} size={SIZES[size]} />
				</div>
			)}
			<p className='mt-4 text-[11px] font-bold uppercase tracking-[.16em] text-ink-3'>
				{reference.label}
			</p>
			<p className='mt-1 font-mono text-3xl font-black text-ink'>
				{reference.value}
			</p>
			<p className='mt-2 text-[12.5px] text-ink-2'>{instruction}</p>
		</Card>
	)
}
