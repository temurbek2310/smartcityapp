'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Switch } from '@/components/ui/switch'
import { formatDistance, formatUZS } from '@/lib/format'
import {
	DISTANCE_CEILINGS_KM,
	PRICE_CEILINGS,
	type AdvancedFilters,
} from '@/hooks/use-parking-filters'

const TOGGLES: { id: keyof AdvancedFilters; label: string; hint: string }[] = [
	{ id: 'covered', label: 'Yopiq parking', hint: 'Yomg‘ir va quyoshdan himoya' },
	{ id: 'ev', label: 'EV quvvatlash', hint: 'Elektromobil uchun stansiya bor' },
	{ id: 'accessible', label: 'Nogironlar uchun', hint: 'Maxsus ajratilgan joylar' },
	{ id: 'secure', label: 'Qo‘riqlanadi', hint: 'Doimiy qo‘riqchi xizmati' },
	{ id: 'freeOnly', label: 'Faqat bepul', hint: 'To‘lovsiz parkinglar' },
	{ id: 'h24', label: '24/7 ishlaydi', hint: 'Tunda ham ochiq' },
]

export function ParkingFiltersSheet({
	advanced,
	onChange,
	onReset,
	resultCount,
	onClose,
}: {
	advanced: AdvancedFilters
	onChange: (next: AdvancedFilters) => void
	onReset: () => void
	// Live count, so "show N" answers the question before the sheet closes.
	resultCount: number
	onClose: () => void
}) {
	return (
		<BottomSheet title='Filtrlar' onClose={onClose}>
			<Card variant='bare'>
				{TOGGLES.map((toggle, index) => (
					<div
						key={toggle.id}
						className={`flex items-center justify-between gap-3 px-3.5 py-3 ${index ? 'border-t border-line' : ''}`}
					>
						<div className='min-w-0'>
							<p className='text-[14px] font-semibold text-ink'>
								{toggle.label}
							</p>
							<p className='mt-0.5 text-[11px] text-ink-3'>{toggle.hint}</p>
						</div>
						<Switch
							label={toggle.label}
							checked={Boolean(advanced[toggle.id])}
							onChange={value => onChange({ ...advanced, [toggle.id]: value })}
						/>
					</div>
				))}
			</Card>

			<Card className='mt-3'>
				<p className='text-[14px] font-bold text-ink'>Soatlik narx</p>
				<div className='mt-3 flex flex-wrap gap-2'>
					{PRICE_CEILINGS.map(price => (
						<Chip
							key={price}
							active={advanced.maxPrice === price}
							onClick={() =>
								onChange({
									...advanced,
									maxPrice: advanced.maxPrice === price ? null : price,
								})
							}
						>
							{formatUZS(price)}gacha
						</Chip>
					))}
				</div>
			</Card>

			<Card className='mt-3'>
				<p className='text-[14px] font-bold text-ink'>Masofa</p>
				<div className='mt-3 flex flex-wrap gap-2'>
					{DISTANCE_CEILINGS_KM.map(km => (
						<Chip
							key={km}
							active={advanced.maxDistanceKm === km}
							onClick={() =>
								onChange({
									...advanced,
									maxDistanceKm: advanced.maxDistanceKm === km ? null : km,
								})
							}
						>
							{formatDistance(km)}gacha
						</Chip>
					))}
				</div>
			</Card>

			<div className='mt-4 grid grid-cols-2 gap-2'>
				<Button variant='outline' onClick={onReset}>
					Tozalash
				</Button>
				<Button variant='primary' onClick={onClose}>
					{resultCount} tasini ko‘rish
				</Button>
			</div>
		</BottomSheet>
	)
}
