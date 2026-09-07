"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useApp } from "@/context/app-context";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-slate-400">Updates</p><h1 className="mt-1 text-3xl font-black">Notifications</h1></div><button onClick={markAllNotificationsRead} className="inline-flex items-center gap-1 text-xs font-bold text-sky-600"><CheckCheck className="size-4" /> Read all</button></div><div className="space-y-3">{notifications.map((notification) => <button key={notification.id} onClick={() => markNotificationRead(notification.id)} className={`w-full rounded-3xl border p-4 text-left ${notification.read ? "border-slate-200 bg-white" : "border-sky-100 bg-sky-50"}`}><div className="flex gap-3"><div className={`grid size-10 shrink-0 place-items-center rounded-2xl ${notification.read ? "bg-slate-100" : "bg-white"}`}><Bell className="size-5" /></div><div><div className="flex items-center gap-2"><strong className="text-sm">{notification.title}</strong>{!notification.read && <span className="size-2 rounded-full bg-sky-500" />}</div><p className="mt-1 text-sm leading-5 text-slate-600">{notification.message}</p><p className="mt-2 text-[10px] font-medium text-slate-400">{formatDateTime(notification.createdAt)}</p></div></div></button>)}</div>{notifications.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">Notification yo'q.</div>}</div>;
}
