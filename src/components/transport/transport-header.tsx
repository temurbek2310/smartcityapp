'use client'

import { ChevronLeft, SlidersHorizontal } from 'lucide-react'

type TransportHeaderProps = {
	title: string
	subtitle: string
	filterCount: number
	onBack: () => void
	onFilterClick: () => void
}

export function TransportHeader({
	title,
	subtitle,
	filterCount,
	onBack,
	onFilterClick,
}: TransportHeaderProps) {
	return (
		<div className='flex items-center gap-3'>
			<button
				type='button'
				onClick={onBack}
				aria-label='Ortga'
				className='grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'
			>
				<ChevronLeft className='size-5' />
			</button>

			<div className='min-w-0 flex-1'>
				<h1 className='truncate text-[20px] font-extrabold tracking-[-0.02em] text-slate-950'>
					{title}
				</h1>
				<p className='mt-0.5 truncate text-[12.5px] text-[#8a91a6]'>{subtitle}</p>
			</div>

			<button
				type='button'
				onClick={onFilterClick}
				aria-label='Marshrut filtrlari'
				className='relative grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'
			>
				<SlidersHorizontal className='size-5' />
				{filterCount > 0 && (
					<span className='absolute -right-1 -top-1 grid min-w-4.5 place-items-center rounded-full border-2 border-white bg-[#6c47e0] px-1 text-[9.5px] font-extrabold leading-4 text-white'>
						{filterCount}
					</span>
				)}
			</button>
		</div>
	)
}
