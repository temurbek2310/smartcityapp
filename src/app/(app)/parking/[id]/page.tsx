"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { BatteryCharging, Camera, Car, Clock3, Heart, MapPin, Navigation, ShieldCheck, Umbrella } from "lucide-react";
import { PARKINGS, getParking } from "@/data/parkings";
import { useApp } from "@/context/app-context";
import { formatUZS } from "@/lib/format";

const amenityIcons = { CCTV: Camera, "EV Charging": BatteryCharging, Valet: Car, Covered: Umbrella, Accessible: ShieldCheck } as const;

export default function ParkingDetailPage() {
  const params = useParams<{ id: string }>();
  const parking = getParking(params.id);
  const { favorites, toggleFavorite } = useApp();
  if (!parking) return <div className="rounded-3xl bg-rose-50 p-6 text-rose-700">Parking topilmadi.</div>;
  const favorite = favorites.includes(parking.id);
  const alternative = PARKINGS.find((item) => item.city === parking.city && item.id !== parking.id && item.availableSpaces > 0);

  return (
    <div className="space-y-6">
      <div className={`relative -mx-5 -mt-6 h-56 bg-gradient-to-br ${parking.accent} p-5 text-white`}><span className="absolute bottom-5 left-5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">{parking.city}</span><button onClick={() => toggleFavorite(parking.id)} className="absolute right-5 top-5 grid size-11 place-items-center rounded-full bg-white/20 backdrop-blur"><Heart className={`size-5 ${favorite ? "fill-white" : ""}`} /></button><div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" /></div>
      <section><div className="flex items-start justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight">{parking.name}</h1><p className="mt-2 flex items-center gap-1 text-sm text-slate-500"><MapPin className="size-4" /> {parking.address}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black ${parking.availableSpaces > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{parking.availableSpaces > 0 ? `${parking.availableSpaces} free` : "FULL"}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{parking.description}</p></section>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-100 p-4"><Clock3 className="size-5 text-slate-500" /><p className="mt-3 text-xs text-slate-500">Ish vaqti</p><strong className="mt-1 block text-sm">{parking.workingHours}</strong></div><div className="rounded-2xl bg-slate-100 p-4"><Car className="size-5 text-slate-500" /><p className="mt-3 text-xs text-slate-500">Narx</p><strong className="mt-1 block text-sm">{formatUZS(parking.pricePerHour)} / soat</strong></div></div>
      <section><h2 className="font-black">Xizmatlar</h2><div className="mt-3 grid grid-cols-2 gap-2">{parking.amenities.map((amenity) => { const Icon = amenityIcons[amenity]; return <div key={amenity} className="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm font-semibold"><Icon className="size-4 text-sky-600" />{amenity}</div>; })}</div></section>
      <div className="grid grid-cols-2 gap-3"><Link href={`/navigate/parking/${parking.id}`} className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-slate-300 font-bold"><Navigation className="size-5" /> Navigate</Link>{parking.availableSpaces > 0 ? <Link href={`/reserve/${parking.id}`} className="flex h-13 items-center justify-center rounded-2xl bg-slate-950 font-bold text-white">Reserve</Link> : <span className="flex h-13 items-center justify-center rounded-2xl bg-slate-200 font-bold text-slate-500">FULL</span>}</div>{parking.availableSpaces === 0 && alternative && <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-900"><strong>Parking to'lgan.</strong> Alternativ: <Link href={`/parking/${alternative.id}`} className="font-black underline">{alternative.name}</Link> · {alternative.availableSpaces} free.</div>}
    </div>
  );
}
