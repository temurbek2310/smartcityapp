'use client'

import { Heart, MapPin, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useApp } from '@/context/app-context'
import { formatUZS } from '@/lib/format'
import type { Parking } from '@/lib/types'

type ParkingCardProps = {
  parking: Parking
  distance?: number
  onSelect?: (parkingId: string) => void
  selected?: boolean
}

export function ParkingCard({
  parking,
  distance,
  onSelect,
  selected = false,
}: ParkingCardProps) {
  const router = useRouter()
  const { favorites, toggleFavorite } = useApp()
  const favorite = favorites.includes(parking.id)

  const statusClass =
    parking.availableSpaces === 0
      ? 'bg-red-50 text-red-700'
      : parking.availableSpaces <= 5
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700'

  function openParking() {
    if (onSelect) {
      onSelect(parking.id)
      return
    }

    router.push(`/parking/${parking.id}`)
  }

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition ${
        selected
          ? 'border-teal-500 ring-4 ring-teal-500/10'
          : 'border-slate-200'
      }`}
    >
      <div className={`h-28 bg-linear-to-br ${parking.accent} p-4 text-white`}>
        <div className='flex items-start justify-between'>
          <span className='rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur'>
            {parking.city}
          </span>

          <button
            type='button'
            onClick={() => toggleFavorite(parking.id)}
            className='grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur'
            aria-label={favorite ? 'Remove favorite' : 'Add favorite'}
          >
            <Heart className={`size-5 ${favorite ? 'fill-white' : ''}`} />
          </button>
        </div>
      </div>

      <div className='p-4'>
        <button type='button' onClick={openParking} className='w-full text-left'>
          <div className='flex items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h3 className='truncate font-bold text-slate-950'>{parking.name}</h3>
              <p className='mt-1 flex items-center gap-1 text-xs text-slate-500'>
                <MapPin className='size-3.5 shrink-0' />
                <span className='truncate'>
                  {parking.district}, {parking.city}
                </span>
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}
            >
              {parking.availableSpaces === 0
                ? 'FULL'
                : `${parking.availableSpaces} free`}
            </span>
          </div>

          <div className='mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm'>
            <div className='text-slate-500'>
              {distance !== undefined ? (
                `${distance.toFixed(1)} km`
              ) : (
                <span className='flex items-center gap-1'>
                  <ShieldCheck className='size-4' />
                  Verified
                </span>
              )}
            </div>

            <strong className='text-slate-950'>
              {formatUZS(parking.pricePerHour)} / soat
            </strong>
          </div>
        </button>

        <button
          type='button'
          onClick={openParking}
          className='mt-4 flex h-11 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white'
        >
          {onSelect ? 'Xaritada ko‘rish' : 'Batafsil'}
        </button>
      </div>
    </article>
  )
}
