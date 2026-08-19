import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, FlaskConical, Pill, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { statusFor } from "@/lib/status";
import { formatEdcDate } from "@/lib/washout";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — WASHOUT ConMed Mapper" },
      {
        name: "description",
        content:
          "Live view of active studies, tracked medications and high-risk ConMed alerts across your site.",
      },
      { property: "og:title", content: "Dashboard — WASHOUT" },
      { property: "og:description", content: "Active studies, patients and ConMed risk at a glance." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [studies, patients, meds, activity] = await Promise.all([
        supabase.from("studies").select("id, name, protocol_number, status"),
        supabase.from("patients").select("id, study_id_number, status"),
        supabase
          .from("patient_medications")
          .select(
            "id, drug_name_raw, clearance_date, is_prohibited, protocol_deviation_risk, patient_id, patients(study_id_number)",
          ),
        supabase
          .from("audit_log")
          .select("id, action, summary, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      return {
        studies: studies.data ?? [],
        patients: patients.data ?? [],
        meds: meds.data ?? [],
        activity: activity.data ?? [],
      };
    },
  });

  const activeStudies = (data?.studies ?? []).filter((s) => s.status === "active").length;
  const alerts = (data?.meds ?? []).filter(
    (m) => statusFor(m.clearance_date, m.is_prohibited) === "PROHIBITED",
  );

  const metrics = [
    { label: "Active studies", value: activeStudies, Icon: FlaskConical },
    { label: "Patients tracked", value: data?.patients.length ?? 0, Icon: Users },
    { label: "Medications tracked", value: data?.meds.length ?? 0, Icon: Pill },
    { label: "High-risk alerts", value: alerts.length, Icon: AlertTriangle, danger: true },
  ];

  return (
    <AppShell
      title="Site dashboard"
      description="ConMed clearance status across every open protocol."
      actions={
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/drugs">Search drug</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/calculator">
              <Activity className="mr-1.5 h-4 w-4" /> Calculate clearance
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, Icon, danger }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p
                  className={`mt-1 text-3xl font-semibold ${danger && value > 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {isLoading ? "—" : value}
                </p>
              </div>
              <Icon
                className={`h-8 w-8 ${danger && value > 0 ? "text-destructive/70" : "text-primary/40"}`}
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Protocol deviation risk</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subject is currently on a prohibited medication that has not washed out.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {alerts.map((med) => (
                  <li key={med.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium capitalize">
                        {med.drug_name_raw}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(med.patients as { study_id_number: string } | null)?.study_id_number ??
                          "Unknown subject"}{" "}
                        · clears {formatEdcDate(med.clearance_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status="PROHIBITED" />
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/patients/$id" params={{ id: med.patient_id }}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.activity ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Calculations and record changes appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {data?.activity.map((entry) => (
                  <li key={entry.id} className="text-sm">
                    <p className="text-foreground">{entry.summary ?? entry.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
