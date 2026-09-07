'use client'

import {
  ArrowRight,
  Clock3,
  Heart,
  MapPin,
  Navigation,
  Sparkles,
  X,
} from 'lucide-react'
import Link from 'next/link'

import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'
import { formatUZS } from '@/lib/format'
import { distanceKm, type Coordinate } from '@/lib/geo'
import type { Parking } from '@/lib/types'

type ParkingQuickViewProps = {
  parking: Parking
  userLocation: Coordinate
  onClose: () => void
  onSelectAlternative?: (parkingId: string) => void
}

export function ParkingQuickView({
  parking,
  userLocation,
  onClose,
  onSelectAlternative,
}: ParkingQuickViewProps) {
  const { favorites, toggleFavorite } = useApp()
  const favorite = favorites.includes(parking.id)
  const distance = distanceKm(userLocation, parking)

  const alternatives = PARKINGS.filter(
    (item) =>
      item.id !== parking.id &&
      item.city === parking.city &&
      item.availableSpaces > 0,
  )
    .map((item) => ({
      parking: item,
      distance: distanceKm(userLocation, item),
    }))
    .sort((a, b) => {
      const scoreA =
        a.distance * 5 +
        a.parking.pricePerHour / 1000 -
        Math.min(a.parking.availableSpaces, 30) * 0.15
      const scoreB =
        b.distance * 5 +
        b.parking.pricePerHour / 1000 -
        Math.min(b.parking.availableSpaces, 30) * 0.15
      return scoreA - scoreB
    })

  const betterOption = alternatives.find(({ parking: option, distance: optionDistance }) => {
    const cheaper = option.pricePerHour < parking.pricePerHour
    const moreAvailable = option.availableSpaces > parking.availableSpaces
    const stillReasonablyClose = optionDistance <= distance + 2.5
    return stillReasonablyClose && (cheaper || moreAvailable)
  })

  const savings = betterOption
    ? Math.max(0, parking.pricePerHour - betterOption.parking.pricePerHour)
    : 0

  const statusText =
    parking.availableSpaces === 0
      ? 'Joy qolmagan'
      : parking.availableSpaces <= 5
        ? 'Tez to‘lmoqda'
        : 'Joy mavjud'

  const statusClass =
    parking.availableSpaces === 0
      ? 'bg-red-50 text-red-700'
      : parking.availableSpaces <= 5
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700'

  return (
    <section className='relative z-20 mx-3 -mt-8 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-2xl shadow-slate-950/10 backdrop-blur-xl'>
      <div className='flex items-start justify-between gap-4'>
        <div className='min-w-0'>
          <p className='text-[10px] font-black uppercase tracking-[.22em] text-teal-600'>
            B SPACE Focus
          </p>
          <h2 className='mt-1 truncate text-xl font-black text-slate-950'>
            {parking.name}
          </h2>
          <p className='mt-1 flex items-center gap-1.5 text-xs text-slate-500'>
            <MapPin className='size-3.5 shrink-0' />
            <span className='truncate'>{parking.address}</span>
          </p>
        </div>

        <div className='flex shrink-0 gap-2'>
          <button
            type='button'
            onClick={() => toggleFavorite(parking.id)}
            className='grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700'
            aria-label='Favorite parking'
          >
            <Heart
              className={`size-4 ${favorite ? 'fill-rose-500 text-rose-500' : ''}`}
            />
          </button>
          <button
            type='button'
            onClick={onClose}
            className='grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700'
            aria-label='Close parking focus'
          >
            <X className='size-4' />
          </button>
        </div>
      </div>

      <div className='mt-4 grid grid-cols-3 gap-2'>
        <div className='rounded-2xl bg-slate-50 p-3'>
          <p className='text-[10px] font-bold uppercase tracking-wide text-slate-400'>
            Available
          </p>
          <p className='mt-1 text-lg font-black text-slate-950'>
            {parking.availableSpaces}
          </p>
        </div>

        <div className='rounded-2xl bg-slate-50 p-3'>
          <p className='text-[10px] font-bold uppercase tracking-wide text-slate-400'>
            Distance
          </p>
          <p className='mt-1 text-lg font-black text-slate-950'>
            {distance.toFixed(1)}
            <span className='ml-1 text-xs font-bold text-slate-400'>km</span>
          </p>
        </div>

        <div className='rounded-2xl bg-slate-50 p-3'>
          <p className='text-[10px] font-bold uppercase tracking-wide text-slate-400'>
            Price
          </p>
          <p className='mt-1 text-sm font-black text-slate-950'>
            {formatUZS(parking.pricePerHour)}
          </p>
          <p className='text-[10px] font-semibold text-slate-400'>/ soat</p>
        </div>
      </div>

      <div className='mt-3 flex items-center justify-between gap-3'>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusClass}`}>
          {statusText}
        </span>
        <span className='flex items-center gap-1.5 text-xs font-semibold text-slate-500'>
          <Clock3 className='size-3.5' />
          {parking.workingHours}
        </span>
      </div>

      {betterOption && (
        <button
          type='button'
          onClick={() => onSelectAlternative?.(betterOption.parking.id)}
          className='mt-4 w-full rounded-2xl border border-teal-100 bg-teal-50/80 p-4 text-left transition hover:bg-teal-50'
        >
          <div className='flex items-start gap-3'>
            <div className='grid size-9 shrink-0 place-items-center rounded-xl bg-white text-teal-700 shadow-sm'>
              <Sparkles className='size-4' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='text-xs font-black text-teal-950'>Better choice nearby</p>
              <p className='mt-1 text-xs leading-5 text-teal-800'>
                <strong>{betterOption.parking.name}</strong> ·{' '}
                {betterOption.parking.availableSpaces} bo‘sh joy
                {savings > 0 ? ` · ${formatUZS(savings)} / soat tejaysiz` : ''}.
              </p>
            </div>
            <ArrowRight className='mt-1 size-4 shrink-0 text-teal-700' />
          </div>
        </button>
      )}

      <div className='mt-5 grid grid-cols-2 gap-2'>
        <Link
          href={`/navigate/parking/${parking.id}`}
          className='flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-950'
        >
          <Navigation className='size-4' />
          Yo‘nalish
        </Link>

        {parking.availableSpaces > 0 ? (
          <Link
            href={`/reserve/${parking.id}`}
            className='flex h-12 items-center justify-center rounded-2xl bg-teal-700 text-sm font-bold text-white shadow-lg shadow-teal-700/20'
          >
            Bron qilish
          </Link>
        ) : (
          <Link
            href={`/parking/${parking.id}`}
            className='flex h-12 items-center justify-center rounded-2xl bg-amber-50 text-sm font-bold text-amber-800'
          >
            Alternativlar
          </Link>
        )}
      </div>

      <Link
        href={`/parking/${parking.id}`}
        className='mt-3 flex h-10 items-center justify-center gap-1 text-xs font-bold text-slate-500'
      >
        To‘liq ma’lumot
        <ArrowRight className='size-3.5' />
      </Link>
    </section>
  )
}
