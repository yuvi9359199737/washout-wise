import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Copy, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { RiskBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/hooks/use-session";
import { statusFor } from "@/lib/status";
import { calculateForMedication } from "@/lib/washout.functions";
import { buildEdcText, formatEdcDate } from "@/lib/washout";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  head: () => ({
    meta: [
      { title: "Subject profile — ConMed clearance | WASHOUT" },
      {
        name: "description",
        content:
          "Concomitant medication history, washout clearance dates and EDC-ready text for a single study subject.",
      },
      { property: "og:title", content: "Subject profile — WASHOUT" },
      {
        property: "og:description",
        content: "ConMed history and washout clearance for a study subject.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientProfilePage,
});

function PatientProfilePage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const runCalculation = useServerFn(calculateForMedication);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    drug_name_raw: "",
    dose: "",
    frequency: "",
    last_dose_date: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [patient, meds] = await Promise.all([
        supabase
          .from("patients")
          .select(
            "id, study_id_number, pseudonym, age, gender, status, enrollment_date, studies(name, protocol_number, indication)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("patient_medications")
          .select(
            "id, drug_name_raw, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk, drug_dictionary(preferred_name, atc_code, half_life_hours)",
          )
          .eq("patient_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (patient.error) throw patient.error;
      if (meds.error) throw meds.error;
      return { patient: patient.data, meds: meds.data ?? [] };
    },
  });

  const addMed = useMutation({
    mutationFn: async () => {
      const { data: drugs } = await supabase
        .from("drug_dictionary")
        .select("id, preferred_name")
        .ilike("preferred_name", form.drug_name_raw.trim());
      const { error } = await supabase.from("patient_medications").insert({
        patient_id: id,
        drug_name_raw: form.drug_name_raw.trim(),
        drug_dictionary_id: drugs?.[0]?.id ?? null,
        dose: form.dose.trim() || null,
        frequency: form.frequency.trim() || null,
        last_dose_date: form.last_dose_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medication recorded");
      setOpen(false);
      setForm({ drug_name_raw: "", dose: "", frequency: "", last_dose_date: "" });
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recalc = useMutation({
    mutationFn: (medicationId: string) => runCalculation({ data: { medicationId } }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({ queryKey: ["patient", id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const patient = data?.patient;
  const study = patient?.studies as
    | { name: string; protocol_number: string; indication: string | null }
    | null
    | undefined;

  return (
    <AppShell
      title={patient?.study_id_number ?? "Subject profile"}
      description={
        study ? `${study.protocol_number} — ${study.name}` : "Concomitant medication history"
      }
      actions={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/patients">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> All subjects
            </Link>
          </Button>
          {profile?.canWrite ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Add ConMed
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record concomitant medication</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="drug">Drug name</Label>
                    <Input
                      id="drug"
                      placeholder="Warfarin"
                      value={form.drug_name_raw}
                      onChange={(e) => setForm({ ...form, drug_name_raw: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="dose">Dose</Label>
                      <Input
                        id="dose"
                        placeholder="5 mg"
                        value={form.dose}
                        onChange={(e) => setForm({ ...form, dose: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="freq">Frequency</Label>
                      <Input
                        id="freq"
                        placeholder="Once daily"
                        value={form.frequency}
                        onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last">Last dose date</Label>
                    <Input
                      id="last"
                      type="date"
                      value={form.last_dose_date}
                      onChange={(e) => setForm({ ...form, last_dose_date: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => addMed.mutate()}
                    disabled={!form.drug_name_raw.trim() || addMed.isPending}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subject</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Detail label="Pseudonym" value={patient?.pseudonym ?? "—"} />
            <Detail label="Status" value={patient?.status ?? "—"} />
            <Detail label="Age" value={patient?.age ? String(patient.age) : "—"} />
            <Detail label="Gender" value={patient?.gender ?? "—"} />
            <Detail label="Enrolled" value={formatEdcDate(patient?.enrollment_date)} />
            <Detail label="Indication" value={study?.indication ?? "—"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Concomitant medications</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug</TableHead>
                  <TableHead>Dose / frequency</TableHead>
                  <TableHead>Last dose</TableHead>
                  <TableHead>Clearance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading medications…
                    </TableCell>
                  </TableRow>
                ) : (data?.meds ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No concomitant medications recorded for this subject.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.meds.map((med) => {
                    const dict = med.drug_dictionary as {
                      preferred_name: string;
                      atc_code: string | null;
                      half_life_hours: number | null;
                    } | null;
                    const status = statusFor(med.clearance_date, med.is_prohibited);
                    return (
                      <TableRow key={med.id}>
                        <TableCell>
                          <p className="font-medium capitalize">
                            {dict?.preferred_name ?? med.drug_name_raw}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {dict?.atc_code ?? "No ATC"}
                            {dict?.half_life_hours ? ` · t½ ${dict.half_life_hours} h` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {[med.dose, med.frequency].filter(Boolean).join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatEdcDate(med.last_dose_date)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatEdcDate(med.clearance_date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={status} />
                            <RiskBadge risk={med.protocol_deviation_risk} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  buildEdcText({
                                    preferredName: dict?.preferred_name ?? med.drug_name_raw,
                                    atcCode: dict?.atc_code ?? null,
                                    dose: med.dose,
                                    frequency: med.frequency,
                                    lastDoseDate: med.last_dose_date,
                                  }),
                                );
                                toast.success("EDC text copied");
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {profile?.canWrite ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={recalc.isPending}
                                onClick={() => recalc.mutate(med.id)}
                              >
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Recalculate
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  );
}
