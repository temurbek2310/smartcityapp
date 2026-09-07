'use client'

import { useCallback, useState } from 'react'

import {
  isInsideUzbekistan,
  TASHKENT_CENTER,
  type Coordinate,
} from '@/lib/geo'

export type LocationStatus = 'idle' | 'loading' | 'ready' | 'fallback'

export type LocationError =
  | null
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'outside-uzbekistan'

export function useUserLocation() {
  const [location, setLocation] = useState<Coordinate>(TASHKENT_CENTER)
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [error, setError] = useState<LocationError>(null)

  const locate = useCallback(() => {
    // The development computer used for this MVP has OS geolocation disabled
    // by organisation policy. Keep local development testable, while real
    // production builds always use the device's browser geolocation.
    if (process.env.NODE_ENV === 'development') {
      setLocation(TASHKENT_CENTER)
      setStatus('ready')
      setError(null)
      return
    }

    if (!navigator.geolocation) {
      setLocation(TASHKENT_CENTER)
      setStatus('fallback')
      setError('unsupported')
      return
    }

    setStatus('loading')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }

        if (!isInsideUzbekistan(next)) {
          setLocation(TASHKENT_CENTER)
          setStatus('fallback')
          setError('outside-uzbekistan')
          return
        }

        setLocation(next)
        setStatus('ready')
        setError(null)
      },
      (geolocationError) => {
        setLocation(TASHKENT_CENTER)
        setStatus('fallback')

        if (geolocationError.code === geolocationError.PERMISSION_DENIED) {
          setError('denied')
          return
        }

        if (geolocationError.code === geolocationError.POSITION_UNAVAILABLE) {
          setError('unavailable')
          return
        }

        if (geolocationError.code === geolocationError.TIMEOUT) {
          setError('timeout')
          return
        }

        setError('unavailable')
      },
      {
        enableHighAccuracy: false,
        timeout: 30_000,
        maximumAge: 10 * 60_000,
      },
    )
  }, [])

  return {
    location,
    status,
    error,
    locate,
  }
}
