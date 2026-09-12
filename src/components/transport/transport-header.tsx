'use client'

import { SlidersHorizontal } from 'lucide-react'

import { AppBar } from '@/components/ui/app-bar'
import { IconButton } from '@/components/ui/icon-button'

type TransportHeaderProps = {
	title: string
	subtitle: string
	filterCount: number
	onBack: () => void
	onFilterClick: () => void
}

// Thin binding over the shared AppBar, which was generalised out of this
// component once /parking, /queues and /news needed the same header.
export function TransportHeader({
	title,
	subtitle,
	filterCount,
	onBack,
	onFilterClick,
}: TransportHeaderProps) {
	return (
		<AppBar
			title={title}
			subtitle={subtitle}
			onBack={onBack}
			action={
				<IconButton
					label='Marshrut filtrlari'
					badge={filterCount}
					onClick={onFilterClick}
					className='size-11 rounded-2xl text-ink-2'
				>
					<SlidersHorizontal className='size-5' />
				</IconButton>
			}
		/>
	)
}
