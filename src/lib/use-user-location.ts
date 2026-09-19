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
  // The map has to be centred on something before a fix arrives, and the
  // city centre is the honest choice. It is never reported as the customer's
  // position: `status` stays 'idle' until a fix, and anything but 'ready'
  // means this is a stand-in the screen must label as one.
  const [location, setLocation] = useState<Coordinate>(TASHKENT_CENTER)
  const [status, setStatus] = useState<LocationStatus>('idle')
  const [error, setError] = useState<LocationError>(null)

  const locate = useCallback(() => {
    // No shortcut here, in any environment. A development build used to
    // report Tashkent's centre as a real fix — status 'ready', no error —
    // which told every screen the customer was standing there and hid the
    // permission UX from the only people able to test it.
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
