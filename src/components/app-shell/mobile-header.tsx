"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useApp } from "@/context/app-context";

export function MobileHeader() {
  const { unreadCount } = useApp();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/home" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">B</span>
          <div>
            <p className="font-bold leading-none tracking-tight text-slate-950">B SPACE</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">Uzbekistan MVP</p>
          </div>
        </Link>
        <Link href="/notifications" className="relative grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700" aria-label="Notifications">
          <Bell className="size-5" />
          {unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-5 text-white">{Math.min(unreadCount, 9)}</span>}
        </Link>
      </div>
    </header>
  );
}
