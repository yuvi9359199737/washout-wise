import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/hooks/use-session";
import { buildEdcText, searchDrugs, todayISO } from "@/lib/washout";

export const Route = createFileRoute("/_authenticated/drugs")({
  head: () => ({
    meta: [
      { title: "Drug Search — WHO-DD standardisation | WASHOUT" },
      {
        name: "description",
        content:
          "Fuzzy-search medications and get the WHO-DD preferred term, ATC code, half-life and EDC-ready text.",
      },
      { property: "og:title", content: "Drug Search — WASHOUT" },
      {
        property: "og:description",
        content: "WHO-DD preferred terms, ATC codes and half-life data with misspelling tolerance.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DrugSearchPage,
});

function DrugSearchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    preferred_name: "",
    atc_code: "",
    half_life_hours: "",
    trade_names: "",
    common_misspellings: "",
  });

  const { data: drugs = [], isLoading } = useQuery({
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

  const results = useMemo(() => searchDrugs(term, drugs), [term, drugs]);

  const addDrug = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("drug_dictionary").insert({
        preferred_name: form.preferred_name.trim(),
        atc_code: form.atc_code.trim() || null,
        half_life_hours: form.half_life_hours ? Number(form.half_life_hours) : null,
        trade_names: form.trade_names
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        common_misspellings: form.common_misspellings
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        source: "Manual entry",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Drug added to the dictionary");
      setOpen(false);
      setForm({
        preferred_name: "",
        atc_code: "",
        half_life_hours: "",
        trade_names: "",
        common_misspellings: "",
      });
      queryClient.invalidateQueries({ queryKey: ["drugs"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function copyEdc(drug: (typeof drugs)[number]) {
    const text = buildEdcText({
      preferredName: drug.preferred_name,
      atcCode: drug.atc_code,
      dose: "__ mg",
      frequency: "Daily",
      lastDoseDate: todayISO(),
    });
    await navigator.clipboard.writeText(text);
    toast.success("EDC text copied", { description: text });
  }

  return (
    <AppShell
      title="Drug search"
      description="Type any spelling, trade name or ATC code — WASHOUT resolves it to the WHO-DD preferred term."
      actions={
        profile?.isAdmin ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> Add drug
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add dictionary entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pn">Preferred name</Label>
                  <Input
                    id="pn"
                    value={form.preferred_name}
                    onChange={(e) => setForm({ ...form, preferred_name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="atc">ATC code</Label>
                    <Input
                      id="atc"
                      value={form.atc_code}
                      onChange={(e) => setForm({ ...form, atc_code: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hl">Half-life (hours)</Label>
                    <Input
                      id="hl"
                      type="number"
                      step="0.1"
                      value={form.half_life_hours}
                      onChange={(e) => setForm({ ...form, half_life_hours: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tn">Trade names (comma separated)</Label>
                  <Input
                    id="tn"
                    value={form.trade_names}
                    onChange={(e) => setForm({ ...form, trade_names: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ms">Common misspellings (comma separated)</Label>
                  <Input
                    id="ms"
                    value={form.common_misspellings}
                    onChange={(e) => setForm({ ...form, common_misspellings: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => addDrug.mutate()}
                  disabled={!form.preferred_name.trim() || addDrug.isPending}
                >
                  Save drug
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null
      }
    >
      <Card>
        <CardContent className="p-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="pl-9"
              placeholder="e.g. omaprazole, Lipitor, C10AA05"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Search medications"
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preferred name (WHO-DD)</TableHead>
                  <TableHead>ATC code</TableHead>
                  <TableHead>Half-life</TableHead>
                  <TableHead>Trade names</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      Loading dictionary…
                    </TableCell>
                  </TableRow>
                ) : results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      No match for “{term}”. Try a shorter fragment or the trade name.
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((drug) => (
                    <TableRow key={drug.id}>
                      <TableCell className="font-medium">{drug.preferred_name}</TableCell>
                      <TableCell className="font-mono text-xs">{drug.atc_code ?? "—"}</TableCell>
                      <TableCell>
                        {drug.half_life_hours === null ? "—" : `${drug.half_life_hours} h`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {(drug.trade_names ?? []).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{drug.source}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyEdc(drug)}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy EDC text
                          </Button>
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate({ to: "/calculator", search: { drug: drug.id } })
                            }
                          >
                            Calculate clearance
                          </Button>
                        </div>
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
