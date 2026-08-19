export type WashoutStatus = "CLEARED" | "PENDING" | "PROHIBITED" | "UNKNOWN";
export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface WashoutInput {
  halfLifeHours: number | null | undefined;
  lastDoseDate: string | null | undefined;
  isProhibited: boolean;
  washoutDaysRequired?: number | null;
  today?: string;
}

export interface WashoutResult {
  status: WashoutStatus;
  risk: RiskLevel;
  clearanceDate: string | null;
  halfLifeUsed: number | null;
  daysRemaining: number | null;
  isProhibited: boolean;
  message: string;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** DD-MON-YYYY, the format EDC systems expect. */
export function formatEdcDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/**
 * 5 x half-life rule, rounded up to whole days. When the protocol specifies a
 * minimum washout period, the later of the two dates wins.
 */
export function calculateWashout(input: WashoutInput): WashoutResult {
  const today = input.today ?? todayISO();
  const halfLife =
    typeof input.halfLifeHours === "number" && Number.isFinite(input.halfLifeHours)
      ? input.halfLifeHours
      : null;
  const required = input.washoutDaysRequired ?? 0;

  if (!input.lastDoseDate) {
    return {
      status: "UNKNOWN",
      risk: "unknown",
      clearanceDate: null,
      halfLifeUsed: halfLife,
      daysRemaining: null,
      isProhibited: input.isProhibited,
      message: "No last dose date recorded — clearance cannot be calculated.",
    };
  }

  if (halfLife === null && required <= 0) {
    return {
      status: "UNKNOWN",
      risk: "unknown",
      clearanceDate: null,
      halfLifeUsed: null,
      daysRemaining: null,
      isProhibited: input.isProhibited,
      message: "Half-life data not available for this drug.",
    };
  }

  const halfLifeDays = halfLife === null ? 0 : Math.ceil((5 * halfLife) / 24);
  const days = Math.max(halfLifeDays, required);
  const clearanceDate = addDays(input.lastDoseDate, days);
  const daysRemaining = diffDays(today, clearanceDate);
  const cleared = daysRemaining <= 0;

  if (input.isProhibited && !cleared) {
    return {
      status: "PROHIBITED",
      risk: "high",
      clearanceDate,
      halfLifeUsed: halfLife,
      daysRemaining,
      isProhibited: true,
      message: `Protocol-prohibited drug still active. Do not enrol before ${formatEdcDate(clearanceDate)} (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).`,
    };
  }

  if (input.isProhibited && cleared) {
    return {
      status: "CLEARED",
      risk: "low",
      clearanceDate,
      halfLifeUsed: halfLife,
      daysRemaining,
      isProhibited: true,
      message: `Prohibited drug has washed out as of ${formatEdcDate(clearanceDate)}. Safe to enrol.`,
    };
  }

  if (!cleared) {
    return {
      status: "PENDING",
      risk: "low",
      clearanceDate,
      halfLifeUsed: halfLife,
      daysRemaining,
      isProhibited: false,
      message: `Not prohibited by this protocol. Estimated clearance ${formatEdcDate(clearanceDate)}.`,
    };
  }

  return {
    status: "CLEARED",
    risk: "low",
    clearanceDate,
    halfLifeUsed: halfLife,
    daysRemaining,
    isProhibited: false,
    message: `Not prohibited by this protocol. Cleared since ${formatEdcDate(clearanceDate)}.`,
  };
}

export interface EdcTextInput {
  preferredName: string;
  atcCode?: string | null;
  dose?: string | null;
  frequency?: string | null;
  lastDoseDate?: string | null;
}

export function buildEdcText(input: EdcTextInput): string {
  const parts = [
    input.atcCode
      ? `${input.preferredName.toUpperCase()} (ATC: ${input.atcCode})`
      : input.preferredName.toUpperCase(),
    input.dose ?? "—",
    input.frequency ?? "—",
    `Last dose: ${formatEdcDate(input.lastDoseDate)}`,
  ];
  return parts.join(" | ");
}

export interface SearchableDrug {
  preferred_name: string;
  atc_code: string | null;
  trade_names: string[] | null;
  common_misspellings: string[] | null;
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const curr = [i];
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[cols - 1] ?? 0;
}

/**
 * Fuzzy match a typed term against a WHO-DD entry. Returns 0 when there is no
 * plausible match, otherwise a score where higher is a better match.
 */
export function matchScore(term: string, drug: SearchableDrug): number {
  const q = normalise(term);
  if (!q) return 1;
  const name = normalise(drug.preferred_name);
  const candidates: Array<{ text: string; weight: number }> = [
    { text: name, weight: 100 },
    ...(drug.trade_names ?? []).map((t) => ({ text: normalise(t), weight: 80 })),
    ...(drug.common_misspellings ?? []).map((t) => ({ text: normalise(t), weight: 70 })),
  ];
  if (drug.atc_code && normalise(drug.atc_code).startsWith(q)) return 95;

  let best = 0;
  for (const candidate of candidates) {
    if (!candidate.text) continue;
    if (candidate.text === q) best = Math.max(best, candidate.weight + 20);
    else if (candidate.text.startsWith(q)) best = Math.max(best, candidate.weight + 10);
    else if (candidate.text.includes(q)) best = Math.max(best, candidate.weight);
    else {
      const distance = editDistance(q, candidate.text);
      const tolerance = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3;
      if (distance <= tolerance) best = Math.max(best, candidate.weight - distance * 10);
    }
  }
  return best;
}

export function searchDrugs<T extends SearchableDrug>(term: string, drugs: T[]): T[] {
  if (!term.trim()) return drugs;
  return drugs
    .map((drug) => ({ drug, score: matchScore(term, drug) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.drug);
}
