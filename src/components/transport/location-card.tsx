'use client'

import { ChevronRight, MapPin, MoreVertical } from 'lucide-react'

type LocationCardProps = {
	originLabel: string
	originValue: string
	onOriginAction: () => void
	originActionLabel: string
	destinationLabel: string
	destinationValue: string
	onDestinationClick: () => void
}

export function LocationCard({
	originLabel,
	originValue,
	onOriginAction,
	originActionLabel,
	destinationLabel,
	destinationValue,
	onDestinationClick,
}: LocationCardProps) {
	return (
		<section className='rounded-[20px] bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<div className='flex items-start gap-3 px-3.5 py-3'>
				<span className='mt-1.5 size-2 shrink-0 rounded-full bg-[#6c47e0]' />
				<div className='min-w-0 flex-1'>
					<p className='text-[11.5px] font-semibold text-[#8a91a6]'>
						{originLabel}
					</p>
					<p className='mt-0.5 truncate text-[14.5px] font-extrabold text-slate-950'>
						{originValue}
					</p>
				</div>
				<button
					type='button'
					onClick={onOriginAction}
					aria-label={originActionLabel}
					className='grid size-8 shrink-0 place-items-center rounded-xl bg-[#f7f8fc] text-slate-500'
				>
					<MoreVertical className='size-4' />
				</button>
			</div>

			<div className='mx-3.5 h-px bg-[#eaecf2]' />

			<button
				type='button'
				onClick={onDestinationClick}
				className='flex w-full items-center gap-3 px-3.5 py-3 text-left'
			>
				<span className='mt-1 grid size-4 shrink-0 place-items-center text-rose-500'>
					<MapPin className='size-4 fill-rose-500' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='text-[11.5px] font-semibold text-[#8a91a6]'>
						{destinationLabel}
					</p>
					<p className='mt-0.5 truncate text-[14.5px] font-extrabold text-slate-950'>
						{destinationValue}
					</p>
				</div>
				<ChevronRight className='size-4.5 shrink-0 text-[#8a91a6]' />
			</button>
		</section>
	)
}
