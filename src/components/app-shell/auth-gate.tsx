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
    if (hydrated && !user) router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, pathname]);

  if (!hydrated || !user) return <LoadingScreen />;
  return <>{children}</>;
}
