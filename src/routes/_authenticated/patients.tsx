import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useProfile } from "@/hooks/use-session";
import { statusFor } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/patients")({
  head: () => ({
    meta: [
      { title: "Subjects — ConMed tracking | WASHOUT" },
      {
        name: "description",
        content:
          "Pseudonymised subject roster with concomitant medication clearance status for every enrolled participant.",
      },
      { property: "og:title", content: "Subjects — WASHOUT" },
      { property: "og:description", content: "Track ConMed washout status per enrolled subject." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientsPage,
});

function PatientsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ study_id_number: "", pseudonym: "", study_id: "" });

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

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, study_id_number, pseudonym, status, enrollment_date, studies(protocol_number), patient_medications(id, clearance_date, is_prohibited)",
        )
        .order("study_id_number");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return patients.filter(
      (p) =>
        !q ||
        p.study_id_number.toLowerCase().includes(q) ||
        (p.pseudonym ?? "").toLowerCase().includes(q),
    );
  }, [patients, term]);

  const addPatient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("patients").insert({
        study_id_number: form.study_id_number.trim(),
        pseudonym: form.pseudonym.trim() || null,
        study_id: form.study_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subject enrolled");
      setOpen(false);
      setForm({ study_id_number: "", pseudonym: "", study_id: "" });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Subjects"
      description="Pseudonymised roster — no direct identifiers are stored."
      actions={
        profile?.canWrite ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Enroll subject
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enroll subject</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sid">Subject ID</Label>
                  <Input
                    id="sid"
                    placeholder="ONC-2024-0006"
                    value={form.study_id_number}
                    onChange={(e) => setForm({ ...form, study_id_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pseudo">Pseudonym</Label>
                  <Input
                    id="pseudo"
                    placeholder="Subject F"
                    value={form.pseudonym}
                    onChange={(e) => setForm({ ...form, pseudonym: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="study">Study</Label>
                  <Select
                    value={form.study_id}
                    onValueChange={(v) => setForm({ ...form, study_id: v })}
                  >
                    <SelectTrigger id="study">
                      <SelectValue placeholder="Select a study" />
                    </SelectTrigger>
                    <SelectContent>
                      {studies.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.protocol_number} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addPatient.mutate()}
                  disabled={!form.study_id_number.trim() || !form.study_id || addPatient.isPending}
                >
                  Enroll
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <Card>
        <CardContent className="p-5">
          <div className="relative max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="Search subject ID or pseudonym"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Search subjects"
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject ID</TableHead>
                  <TableHead>Pseudonym</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ConMeds</TableHead>
                  <TableHead>Clearance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Loading subjects…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      No subjects match this search.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => {
                    const meds =
                      (p.patient_medications as {
                        id: string;
                        clearance_date: string | null;
                        is_prohibited: boolean;
                      }[]) ?? [];
                    const statuses = meds.map((m) =>
                      statusFor(m.clearance_date, m.is_prohibited),
                    );
                    const worst = statuses.includes("PROHIBITED")
                      ? "PROHIBITED"
                      : statuses.includes("PENDING")
                        ? "PENDING"
                        : "CLEARED";
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.study_id_number}</TableCell>
                        <TableCell>{p.pseudonym ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {(p.studies as { protocol_number: string } | null)?.protocol_number ??
                            "—"}
                        </TableCell>
                        <TableCell className="capitalize">{p.status}</TableCell>
                        <TableCell>{meds.length}</TableCell>
                        <TableCell>
                          {meds.length === 0 ? (
                            <span className="text-sm text-muted-foreground">None recorded</span>
                          ) : (
                            <StatusBadge status={worst} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/patients/$id" params={{ id: p.id }}>
                              Open profile
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
