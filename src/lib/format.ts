export const UZ_TIME_ZONE = "Asia/Tashkent";

export function formatUZS(amount: number) {
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(amount))} soʻm`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: UZ_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: UZ_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
