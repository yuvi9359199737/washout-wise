import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
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
import { useProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/studies")({
  head: () => ({
    meta: [
      { title: "Study Manager — protocols & prohibited drugs | WASHOUT" },
      {
        name: "description",
        content:
          "Manage clinical protocols and the prohibited concomitant medication list with required washout periods.",
      },
      { property: "og:title", content: "Study Manager — WASHOUT" },
      {
        property: "og:description",
        content: "Protocols and prohibited ConMed lists with required washout windows.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudiesPage,
});

function StudiesPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [selected, setSelected] = useState<string | null>(null);
  const [studyOpen, setStudyOpen] = useState(false);
  const [studyForm, setStudyForm] = useState({
    name: "",
    protocol_number: "",
    phase: "",
    indication: "",
  });
  const [drugForm, setDrugForm] = useState({ drug_name: "", washout_days_required: "" });

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["studies-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("studies")
        .select(
          "id, name, protocol_number, phase, indication, status, prohibited_drugs(id, drug_name, washout_days_required, reason)",
        )
        .order("protocol_number");
      if (error) throw error;
      return data;
    },
  });

  const activeStudy = studies.find((s) => s.id === (selected ?? studies[0]?.id));

  const addStudy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("studies").insert({
        name: studyForm.name.trim(),
        protocol_number: studyForm.protocol_number.trim(),
        phase: studyForm.phase.trim() || null,
        indication: studyForm.indication.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Study created");
      setStudyOpen(false);
      setStudyForm({ name: "", protocol_number: "", phase: "", indication: "" });
      queryClient.invalidateQueries({ queryKey: ["studies-full"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addProhibited = useMutation({
    mutationFn: async () => {
      if (!activeStudy) throw new Error("Select a study first");
      const { error } = await supabase.from("prohibited_drugs").insert({
        study_id: activeStudy.id,
        drug_name: drugForm.drug_name.trim(),
        washout_days_required: Number(drugForm.washout_days_required) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prohibited medication added");
      setDrugForm({ drug_name: "", washout_days_required: "" });
      queryClient.invalidateQueries({ queryKey: ["studies-full"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeProhibited = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prohibited_drugs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      queryClient.invalidateQueries({ queryKey: ["studies-full"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Study manager"
      description="Protocols and their prohibited concomitant medication lists."
      actions={
        profile?.canWrite ? (
          <Dialog open={studyOpen} onOpenChange={setStudyOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> New study
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create study</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pn">Protocol number</Label>
                  <Input
                    id="pn"
                    placeholder="ONC-2024-01"
                    value={studyForm.protocol_number}
                    onChange={(e) =>
                      setStudyForm({ ...studyForm, protocol_number: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sn">Study name</Label>
                  <Input
                    id="sn"
                    value={studyForm.name}
                    onChange={(e) => setStudyForm({ ...studyForm, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="ph">Phase</Label>
                    <Input
                      id="ph"
                      placeholder="Phase II"
                      value={studyForm.phase}
                      onChange={(e) => setStudyForm({ ...studyForm, phase: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ind">Indication</Label>
                    <Input
                      id="ind"
                      value={studyForm.indication}
                      onChange={(e) => setStudyForm({ ...studyForm, indication: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addStudy.mutate()}
                  disabled={
                    !studyForm.name.trim() ||
                    !studyForm.protocol_number.trim() ||
                    addStudy.isPending
                  }
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Protocols</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading studies…</p>
            ) : studies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No studies yet.</p>
            ) : (
              studies.map((study) => (
                <button
                  key={study.id}
                  onClick={() => setSelected(study.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    activeStudy?.id === study.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="font-mono text-xs text-muted-foreground">
                    {study.protocol_number}
                  </p>
                  <p className="text-sm font-medium">{study.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {study.phase ?? "—"} · {study.status}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Prohibited medications {activeStudy ? `— ${activeStudy.protocol_number}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.canWrite && activeStudy ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pd">Drug name</Label>
                  <Input
                    id="pd"
                    placeholder="Warfarin"
                    value={drugForm.drug_name}
                    onChange={(e) => setDrugForm({ ...drugForm, drug_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wd">Washout days</Label>
                  <Input
                    id="wd"
                    type="number"
                    min={0}
                    className="w-32"
                    value={drugForm.washout_days_required}
                    onChange={(e) =>
                      setDrugForm({ ...drugForm, washout_days_required: e.target.value })
                    }
                  />
                </div>
                <Button
                  onClick={() => addProhibited.mutate()}
                  disabled={!drugForm.drug_name.trim() || addProhibited.isPending}
                >
                  Add
                </Button>
              </div>
            ) : null}

            <ul className="divide-y divide-border">
              {(
                (activeStudy?.prohibited_drugs as
                  | {
                      id: string;
                      drug_name: string;
                      washout_days_required: number;
                      reason: string | null;
                    }[]
                  | undefined) ?? []
              ).map((drug) => (
                <li key={drug.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium capitalize">{drug.drug_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Minimum washout {drug.washout_days_required} day
                      {drug.washout_days_required === 1 ? "" : "s"}
                      {drug.reason ? ` · ${drug.reason}` : ""}
                    </p>
                  </div>
                  {profile?.canWrite ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeProhibited.mutate(drug.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {activeStudy &&
            ((activeStudy.prohibited_drugs as unknown[] | undefined) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No prohibited medications defined for this protocol.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
