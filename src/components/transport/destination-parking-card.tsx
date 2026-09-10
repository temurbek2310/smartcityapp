'use client'

import { CircleParking } from 'lucide-react'
import Link from 'next/link'

import { parkingAvailability } from '@/lib/availability'
import type { Parking } from '@/lib/types'

type DestinationParkingCardProps = {
	parking: Parking
	onReserve: () => void
}

// The one section of the Transport screen backed entirely by real B SPACE
// data — real availability, and a Reserve button that opens the shared
// City Goo booking sheet for this parking, not a City Goo-style toast.
export function DestinationParkingCard({
	parking,
	onReserve,
}: DestinationParkingCardProps) {
	const { percent: pct, full, tone } = parkingAvailability(parking)

	return (
		<section className='rounded-[20px] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_14px_rgba(16,24,40,.06)]'>
			<div className='flex items-center gap-3'>
				<span
					className={`grid size-10 shrink-0 place-items-center rounded-[13px] bg-linear-to-br ${parking.accent} text-white`}
				>
					<CircleParking className='size-5' />
				</span>
				<div className='min-w-0 flex-1'>
					<p className='truncate text-[14.5px] font-extrabold text-slate-950'>
						{parking.name}
					</p>
					<p className='mt-0.5 truncate text-[11.5px] text-[#8a91a6]'>
						{parking.address}
					</p>
				</div>
				<span className={`shrink-0 text-[15px] font-black ${tone.text}`}>
					{pct}%
				</span>
			</div>

			<p className='mt-3 text-[12.5px] text-slate-600'>
				Bo‘sh {parking.availableSpaces} / {parking.totalSpaces} joy
			</p>
			<div className='mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#eaecf2]'>
				<span
					className={`block h-full rounded-full ${tone.bar}`}
					style={{ width: `${Math.max(4, pct)}%` }}
				/>
			</div>

			<div className='mt-3 grid grid-cols-2 gap-2'>
				<Link
					href={`/parking/${parking.id}`}
					className='flex h-11 items-center justify-center rounded-[14px] border border-[#e1e4ed] text-[13px] font-bold text-slate-800'
				>
					Batafsil
				</Link>
				{full ? (
					<span className='flex h-11 items-center justify-center rounded-[14px] bg-[#f7f8fc] text-[13px] font-bold text-[#8a91a6]'>
						Joy yo‘q
					</span>
				) : (
					<button
						type='button'
						onClick={onReserve}
						className='flex h-11 w-full items-center justify-center rounded-[14px] bg-[#6c47e0] text-[13px] font-bold text-white shadow-[0_6px_16px_rgba(108,71,224,.28)]'
					>
						Bron qilish
					</button>
				)}
			</div>
		</section>
	)
}
