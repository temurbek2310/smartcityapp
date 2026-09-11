"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink, LocateFixed, Navigation } from "lucide-react";
import { getParking } from "@/data/parkings";
import { useApp } from "@/context/app-context";
import { ParkingMap } from "@/components/map/parking-map";
import { useUserLocation } from "@/lib/use-user-location";
import { distanceKm } from "@/lib/geo";
import { formatDistance } from "@/lib/format";

export default function NavigatePage() {
  const params = useParams<{ kind: string; id: string }>();
  const { reservations } = useApp();
  const reservation = params.kind === "reservation" ? reservations.find((item) => item.id === params.id) : undefined;
  const parking = params.kind === "reservation" ? getParking(reservation?.parkingId ?? "") : getParking(params.id);
  const { location, status, locate } = useUserLocation();
  useEffect(() => { locate(); }, [locate]);
  if (!parking) return <div>Parking topilmadi.</div>;
  const distance = distanceKm(location, parking);
  const eta = Math.max(3, Math.round((distance / 30) * 60));
  const googleMapsHref = `https://www.google.com/maps/dir/?api=1&destination=${parking.lat},${parking.lng}`;

  return (
    <div className="space-y-4">
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Yo‘nalish ko‘rinishi</p><h1 className="mt-1 text-2xl font-black">{parking.name}</h1></div>
      <ParkingMap parkings={[parking]} userLocation={status === "ready" || status === "fallback" ? location : undefined} routeTo={{ lat: parking.lat, lng: parking.lng }} className="h-[52vh]" />
      <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-xs text-slate-500">Masofa</p><strong>{formatDistance(distance)}</strong></div><div className="rounded-2xl bg-slate-100 p-3 text-center"><p className="text-xs text-slate-500">Taxminiy vaqt</p><strong>~{eta} daq</strong></div><button onClick={locate} className="rounded-2xl bg-slate-100 p-3 text-center"><LocateFixed className={`mx-auto size-5 ${status === "loading" ? "animate-pulse" : ""}`} /><span className="mt-1 block text-xs font-bold">GPS</span></button></div>
      <p className="rounded-2xl bg-sky-50 p-3 text-xs leading-5 text-sky-800">MVP ichidagi chiziq road-routing emas, yo‘nalish preview. Real turn-by-turn uchun tashqi navigatorni ochishingiz mumkin.</p>
      <a href={googleMapsHref} target="_blank" rel="noreferrer" className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-slate-950 font-bold text-white"><Navigation className="size-5" /> Navigatorni ochish <ExternalLink className="size-4" /></a>
      {reservation && <Link href={`/reservation/${reservation.id}`} className="flex h-12 items-center justify-center rounded-2xl border border-slate-300 font-bold">Bron QR kodiga qaytish</Link>}
    </div>
  );
}
