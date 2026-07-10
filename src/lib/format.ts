// Locale-aware number/date/duration formatting.
// The `*Bn` helpers always render Bengali; the locale-aware variants switch
// between Bengali and Western output based on the active locale.

export function toBnDigits(value: string | number): string {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(value).replace(/[0-9]/g, (d) => map[Number(d)]);
}

export function formatNumberBn(n: number): string {
  return toBnDigits(n.toLocaleString("en-US"));
}

export function formatDateTimeBn(iso: string): string {
  try {
    return new Date(iso).toLocaleString("bn-BD", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Seconds -> mm:ss (or h:mm:ss), for the exam countdown.
function durationString(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDurationBn(totalSeconds: number): string {
  return toBnDigits(durationString(totalSeconds));
}


export function formatNumber(n: number, locale: string): string {
  return locale === "en" ? n.toLocaleString("en-US") : formatNumberBn(n);
}

export function formatDateTime(iso: string, locale: string): string {
  if (locale !== "en") return formatDateTimeBn(iso);
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDuration(totalSeconds: number, locale: string): string {
  return locale === "en"
    ? durationString(totalSeconds)
    : formatDurationBn(totalSeconds);
}
