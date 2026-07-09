// Bangla-locale formatting helpers. Numbers/dates render with Bengali digits.

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

// Seconds -> mm:ss (or h:mm:ss) with Bengali digits, for the exam countdown.
export function formatDurationBn(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  const base = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  return toBnDigits(base);
}
