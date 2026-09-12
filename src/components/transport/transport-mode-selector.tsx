'use client'

import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'

type TransportModeSelectorProps = {
	selected: TransportMode
	minutesByMode: Record<TransportMode, number>
	onSelect: (mode: TransportMode) => void
}

export function TransportModeSelector({
	selected,
	minutesByMode,
	onSelect,
}: TransportModeSelectorProps) {
	return (
		<HorizontalRail className='gap-2.5'>
			{TRANSPORT_MODES.map(mode => {
				const Icon = mode.icon
				const active = selected === mode.id
				return (
					<button
						key={mode.id}
						type='button'
						onClick={() => onSelect(mode.id)}
						className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-[13.5px] font-bold transition duration-200 ${
							active
								? 'bg-brand text-white shadow-[0_6px_16px_rgba(108,71,224,.28)]'
								: 'bg-white text-ink shadow-card'
						}`}
					>
						<Icon className='size-4.5' />
						{mode.label} · {minutesByMode[mode.id]} daq
					</button>
				)
			})}
		</HorizontalRail>
	)
}
