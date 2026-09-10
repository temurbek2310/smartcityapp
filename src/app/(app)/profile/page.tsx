"use client";

import { useRouter } from "next/navigation";
import { CarFront, LogOut, MapPinned, Phone, RotateCcw, UserRound } from "lucide-react";
import { useApp } from "@/context/app-context";
import { formatUzbekPlate } from "@/lib/plate";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, resetDemo, reservations, favorites } = useApp();
  return <div className="space-y-6"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Account</p><h1 className="mt-1 text-3xl font-black">Profile</h1></div><section className="rounded-[2rem] bg-slate-950 p-6 text-white"><div className="grid size-16 place-items-center rounded-3xl bg-white/10"><UserRound className="size-8" /></div><h2 className="mt-5 text-2xl font-black">{user?.name}</h2><div className="mt-5 space-y-3 text-sm text-slate-300"><p className="flex items-center gap-2"><Phone className="size-4" /> {user?.phone}</p><p className="flex items-center gap-2"><CarFront className="size-4" /> {user?.vehiclePlate ? formatUzbekPlate(user.vehiclePlate) : ""}</p><p className="flex items-center gap-2"><MapPinned className="size-4" /> Uzbekistan MVP</p></div></section><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs text-slate-500">Bookings</p><strong className="mt-1 block text-2xl">{reservations.length}</strong></div><div className="rounded-2xl bg-slate-100 p-4"><p className="text-xs text-slate-500">Favorites</p><strong className="mt-1 block text-2xl">{favorites.length}</strong></div></div><section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Demo boundaries:</strong> OTP, gate scanner, real-time parking capacity and payment provider are simulated so the project runs without external credentials.</section><button onClick={() => { logout(); router.replace("/welcome"); }} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 font-black"><LogOut className="size-5" /> Logout</button><button onClick={() => { resetDemo(); router.replace("/welcome"); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-rose-600"><RotateCcw className="size-4" /> Reset demo data</button></div>;
}
