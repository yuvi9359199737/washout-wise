import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv, downloadPdf, type Row } from "@/lib/export";
import { statusFor } from "@/lib/status";
import { formatEdcDate, todayISO } from "@/lib/washout";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — ConMed clearance exports | WASHOUT" },
      {
        name: "description",
        content:
          "Export subject-level concomitant medication clearance reports to CSV or PDF for monitoring visits.",
      },
      { property: "og:title", content: "Reports — WASHOUT" },
      {
        property: "og:description",
        content: "CSV and PDF exports of ConMed washout clearance status.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

const HEADERS = [
  "Protocol",
  "Subject ID",
  "Drug",
  "ATC",
  "Dose",
  "Frequency",
  "Last dose",
  "Clearance",
  "Status",
  "Risk",
];

function ReportsPage() {
  const [studyId, setStudyId] = useState("all");
  const [status, setStatus] = useState("all");

  const { data: studies = [] } = useQuery({
    queryKey: ["studies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select("id, name, protocol_number, status")
        .order("protocol_number");
      if (error) throw error;
      return data;
    },
  });

  const { data: meds = [], isLoading } = useQuery({
    queryKey: ["report-meds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_medications")
        .select(
          "id, drug_name_raw, dose, frequency, last_dose_date, clearance_date, is_prohibited, protocol_deviation_risk, patients(study_id, study_id_number, studies(protocol_number)), drug_dictionary(preferred_name, atc_code)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    return meds
      .map((med) => {
        const patient = med.patients as {
          study_id: string;
          study_id_number: string;
          studies: { protocol_number: string } | null;
        } | null;
        const dict = med.drug_dictionary as {
          preferred_name: string;
          atc_code: string | null;
        } | null;
        return {
          id: med.id,
          studyId: patient?.study_id ?? "",
          protocol: patient?.studies?.protocol_number ?? "—",
          subject: patient?.study_id_number ?? "—",
          drug: dict?.preferred_name ?? med.drug_name_raw,
          atc: dict?.atc_code ?? "—",
          dose: med.dose ?? "—",
          frequency: med.frequency ?? "—",
          lastDose: formatEdcDate(med.last_dose_date),
          clearance: formatEdcDate(med.clearance_date),
          status: statusFor(med.clearance_date, med.is_prohibited),
          risk: med.protocol_deviation_risk,
        };
      })
      .filter((r) => (studyId === "all" || r.studyId === studyId) && (status === "all" || r.status === status));
  }, [meds, studyId, status]);

  const exportRows: Row[] = rows.map((r) => [
    r.protocol,
    r.subject,
    r.drug,
    r.atc,
    r.dose,
    r.frequency,
    r.lastDose,
    r.clearance,
    r.status,
    r.risk,
  ]);

  const subtitle = `Generated ${formatEdcDate(todayISO())} · ${rows.length} record${rows.length === 1 ? "" : "s"}`;

  return (
    <AppShell
      title="Reports"
      description="Monitor-ready ConMed clearance exports."
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length === 0}
            onClick={() => downloadCsv("washout-conmed-report", HEADERS, exportRows)}
          >
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            disabled={rows.length === 0}
            onClick={() =>
              downloadPdf(
                "washout-conmed-report",
                "ConMed clearance report",
                subtitle,
                HEADERS,
                exportRows,
              )
            }
          >
            <FileText className="mr-1.5 h-4 w-4" /> PDF
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={studyId} onValueChange={setStudyId}>
              <SelectTrigger className="w-64" aria-label="Filter by study">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All studies</SelectItem>
                {studies.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.protocol_number} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="CLEARED">Cleared</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROHIBITED">Prohibited</SelectItem>
                <SelectItem value="UNKNOWN">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Last dose</TableHead>
                  <TableHead>Clearance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading records…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No medication records match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.protocol}</TableCell>
                      <TableCell className="font-medium">{r.subject}</TableCell>
                      <TableCell className="capitalize">{r.drug}</TableCell>
                      <TableCell className="text-sm">{r.lastDose}</TableCell>
                      <TableCell className="text-sm">{r.clearance}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
