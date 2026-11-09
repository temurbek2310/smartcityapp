import { SmartCityLogo } from '@/components/ui/smartcity-logo'

export function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink text-white">
      <div className="text-center">
        <SmartCityLogo className="mx-auto size-16 animate-pulse" rounded="rounded-2xl" />
        <p className="mt-4 text-sm font-medium text-ink-3">SmartCity yuklanmoqda…</p>
      </div>
    </div>
  );
}
