"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { useApp } from "@/context/app-context";
import { getParking } from "@/data/parkings";
import { formatDateTime, formatUZS } from "@/lib/format";
import type { ReservationStatus } from "@/lib/types";

const filters: { value: "all" | ReservationStatus; label: string }[] = [
  { value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" },
];

export default function BookingsPage() {
  const { reservations } = useApp();
  const [filter, setFilter] = useState<(typeof filters)[number]["value"]>("all");
  const list = useMemo(() => reservations.filter((item) => filter === "all" || item.status === filter), [reservations, filter]);
  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Reservations</p><h1 className="mt-1 text-3xl font-black">Booking History</h1></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === item.value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{item.label}</button>)}</div>
      <div className="space-y-3">{list.map((reservation) => { const parking = getParking(reservation.parkingId); if (!parking) return null; const href = reservation.status === "active" ? `/session/${reservation.id}` : reservation.status === "completed" ? `/receipt/${reservation.id}` : `/reservation/${reservation.id}`; return <Link key={reservation.id} href={href} className="block rounded-3xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="block">{parking.name}</strong><p className="mt-1 text-xs text-slate-500">{formatDateTime(reservation.startAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${reservation.status === "active" ? "bg-emerald-50 text-emerald-700" : reservation.status === "completed" ? "bg-sky-50 text-sky-700" : reservation.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{reservation.status}</span></div><div className="mt-4 flex justify-between border-t border-slate-100 pt-3 text-sm"><span className="text-slate-500">{reservation.vehiclePlate}</span><strong>{formatUZS(reservation.finalTotal ?? reservation.estimatedTotal)}</strong></div></Link>; })}</div>
      {list.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center"><CalendarDays className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-bold">Booking yo'q</p><p className="mt-1 text-sm text-slate-500">Parkingni bron qilganingizda shu yerda paydo bo'ladi.</p><Link href="/home" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Parking topish</Link></div>}
    </div>
  );
}
