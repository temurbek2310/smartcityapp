"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useApp } from "@/context/app-context";
import { PARKINGS } from "@/data/parkings";
import { ParkingCard } from "@/components/parking/parking-card";

export default function FavoritesPage() {
  const { favorites } = useApp();
  const parkings = PARKINGS.filter((parking) => favorites.includes(parking.id));
  return <div className="space-y-6"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Saved</p><h1 className="mt-1 text-3xl font-black">Favorites</h1></div>{parkings.length ? <div className="space-y-4">{parkings.map((parking) => <ParkingCard key={parking.id} parking={parking} />)}</div> : <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center"><Heart className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-bold">Hali favorite yo'q</p><p className="mt-1 text-sm text-slate-500">Parking detail sahifasidagi yurak tugmasidan saqlang.</p><Link href="/home" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">Parkinglar</Link></div>}</div>;
}
