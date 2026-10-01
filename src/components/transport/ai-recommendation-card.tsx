'use client'

import { Bot, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { formatDistance } from '@/lib/format'
import { neutralRecommendationReason, type TransportRecommendation } from '@/lib/transport-route'
import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'

type AiRecommendationCardProps = {
	currentMode: TransportMode
	recommendation: TransportRecommendation
	onSwitch: (mode: TransportMode) => void
	// Metres 2GIS reports as slow or jammed on the route on screen, or null
	// when 2GIS gave no traffic (see trafficCongestionMeters).
	congestionMeters?: number | null
}

// The comparison itself is real: both ETAs come from the same real,
// distance-based estimate (see lib/eta.ts) for every mode. Estimates carry
// no traffic, so the explanation says so rather than inventing any. Traffic
// is only ever stated for a real 2GIS route, from 2GIS's own segments.
//
// Once the car, walking or the scooter is routed by 2GIS its time is a different kind of
// number from the other modes' estimates, and the two are not ranked against
// each other: the card then only states the selected mode's time (see
// transportRecommendation in lib/transport-route.ts).
export function AiRecommendationCard({
	currentMode,
	recommendation,
	onSwitch,
	congestionMeters = null,
}: AiRecommendationCardProps) {
	const [showWhy, setShowWhy] = useState(false)
	if (recommendation.kind === 'neutral') {
		return (
			<NeutralRecommendation
				currentMode={currentMode}
				minutes={recommendation.minutes}
				congestionMeters={congestionMeters}
				showWhy={showWhy}
				onToggleWhy={() => setShowWhy(current => !current)}
			/>
		)
	}
	const { currentMinutes, fastestMode, fastestMinutes } = recommendation
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
							o‘rtacha shahar tezligiga asoslangan taxminiy hisob — unda
							tirbandlik hisobga olinmaydi.
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

// Same card, no ranking: the selected mode's own time and why nothing is
// compared to it. No "fastest" badge and no switch button.
function NeutralRecommendation({
	currentMode,
	minutes,
	congestionMeters,
	showWhy,
	onToggleWhy,
}: {
	currentMode: TransportMode
	minutes: number | null
	congestionMeters: number | null
	showWhy: boolean
	onToggleWhy: () => void
}) {
	const modeInfo = TRANSPORT_MODES.find(mode => mode.id === currentMode)
	if (!modeInfo) return null

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
						{minutes !== null && (
							<span className='shrink-0 rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-brand'>
								2GIS marshruti
							</span>
						)}
					</div>

					<div className='mt-1.5 flex items-center justify-between gap-3'>
						<p className='text-[19px] font-black text-ink'>{modeInfo.label}</p>
						<p className='text-[19px] font-black text-ok'>
							{minutes !== null ? `${minutes} daq` : '—'}
						</p>
					</div>

					{minutes !== null && congestionMeters !== null && (
						<p className='mt-0.5 text-[12px] text-ink-3'>
							{congestionMeters > 0
								? `${formatDistance(congestionMeters / 1000)} tirbandlik`
								: 'Tirbandlik yo‘q'}
						</p>
					)}

					<p className='mt-1 text-[12.5px] leading-5 text-ink-2'>
						{minutes !== null
							? 'Vaqt 2GIS marshrutidan olingan. Boshqa transport turlari hozircha taxminiy, shuning uchun solishtirilmaydi.'
							: 'Marshrut tayyor bo‘lgach vaqt shu yerda ko‘rinadi.'}
					</p>

					{showWhy && (
						<p className='mt-2 rounded-xl bg-white/70 p-2.5 text-[11.5px] leading-5 text-ink-3'>
							{neutralRecommendationReason(currentMode)}
						</p>
					)}

					<div className='mt-3 flex gap-2'>
						<button
							type='button'
							onClick={onToggleWhy}
							className='inline-flex h-9 items-center gap-1 rounded-xl bg-brand px-3.5 text-[12.5px] font-bold text-white'
						>
							Nima uchun
							<ChevronRight className='size-3.5' />
						</button>
					</div>
				</div>
			</div>
		</section>
	)
}
