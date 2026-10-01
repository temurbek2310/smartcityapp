'use client'

import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { HorizontalRail } from '@/components/ui/horizontal-rail'
import { formatDistance } from '@/lib/format'
import type { RealRoute } from '@/lib/routing'
import { routeKmFromMeters, routeMinutesFromSeconds } from '@/lib/transport-route'

// What 2GIS computed for a car route beyond its line: the other routes it
// found, and the primary route's maneuvers. Everything here is read off the
// RealRoute — there is no demo content in this component.
export function CarRouteStatus({
	route,
	selectedIndex,
	onSelect,
}: {
	// Always the provider's full answer (the primary route with its
	// alternatives), never the variant currently on screen.
	route: RealRoute
	selectedIndex: number
	onSelect: (index: number) => void
}) {
	const variants = [route, ...route.alternatives]
	// Maneuvers describe the primary line only; an alternative has none.
	const maneuvers = selectedIndex === 0 ? route.maneuvers : []

	return (
		<>
			{variants.length > 1 && (
				<section aria-label='Muqobil marshrutlar'>
					<HorizontalRail className='gap-2'>
						{variants.map((variant, index) => (
							<Chip
								key={index}
								active={index === selectedIndex}
								aria-pressed={index === selectedIndex}
								onClick={() => onSelect(index)}
							>
								{index === 0 ? 'Asosiy' : `${index}-muqobil`}
								<span className='font-mono text-[12px] opacity-80'>
									{routeMinutesFromSeconds(variant.durationSeconds)} daq ·{' '}
									{formatDistance(routeKmFromMeters(variant.distanceMeters))}
								</span>
							</Chip>
						))}
					</HorizontalRail>
				</section>
			)}

			{maneuvers.length > 0 && (
				<Card>
					<p className='text-[11px] font-bold uppercase tracking-[.14em] text-ink-3'>
						Yo‘nalish
					</p>
					<ol className='mt-1'>
						{maneuvers.map((maneuver, index) => (
							<li
								key={index}
								className='flex items-baseline justify-between gap-3 border-t border-line py-2.5 first:border-t-0'
							>
								<span className='min-w-0 text-[13.5px] text-ink'>
									{maneuver.instruction}
								</span>
								{maneuver.distanceMeters > 0 && (
									<span className='shrink-0 font-mono text-[12px] text-ink-3'>
										{formatDistance(routeKmFromMeters(maneuver.distanceMeters))}
									</span>
								)}
							</li>
						))}
					</ol>
				</Card>
			)}
		</>
	)
}
