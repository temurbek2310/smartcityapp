'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { AiCallout } from '@/components/ui/ai-callout'
import { BarChart } from '@/components/ui/bar-chart'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { occupancyTone } from '@/lib/availability'
import {
	bestForecastSlot,
	occupancyForecast,
	peakForecastSlot,
} from '@/lib/occupancy-forecast'
import type { Parking } from '@/lib/types'

// City Goo's "Прогноз заполняемости": pick a lot, read the day as bars, and
// get one sentence telling you when to turn up. The numbers are demo data
// derived from each lot's peakProfile — labelled, because a forecast that
// looks measured but is not would be worse than none.
export function OccupancyForecastCard({
	parkings,
	selected,
	onSelect,
	onBook,
}: {
	parkings: Parking[]
	selected: Parking
	onSelect: (parkingId: string) => void
	onBook: (parkingId: string) => void
}) {
	const [sheet, setSheet] = useState<'picker' | number | null>(null)

	const points = occupancyForecast(selected)
	const best = bestForecastSlot(points)
	const peak = peakForecastSlot(points)

	return (
		<>
			<Card>
				<div className='flex items-center justify-between gap-3'>
					<div className='min-w-0'>
						<p className='text-[14px] font-bold text-ink'>Bandlik prognozi</p>
						<p className='mt-0.5 text-[11px] text-ink-3'>Namunaviy ma’lumot</p>
					</div>
					<button
						type='button'
						onClick={() => setSheet('picker')}
						className='flex min-w-0 shrink items-center gap-1 rounded-[10px] bg-card-2 px-2.5 py-1.5 text-[11.5px] font-bold text-ink-2'
					>
						<span className='truncate'>{selected.name}</span>
						<ChevronDown className='size-3.5 shrink-0' />
					</button>
				</div>

				<BarChart
					className='mt-4'
					bars={points.map(point => ({
						label: point.label,
						value: point.percent,
						tone: occupancyTone(point.percent),
					}))}
					onSelect={index => setSheet(index)}
				/>

				<AiCallout className='mt-4'>
					Eng tinch vaqt — <b>{best.label}</b> ({best.percent}% band).
					{peak.percent >= 90
						? ` ${peak.label} da parking deyarli to‘ladi, oldindan bron qiling.`
						: ` Eng gavjum payt — ${peak.label}.`}
				</AiCallout>
			</Card>

			{sheet === 'picker' && (
				<BottomSheet title='Parkingni tanlang' onClose={() => setSheet(null)}>
					<div className='space-y-2'>
						{parkings.map(parking => {
							const parkingPeak = peakForecastSlot(occupancyForecast(parking))
							return (
								<button
									key={parking.id}
									type='button'
									onClick={() => {
										onSelect(parking.id)
										setSheet(null)
									}}
									className='flex w-full items-center justify-between gap-3 rounded-card-lg bg-card p-3 text-left shadow-card'
								>
									<span className='min-w-0'>
										<span className='block truncate text-[14px] font-bold text-ink'>
											{parking.name}
										</span>
										<span className='mt-0.5 block text-[11px] text-ink-3'>
											Eng gavjum: {parkingPeak.label}
										</span>
									</span>
									<Badge
										tone={
											parkingPeak.percent >= 90
												? 'bad'
												: parkingPeak.percent >= 70
													? 'warn'
													: 'ok'
										}
									>
										{parkingPeak.percent}%
									</Badge>
								</button>
							)
						})}
					</div>
				</BottomSheet>
			)}

			{typeof sheet === 'number' && (
				<BottomSheet
					title={`${points[sheet].label} · bandlik`}
					onClose={() => setSheet(null)}
				>
					<Card className='text-center'>
						<p className='text-[34px] font-black leading-none text-ink'>
							{points[sheet].percent}%
						</p>
						<p className='mt-2 text-[12.5px] text-ink-2'>
							Taxminan{' '}
							{Math.max(
								0,
								Math.round(
									selected.totalSpaces * (1 - points[sheet].percent / 100),
								),
							)}{' '}
							ta joy bo‘sh qoladi
						</p>
					</Card>

					<Card className='mt-3'>
						<p className='text-[13px] leading-5 text-ink-2'>
							{points[sheet].percent >= 90
								? 'Bu vaqtda joy topish qiyin bo‘ladi — oldindan bron qilib qo‘ying.'
								: points[sheet].percent >= 70
									? 'Parking ancha band bo‘ladi, biroz erta kelganingiz ma’qul.'
									: 'Bu vaqtda joy yetarli — bemalol kelishingiz mumkin.'}
						</p>
					</Card>

					<Button
						variant='primary'
						block
						className='mt-4'
						onClick={() => {
							setSheet(null)
							onBook(selected.id)
						}}
					>
						Bron qilish
					</Button>
				</BottomSheet>
			)}
		</>
	)
}
