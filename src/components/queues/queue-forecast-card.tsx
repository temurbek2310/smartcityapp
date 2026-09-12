'use client'

import { useState } from 'react'

import { AiCallout } from '@/components/ui/ai-callout'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import type { QueueForecastPoint, QueueOrg } from '@/lib/types'

const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', bad: 'text-bad' } as const
const TONE_STROKE = {
	ok: 'var(--color-ok)',
	warn: 'var(--color-warn)',
	bad: 'var(--color-bad)',
} as const

// Unlike the parking forecast, City Goo draws this one as a trend line
// rather than bars — the question here is "is it getting better or worse",
// which a line answers and eight separate bars do not.
export function QueueForecastCard({
	org,
	onTake,
}: {
	org: QueueOrg
	onTake: () => void
}) {
	const [open, setOpen] = useState<number | null>(null)

	const points = org.forecast
	const max = Math.max(...points.map(point => point.waitMinutes), 1)
	const width = 280
	const height = 64
	const step = points.length > 1 ? width / (points.length - 1) : width

	const coords = points.map((point, index) => ({
		x: index * step,
		y: height - (point.waitMinutes / max) * (height - 8) - 4,
		point,
	}))
	const line = coords.map(c => `${c.x},${c.y}`).join(' ')
	const area = `0,${height} ${line} ${width},${height}`

	return (
		<>
			<Card>
				<p className='text-[14px] font-bold text-ink'>Kutish prognozi</p>

				<div className='mt-3 grid grid-cols-4 gap-2'>
					{points.map((point, index) => (
						<button
							key={point.inMinutes}
							type='button'
							onClick={() => setOpen(index)}
							className='rounded-xl bg-card-2 px-1 py-2 text-center'
						>
							<span className='block text-[10px] text-ink-3'>
								{point.inMinutes} daq keyin
							</span>
							<span className='mt-1 block text-[17px] font-black text-ink'>
								{point.waitMinutes}
							</span>
							<span
								className={cn(
									'mt-0.5 block text-[9.5px] font-bold',
									TONE_TEXT[point.tone],
								)}
							>
								{point.deltaLabel}
							</span>
						</button>
					))}
				</div>

				<svg
					viewBox={`0 0 ${width} ${height}`}
					className='mt-3 h-16 w-full'
					preserveAspectRatio='none'
					role='img'
					aria-label='Kutish vaqti tendensiyasi'
				>
					<polygon points={area} fill='var(--color-brand)' opacity='0.08' />
					<polyline
						points={line}
						fill='none'
						stroke='var(--color-brand)'
						strokeWidth='2'
						strokeLinecap='round'
						strokeLinejoin='round'
					/>
					{coords.map(c => (
						<circle
							key={c.x}
							cx={c.x}
							cy={c.y}
							r='3.5'
							fill='#fff'
							stroke={TONE_STROKE[c.point.tone]}
							strokeWidth='2.5'
						/>
					))}
				</svg>

				<AiCallout className='mt-3'>{org.tip}</AiCallout>
			</Card>

			{open !== null && (
				<ForecastDetailSheet
					point={points[open]}
					onClose={() => setOpen(null)}
					onTake={() => {
						setOpen(null)
						onTake()
					}}
				/>
			)}
		</>
	)
}

function ForecastDetailSheet({
	point,
	onClose,
	onTake,
}: {
	point: QueueForecastPoint
	onClose: () => void
	onTake: () => void
}) {
	const worsening = point.tone !== 'ok'

	return (
		<BottomSheet title={`${point.inMinutes} daqiqadan keyin`} onClose={onClose}>
			<Card className='text-center'>
				<p className={cn('text-[34px] font-black leading-none', TONE_TEXT[point.tone])}>
					{point.waitMinutes}
				</p>
				<p className='mt-1 text-[12.5px] text-ink-2'>daqiqa kutish</p>
				<p className={cn('mt-2 text-[12px] font-bold', TONE_TEXT[point.tone])}>
					{point.deltaLabel}
				</p>
			</Card>

			<Card className='mt-3'>
				<p className='text-[13px] leading-5 text-ink-2'>
					{worsening
						? 'Navbat uzayadi — hozir navbat olib qo‘yganingiz ma’qul.'
						: 'Navbat qisqaradi — kechroq chiqsangiz ham ulgurasiz.'}
				</p>
			</Card>

			<Button variant='primary' block className='mt-4' onClick={onTake}>
				Navbat olish
			</Button>
		</BottomSheet>
	)
}
