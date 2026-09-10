"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, CreditCard, ReceiptText } from "lucide-react";
import { useApp } from "@/context/app-context";
import { getParking } from "@/data/parkings";
import { formatDateTime, formatUZS } from "@/lib/format";
import { formatUzbekPlate } from "@/lib/plate";

export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const { reservations } = useApp();
  const reservation = reservations.find((item) => item.id === params.id);
  const parking = reservation ? getParking(reservation.parkingId) : undefined;
  if (!reservation || !parking) return <div>Chek topilmadi.</div>;
  const total = reservation.finalTotal ?? reservation.estimatedTotal;
  return (
    <div className="space-y-6 text-center">
      <div><CheckCircle2 className="mx-auto size-14 text-emerald-500" /><p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-emerald-600">Payment successful</p><h1 className="mt-2 text-4xl font-black">{formatUZS(total)}</h1><p className="mt-2 text-sm text-slate-500">Mock payment · hech qanday real mablag‘ yechilmadi</p></div>
      <section className="rounded-4xl border border-slate-200 p-6 text-left"><div className="flex items-center gap-3 border-b border-slate-100 pb-5"><div className="grid size-12 place-items-center rounded-2xl bg-slate-100"><ReceiptText className="size-6" /></div><div><strong>{parking.name}</strong><p className="mt-1 text-xs text-slate-500">{reservation.exitedAt ? formatDateTime(reservation.exitedAt) : "Session completed"}</p></div></div><dl className="mt-5 space-y-3 text-sm"><div className="flex justify-between"><dt className="text-slate-500">Booking</dt><dd className="max-w-[55%] truncate font-mono text-xs">{reservation.id}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Vehicle</dt><dd className="font-bold">{formatUzbekPlate(reservation.vehiclePlate)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">Hourly rate</dt><dd className="font-bold">{formatUZS(reservation.pricePerHour)}</dd></div><div className="flex justify-between border-t border-slate-100 pt-3"><dt className="font-bold">Total paid</dt><dd className="font-black">{formatUZS(total)}</dd></div></dl><div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 p-4"><CreditCard className="size-5" /><div><p className="text-xs text-slate-500">Payment method</p><strong className="text-sm">B SPACE Demo •••• 4242</strong></div></div></section>
      <Link href="/bookings" className="flex h-13 items-center justify-center rounded-2xl bg-slate-950 font-black text-white">Booking history</Link>
    </div>
  );
}
