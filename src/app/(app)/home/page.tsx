'use client'

import { LocateFixed, Search } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { ParkingMap } from '@/components/map/parking-map'
import { ParkingCard } from '@/components/parking/parking-card'
import { ParkingQuickView } from '@/components/parking/parking-quick-view'
import { useApp } from '@/context/app-context'
import { PARKINGS } from '@/data/parkings'
import { distanceKm } from '@/lib/geo'
import { useUserLocation, type LocationError } from '@/lib/use-user-location'

function locationMessage(error: LocationError) {
  switch (error) {
    case 'denied':
      return 'Joylashuvga ruxsat berilmadi. Masofa demo Toshkent markazidan hisoblanmoqda.'
    case 'timeout':
      return 'GPS javob bermadi. Masofa demo Toshkent markazidan hisoblanmoqda.'
    case 'unavailable':
      return 'Qurilma joylashuvni aniqlay olmadi. Demo joylashuv ishlatilmoqda.'
    case 'outside-uzbekistan':
      return 'Joylashuv O‘zbekiston hududidan tashqarida. Demo Toshkent markazi ishlatilmoqda.'
    case 'unsupported':
      return 'Bu brauzer geolokatsiyani qo‘llamaydi. Demo joylashuv ishlatilmoqda.'
    default:
      return 'GPS hozir mavjud emas. Demo joylashuv ishlatilmoqda.'
  }
}

export default function HomePage() {
  const { user, reservations, favorites } = useApp()
  const { location, status, error: locationError, locate } = useUserLocation()

  const [query, setQuery] = useState('')
  const [selectedParkingId, setSelectedParkingId] = useState<string | null>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()

    return PARKINGS.filter((parking) => {
      if (!q) return true

      return `${parking.name} ${parking.city} ${parking.district} ${parking.address}`
        .toLowerCase()
        .includes(q)
    })
      .map((parking) => ({
        parking,
        distance: distanceKm(location, parking),
      }))
      .sort((a, b) => a.distance - b.distance)
  }, [query, location])

  const filteredParkings = useMemo(
    () => results.map(({ parking }) => parking),
    [results],
  )

  const selectedParking = useMemo(
    () => PARKINGS.find((parking) => parking.id === selectedParkingId),
    [selectedParkingId],
  )

  const active = reservations.find((reservation) => reservation.status === 'active')
  const latest = reservations[0]
  const latestParking = latest
    ? PARKINGS.find((parking) => parking.id === latest.parkingId)
    : undefined
  const favoriteParking = PARKINGS.find((parking) => favorites.includes(parking.id))

  function selectParking(parkingId: string) {
    setSelectedParkingId(parkingId)

    window.setTimeout(() => {
      document.getElementById('parking-map')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }, 40)
  }

  function selectAlternative(parkingId: string) {
    setQuery('')
    selectParking(parkingId)
  }

  return (
    <div className='space-y-7'>
      <section>
        <p className='text-sm font-semibold text-slate-500'>
          Assalomu alaykum, {user?.name}
        </p>
        <h1 className='mt-1 text-3xl font-black tracking-tight text-slate-950'>
          Parking topamiz
        </h1>
        <p className='mt-2 text-sm leading-6 text-slate-500'>
          Yaqin parkinglarni toping, bo‘sh joylarni ko‘ring va oldindan band qiling.
        </p>
      </section>

      {active && (
        <Link
          href={`/session/${active.id}`}
          className='block rounded-3xl bg-emerald-500 p-5 text-white shadow-lg shadow-emerald-500/20'
        >
          <p className='text-xs font-bold uppercase tracking-[.18em] text-emerald-50'>
            Active parking
          </p>
          <p className='mt-2 text-xl font-black'>Parking sessiyangiz davom etmoqda</p>
          <p className='mt-1 text-sm text-emerald-50'>Taymer va chiqish QR →</p>
        </Link>
      )}

      {(latestParking || favoriteParking) && (
        <div className='grid grid-cols-2 gap-3'>
          {latestParking && (
            <Link href='/bookings' className='rounded-2xl bg-slate-100 p-4'>
              <p className='text-[10px] font-bold uppercase tracking-[.16em] text-slate-400'>
                Last booking
              </p>
              <strong className='mt-2 block truncate text-sm'>{latestParking.name}</strong>
              <span className='mt-1 block text-xs capitalize text-slate-500'>
                {latest?.status}
              </span>
            </Link>
          )}

          {favoriteParking && (
            <Link href='/favorites' className='rounded-2xl bg-rose-50 p-4'>
              <p className='text-[10px] font-bold uppercase tracking-[.16em] text-rose-400'>
                Favorite
              </p>
              <strong className='mt-2 block truncate text-sm text-rose-950'>
                {favoriteParking.name}
              </strong>
              <span className='mt-1 block text-xs text-rose-600'>Quick reserve →</span>
            </Link>
          )}
        </div>
      )}

      {/* Customer correction: search first, map immediately after it. */}
      <div className='flex gap-2'>
        <label className='flex h-13 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4'>
          <Search className='size-5 text-slate-400' />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setSelectedParkingId(null)
            }}
            className='min-w-0 flex-1 bg-transparent text-sm outline-none'
            placeholder='Parking yoki joy qidiring'
            aria-label='Parking qidirish'
          />
        </label>

        <button
          type='button'
          onClick={locate}
          className='grid size-13 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white'
          aria-label='Joylashuvimni aniqlash'
        >
          <LocateFixed
            className={`size-5 ${status === 'loading' ? 'animate-pulse' : ''}`}
          />
        </button>
      </div>

      <section id='parking-map' className='scroll-mt-6'>
        <ParkingMap
          parkings={filteredParkings}
          selectedParkingId={selectedParkingId}
          onSelect={selectParking}
          userLocation={status === 'ready' ? location : undefined}
        />

        {selectedParking && (
          <ParkingQuickView
            parking={selectedParking}
            userLocation={location}
            onClose={() => setSelectedParkingId(null)}
            onSelectAlternative={selectAlternative}
          />
        )}

        {!selectedParking && filteredParkings.length > 0 && (
          <div className='mt-3 flex items-center justify-between px-1 text-[11px] font-semibold text-slate-400'>
            <span>Marker ichidagi raqam — bo‘sh joylar</span>
            <span>{filteredParkings.length} ta natija</span>
          </div>
        )}
      </section>

      {status === 'fallback' && (
        <p className='rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-800'>
          {locationMessage(locationError)}
        </p>
      )}

      <section>
        <div className='mb-4'>
          <p className='text-xs font-bold uppercase tracking-[.2em] text-slate-400'>
            Nearby
          </p>
          <h2 className='mt-1 text-xl font-black'>Parkinglar</h2>
        </div>

        <div className='space-y-4'>
          {results.map(({ parking, distance }) => (
            <ParkingCard
              key={parking.id}
              parking={parking}
              distance={distance}
              selected={parking.id === selectedParkingId}
              onSelect={selectParking}
            />
          ))}
        </div>

        {results.length === 0 && (
          <div className='rounded-3xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500'>
            Mos parking topilmadi.
          </div>
        )}
      </section>
    </div>
  )
}
