'use client'

import { Heart, Navigation, Repeat, Star, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconTile } from '@/components/ui/icon-tile'
import { Meter } from '@/components/ui/meter'
import { useApp } from '@/context/app-context'
import { queueLoadPercent } from '@/data/queue-orgs'
import { occupancyTone } from '@/lib/availability'
import { cn } from '@/lib/cn'
import { formatDistance } from '@/lib/format'
import type { QueueOrg } from '@/lib/types'

// Which organisation you are looking at, and the two ways out of it:
// somewhere else, or directions to here.
export function QueueOrgCard({
	org,
	onSwitch,
}: {
	org: QueueOrg
	onSwitch: () => void
}) {
	const router = useRouter()
	const { favoriteQueueOrgs, toggleQueueOrgFavorite } = useApp()
	const load = queueLoadPercent(org)
	const saved = favoriteQueueOrgs.includes(org.id)

	return (
		<Card>
			<div className='flex items-start gap-3'>
				<IconTile
					size={52}
					tone={cn('bg-linear-to-br text-white/70', org.accent)}
					className='rounded-2xl'
				>
					<Users className='size-5' />
				</IconTile>

				<div className='min-w-0 flex-1'>
					<div className='flex items-start justify-between gap-2'>
						<p className='min-w-0 truncate text-[15px] font-extrabold text-ink'>
							{org.title}
						</p>
						<Badge tone={org.open ? 'ok' : 'bad'}>
							{org.open ? 'Ochiq' : 'Yopiq'}
						</Badge>
					</div>

					<p className='mt-1 truncate text-[11.5px] text-ink-3'>
						{org.address} · {formatDistance(org.distanceKm)}
					</p>

					<p className='mt-1 flex items-center gap-2 text-[11.5px] text-ink-3'>
						<span className='flex items-center gap-1 font-bold text-ink-2'>
							<Star className='size-3 fill-star text-star' /> {org.rating}
						</span>
						<span>{org.reviewCount} sharh</span>
						<span>· {org.closeTime} gacha</span>
					</p>
				</div>

				<button
					type='button'
					aria-label={saved ? 'Sevimlilardan olib tashlash' : 'Sevimlilarga qo‘shish'}
					onClick={() => toggleQueueOrgFavorite(org.id)}
					className='grid size-9 shrink-0 place-items-center rounded-xl bg-card-2'
				>
					<Heart
						className={cn('size-4', saved ? 'fill-bad text-bad' : 'text-ink-3')}
					/>
				</button>
			</div>

			<div className='mt-3'>
				<div className='flex items-center justify-between text-[11.5px]'>
					<span className='text-ink-3'>Hozirgi bandlik</span>
					<span className='font-bold text-ink-2'>{load}%</span>
				</div>
				<Meter
					value={load}
					tone={occupancyTone(load)}
					height={5}
					className='mt-1.5'
				/>
			</div>

			<div className='mt-3 grid grid-cols-2 gap-2'>
				<Button size='sm' variant='outline' onClick={onSwitch}>
					<Repeat className='size-3.5' /> Boshqa joy
				</Button>
				<Button
					size='sm'
					variant='outline'
					onClick={() => router.push(`/navigate/parking/${org.parkingId}`)}
				>
					<Navigation className='size-3.5' /> Yo‘nalish
				</Button>
			</div>
		</Card>
	)
}
