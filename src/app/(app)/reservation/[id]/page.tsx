"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Navigation, QrCode as QrIcon, X } from "lucide-react";
import { useApp } from "@/context/app-context";
import { getParking } from "@/data/parkings";
import { formatDateTime, formatDuration, formatUZS } from "@/lib/format";
import { reservationCode } from "@/lib/reservation";
import { QrImage } from "@/components/ui/qr-image";

export default function ReservationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { reservations, cancelReservation, enterReservation } = useApp();
  const reservation = reservations.find((item) => item.id === params.id);
  const parking = reservation ? getParking(reservation.parkingId) : undefined;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const initialTimer = window.setTimeout(updateNow, 0);
    const intervalTimer = window.setInterval(updateNow, 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);
  const countdown = useMemo(() =>
    reservation && now !== null ? new Date(reservation.startAt).getTime() - now : 0,
    [reservation, now],
  );

  if (!reservation || !parking) return <div className="rounded-3xl bg-rose-50 p-6">Bron topilmadi.</div>;
  if (reservation.status === "active") return <div className="space-y-4"><p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Bu bron active parking sessiyasiga aylangan.</p><Link href={`/session/${reservation.id}`} className="flex h-13 items-center justify-center rounded-2xl bg-slate-950 font-bold text-white">Active session</Link></div>;
  if (reservation.status === "completed") return <Link href={`/receipt/${reservation.id}`} className="flex h-13 items-center justify-center rounded-2xl bg-slate-950 font-bold text-white">Chekni ko‘rish</Link>;

  if (reservation.status === "cancelled") return <div className="space-y-4 text-center"><div className="rounded-3xl bg-rose-50 p-6"><X className="mx-auto size-9 text-rose-500" /><h1 className="mt-3 text-2xl font-black text-rose-900">Bron bekor qilingan</h1><p className="mt-2 text-sm text-rose-700">Bu QR endi parkingga kirish uchun yaroqli emas.</p></div><Link href="/home" className="flex h-12 items-center justify-center rounded-2xl bg-slate-950 font-bold text-white">Yangi parking topish</Link></div>;

  return (
    <div className="space-y-6 text-center">
      <div><CheckCircle2 className="mx-auto size-12 text-emerald-500" /><p className="mt-4 text-xs font-bold uppercase tracking-[.2em] text-emerald-600">Reservation confirmed</p><h1 className="mt-2 text-3xl font-black">QR tayyor</h1><p className="mt-2 text-sm text-slate-500">{parking.name}</p></div>
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mx-auto w-fit rounded-3xl border border-slate-100 bg-white p-3"><QrImage value={reservationCode(reservation.id)} /></div><p className="mt-4 text-xs font-bold uppercase tracking-[.18em] text-slate-400">Reservation ID</p><p className="mt-1 break-all font-mono text-xs font-bold text-slate-700">{reservation.id}</p></section>
      <div className="rounded-3xl bg-slate-100 p-5 text-left"><div className="flex gap-3"><CalendarClock className="mt-0.5 size-5 shrink-0" /><div><p className="text-xs text-slate-500">Kelish vaqti</p><strong className="text-sm">{formatDateTime(reservation.startAt)}</strong><p className="mt-2 text-xs text-slate-500">{countdown > 0 ? `Boshlanishigacha ${formatDuration(countdown)}` : "Kirish oynasi ochiq — QRni skaner qiling."}</p></div></div><div className="mt-4 flex justify-between border-t border-slate-200 pt-4 text-sm"><span className="text-slate-500">Hisoblangan narx</span><strong>{formatUZS(reservation.estimatedTotal)}</strong></div></div>
      <div className="grid grid-cols-2 gap-3"><Link href={`/navigate/reservation/${reservation.id}`} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-300 font-bold"><Navigation className="size-5" /> Navigate</Link><button onClick={() => { enterReservation(reservation.id); router.push(`/session/${reservation.id}`); }} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-white"><QrIcon className="size-5" /> Simulate entry</button></div>
      <button onClick={() => { cancelReservation(reservation.id); router.push("/bookings"); }} className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600"><X className="size-4" /> Bronni bekor qilish</button>
    </div>
  );
}
