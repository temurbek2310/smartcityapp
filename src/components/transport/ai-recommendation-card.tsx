'use client'

import { Bot, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'

type AiRecommendationCardProps = {
	currentMode: TransportMode
	currentMinutes: number
	fastestMode: TransportMode
	fastestMinutes: number
	onSwitch: (mode: TransportMode) => void
}

// The comparison itself is real: both ETAs come from the same real,
// distance-based estimate (see lib/eta.ts) for every mode. What is honestly
// NOT real is a live traffic percentage, so the explanation stays generic
// about how the estimate is made instead of inventing one.
export function AiRecommendationCard({
	currentMode,
	currentMinutes,
	fastestMode,
	fastestMinutes,
	onSwitch,
}: AiRecommendationCardProps) {
	const [showWhy, setShowWhy] = useState(false)
	// Only recommend switching when another mode is STRICTLY faster — at very
	// short distances several modes round to the same floor (see lib/eta.ts),
	// and a tie must never be presented as "faster."
	const strictlyFaster = fastestMinutes < currentMinutes
	const displayMode = strictlyFaster ? fastestMode : currentMode
	const displayMinutes = strictlyFaster ? fastestMinutes : currentMinutes
	const alreadyFastest = !strictlyFaster
	const displayModeInfo = TRANSPORT_MODES.find(mode => mode.id === displayMode)
	if (!displayModeInfo) return null
	const savedMinutes = currentMinutes - displayMinutes

	return (
		<section className='animate-fade-up rounded-[20px] bg-gradient-to-br from-[#f3efff] to-[#edf5ff] p-4 shadow-card'>
			<div className='flex items-start gap-3'>
				<span className='grid size-9 shrink-0 place-items-center rounded-[13px] bg-brand text-white'>
					<Bot className='size-4.5' />
				</span>
				<div className='min-w-0 flex-1'>
					<div className='flex items-center justify-between gap-2'>
						<p className='text-[12.5px] font-extrabold text-brand'>
							AI tavsiyasi
						</p>
						<span className='shrink-0 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-brand'>
							{alreadyFastest ? 'Siz eng tez yo‘ldasiz' : 'Eng yaxshi variant'}
						</span>
					</div>

					<div className='mt-1.5 flex items-center justify-between gap-3'>
						<p className='text-[19px] font-black text-ink'>
							{displayModeInfo.label}
						</p>
						<p className='text-[19px] font-black text-ok'>
							{displayMinutes} daq
						</p>
					</div>

					<p className='mt-1 text-[12.5px] leading-5 text-ink-2'>
						{alreadyFastest
							? `Hozirgi tanlovingiz — ${displayModeInfo.label.toLowerCase()} — masofaga ko‘ra eng tezkor variant.`
							: `${displayModeInfo.label} ${savedMinutes} daqiqa tezroq — taxminiy hisob-kitobga ko‘ra.`}
					</p>

					{showWhy && (
						<p className='mt-2 rounded-xl bg-white/70 p-2.5 text-[11.5px] leading-5 text-ink-3'>
							Bu taqqoslash haqiqiy masofa va har bir transport turi uchun
							o‘rtacha shahar tezligiga asoslangan taxminiy hisob — jonli
							tirbandlik xizmati B SPACE MVPda hali ulanmagan.
						</p>
					)}

					<div className='mt-3 flex gap-2'>
						<button
							type='button'
							onClick={() => setShowWhy(current => !current)}
							className='inline-flex h-9 items-center gap-1 rounded-xl bg-brand px-3.5 text-[12.5px] font-bold text-white'
						>
							Nima uchun
							<ChevronRight className='size-3.5' />
						</button>
						{!alreadyFastest && (
							<button
								type='button'
								onClick={() => onSwitch(displayMode)}
								className='inline-flex h-9 items-center rounded-xl bg-white px-3.5 text-[12.5px] font-bold text-ink shadow-[0_1px_2px_rgba(16,24,40,.04)]'
							>
								Almashtirish
							</button>
						)}
					</div>
				</div>
			</div>
		</section>
	)
}
