import { todayISO, type WashoutStatus } from "@/lib/washout";

export function statusFor(
  clearanceDate: string | null | undefined,
  isProhibited: boolean | null | undefined,
  today: string = todayISO(),
): WashoutStatus {
  if (!clearanceDate) return "UNKNOWN";
  const pending = clearanceDate > today;
  if (isProhibited && pending) return "PROHIBITED";
  if (pending) return "PENDING";
  return "CLEARED";
}
