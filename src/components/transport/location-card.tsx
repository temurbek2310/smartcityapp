'use client'

import { ArrowUpDown, ChevronRight, MapPin, RotateCw } from 'lucide-react'

type LocationCardProps = {
	originLabel: string
	originValue: string
	// Opens the address book for the start of the route. City Goo makes both
	// ends pickable; this screen used to expose only a "refresh GPS" action.
	onOriginClick: () => void
	onRefreshOrigin: () => void
	refreshing?: boolean
	destinationLabel: string
	destinationValue: string
	onDestinationClick: () => void
	onSwap: () => void
}

export function LocationCard({
	originLabel,
	originValue,
	onOriginClick,
	onRefreshOrigin,
	refreshing = false,
	destinationLabel,
	destinationValue,
	onDestinationClick,
	onSwap,
}: LocationCardProps) {
	return (
		<section className='relative rounded-[20px] bg-white p-1 shadow-card'>
			<button
				type='button'
				onClick={onOriginClick}
				className='flex w-full items-start gap-3 px-3.5 py-3 text-left'
			>
				<span className='mt-1.5 size-2 shrink-0 rounded-full bg-brand' />
				<span className='min-w-0 flex-1'>
					<span className='block text-[11.5px] font-semibold text-ink-3'>
						{originLabel}
					</span>
					<span className='mt-0.5 block truncate text-[14.5px] font-extrabold text-ink'>
						{originValue}
					</span>
				</span>
				{/* Spacer for the swap control, which is absolutely positioned so it
				    sits on the divider between the two rows. */}
				<span className='size-8 shrink-0' />
			</button>

			<div className='mx-3.5 h-px bg-line' />

			<button
				type='button'
				onClick={onDestinationClick}
				className='flex w-full items-start gap-3 px-3.5 py-3 text-left'
			>
				<MapPin className='mt-0.5 size-4 shrink-0 fill-bad text-bad' />
				<span className='min-w-0 flex-1'>
					<span className='block text-[11.5px] font-semibold text-ink-3'>
						{destinationLabel}
					</span>
					<span className='mt-0.5 block truncate text-[14.5px] font-extrabold text-ink'>
						{destinationValue}
					</span>
				</span>
				<ChevronRight className='mt-1 size-4.5 shrink-0 text-ink-3' />
			</button>

			<div className='absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1.5'>
				<button
					type='button'
					onClick={onSwap}
					aria-label='Boshlanish va manzilni almashtirish'
					className='citygo-pressable grid size-8 place-items-center rounded-xl bg-card-2 text-ink-2'
				>
					<ArrowUpDown className='size-4' />
				</button>
				<button
					type='button'
					onClick={onRefreshOrigin}
					aria-label='Joylashuvni yangilash'
					className='citygo-pressable grid size-8 place-items-center rounded-xl bg-card-2 text-ink-2'
				>
					<RotateCw className={`size-4 citygo-refresh-spinner ${refreshing ? 'is-refreshing' : ''}`} />
				</button>
			</div>
		</section>
	)
}
