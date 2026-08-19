import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { RiskBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateAdHoc } from "@/lib/washout.functions";
import { buildEdcText, formatEdcDate, todayISO, type WashoutResult } from "@/lib/washout";

export const Route = createFileRoute("/_authenticated/calculator")({
  validateSearch: (search: Record<string, unknown>) => ({
    drug: typeof search["drug"] === "string" ? search["drug"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Washout Calculator — 5 × half-life clearance | WASHOUT" },
      {
        name: "description",
        content:
          "Calculate medication clearance dates with the 5 × half-life rule and check them against protocol washout requirements.",
      },
      { property: "og:title", content: "Washout Calculator — WASHOUT" },
      {
        property: "og:description",
        content: "Clearance dates, protocol compliance and EDC-ready text in one step.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalculatorPage,
});

function CalculatorPage() {
  const search = Route.useSearch();
  const runCalc = useServerFn(calculateAdHoc);
  const [drugId, setDrugId] = useState<string>(search.drug ?? "");
  const [patientId, setPatientId] = useState<string>("none");
  const [lastDose, setLastDose] = useState<string>(todayISO());
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("Daily");
  const [result, setResult] = useState<WashoutResult | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: drugs = [] } = useQuery({
    queryKey: ["drugs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_dictionary")
        .select("*")
        .order("preferred_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ["patients-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, study_id_number, pseudonym, studies(protocol_number)")
        .order("study_id_number");
      if (error) throw error;
      return data;
    },
  });

  const drug = drugs.find((d) => d.id === drugId);

  async function handleCalculate() {
    if (!drugId) {
      toast.error("Select a medication first");
      return;
    }
    setBusy(true);
    try {
      const res = await runCalc({
        data: {
          drugId,
          lastDoseDate: lastDose,
          patientId: patientId === "none" ? null : patientId,
        },
      });
      setResult(res);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calculation failed");
    } finally {
      setBusy(false);
    }
  }

  const edcText = drug
    ? buildEdcText({
        preferredName: drug.preferred_name,
        atcCode: drug.atc_code,
        dose: dose || null,
        frequency,
        lastDoseDate: lastDose,
      })
    : "";

  return (
    <AppShell
      title="Washout calculator"
      description="clearance date = last dose + 5 × half-life, or the protocol minimum — whichever is later."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="drug">Medication (WHO-DD)</Label>
              <Select value={drugId} onValueChange={setDrugId}>
                <SelectTrigger id="drug">
                  <SelectValue placeholder="Select a medication" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.preferred_name}
                      {d.atc_code ? ` (${d.atc_code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patient">Subject</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="patient">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No subject — dictionary lookup only</SelectItem>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.study_id_number} ·{" "}
                      {(p.studies as { protocol_number: string } | null)?.protocol_number ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selecting a subject checks the drug against that study&apos;s prohibited list.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dose">Dose</Label>
                <Input
                  id="dose"
                  placeholder="40mg"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="freq">Frequency</Label>
                <Input
                  id="freq"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastdose">Last dose date</Label>
              <Input
                id="lastdose"
                type="date"
                value={lastDose}
                onChange={(e) => setLastDose(e.target.value)}
              />
            </div>

            <Button onClick={handleCalculate} disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate clearance"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result ? (
              <p className="text-sm text-muted-foreground">
                Run a calculation to see the clearance date, protocol compliance and EDC-ready
                text.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={result.status} />
                  <RiskBadge risk={result.risk} />
                </div>
                <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-muted/40 p-4 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Clearance date</dt>
                    <dd className="mt-0.5 font-semibold">
                      {formatEdcDate(result.clearanceDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Half-life used</dt>
                    <dd className="mt-0.5 font-semibold">
                      {result.halfLifeUsed === null ? "—" : `${result.halfLifeUsed} h`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Protocol compliance</dt>
                    <dd className="mt-0.5 font-semibold">
                      {result.status === "PROHIBITED" ? "Not compliant" : "Compliant"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">Days remaining</dt>
                    <dd className="mt-0.5 font-semibold">
                      {result.daysRemaining === null
                        ? "—"
                        : Math.max(result.daysRemaining, 0)}
                    </dd>
                  </div>
                </dl>
                <p
                  className={`rounded-md border p-3 text-sm ${
                    result.status === "PROHIBITED"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-info/30 bg-info/10 text-info"
                  }`}
                >
                  {result.message}
                </p>
              </>
            )}

            {drug ? (
              <div className="space-y-2">
                <Label>EDC-ready text</Label>
                <div className="flex gap-2">
                  <code className="flex-1 overflow-x-auto rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                    {edcText}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy EDC text"
                    onClick={async () => {
                      await navigator.clipboard.writeText(edcText);
                      toast.success("EDC text copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
