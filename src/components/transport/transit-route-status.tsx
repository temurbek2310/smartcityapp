'use client'

import { ArrowLeftRight, BusFront, Footprints, TrainFront, TramFront, type LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { formatDistance } from '@/lib/format'
import { transitVehicleLabel, type TransitLeg, type TransitVehicle } from '@/lib/routing'
import { routeKmFromMeters, routeMinutesFromSeconds } from '@/lib/transport-route'

const VEHICLE_ICON: Record<TransitVehicle, LucideIcon> = {
	metro: TrainFront,
	bus: BusFront,
	trolleybus: BusFront,
	tram: TramFront,
	shuttle: BusFront,
	other: BusFront,
}

function LegRow({ leg }: { leg: TransitLeg }) {
	const minutes = `${routeMinutesFromSeconds(leg.durationSeconds)} daq`
	const distance = formatDistance(routeKmFromMeters(leg.distanceMeters))

	if (leg.type !== 'ride' || !leg.lineInfo) {
		const Icon = leg.type === 'transfer' ? ArrowLeftRight : Footprints
		return (
			<li className='flex items-center gap-3 border-t border-line py-2.5 first:border-t-0'>
				<IconTile size={32} tone='bg-card-2 text-ink-3'>
					<Icon className='size-4' />
				</IconTile>
				<span className='min-w-0 flex-1 text-[13.5px] text-ink-2'>
					{leg.type === 'transfer' ? 'O‘tish' : 'Piyoda'}
				</span>
				<span className='shrink-0 font-mono text-[12px] text-ink-3'>
					{distance} · {minutes}
				</span>
			</li>
		)
	}

	const { vehicle, name, color } = leg.lineInfo
	const Icon = VEHICLE_ICON[vehicle]
	const stops = [leg.fromStop, leg.toStop].filter(Boolean).join(' → ')
	return (
		<li className='flex items-center gap-3 border-t border-line py-2.5 first:border-t-0'>
			{/* The line's own colour when 2GIS gives one, else the brand's. */}
			<IconTile size={32} tone={color ? 'text-white' : 'bg-brand text-white'}>
				<span
					className='grid size-full place-items-center rounded-xl'
					style={color ? { backgroundColor: color } : undefined}
				>
					<Icon className='size-4' />
				</span>
			</IconTile>
			<div className='min-w-0 flex-1'>
				<p className='truncate text-[13.5px] font-bold text-ink'>
					{transitVehicleLabel(vehicle)} · {name}
				</p>
				{stops && <p className='mt-0.5 truncate text-[12px] text-ink-3'>{stops}</p>}
			</div>
			<span className='shrink-0 text-right font-mono text-[12px] text-ink-3'>
				{leg.stopCount !== null && <span className='block'>{leg.stopCount} bekat</span>}
				{minutes}
			</span>
		</li>
	)
}

// The public transport journey 2GIS planned, leg by leg: every row is read
// off the route's transitLegs — there is no demo content in this component.
export function TransitRouteStatus({ legs }: { legs: readonly TransitLeg[] }) {
	if (legs.length === 0) return null
	return (
		<Card>
			<p className='text-[11px] font-bold uppercase tracking-[.14em] text-ink-3'>Yo‘l</p>
			<ol className='mt-1'>
				{legs.map((leg, index) => (
					<LegRow key={index} leg={leg} />
				))}
			</ol>
		</Card>
	)
}
