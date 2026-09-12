"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/app-context";
import { LoadingScreen } from "@/components/ui/loading-screen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { hydrated, user } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hydrated || user) return;
    // The query matters — without it /favorites?tab=parking would come back
    // as bare /favorites. Read straight off location rather than through
    // useSearchParams(): this gate wraps every (app) route, and that hook
    // would drag all of them out of static prerendering for a value only
    // ever needed here, inside an effect that is already client-only.
    const next = pathname + window.location.search;
    router.replace(`/welcome?next=${encodeURIComponent(next)}`);
  }, [hydrated, user, router, pathname]);

  if (!hydrated || !user) return <LoadingScreen />;
  return <>{children}</>;
}
