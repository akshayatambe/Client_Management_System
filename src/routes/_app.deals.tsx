import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, Spinner, EmptyState } from "@/components/ui-kit";
import { Modal } from "@/components/Modal";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/deals")({
  component: DealsPage,
});

type Stage = "prospect" | "negotiation" | "won" | "lost";
const STAGES: { id: Stage; label: string; color: string }[] = [
  { id: "prospect", label: "Prospect", color: "border-t-chart-1" },
  { id: "negotiation", label: "Negotiation", color: "border-t-chart-3" },
  { id: "won", label: "Won", color: "border-t-chart-2" },
  { id: "lost", label: "Lost", color: "border-t-chart-4" },
];

type Deal = {
  id: string;
  owner_id: string;
  lead_id: string | null;
  title: string;
  value: number;
  stage: Stage;
  expected_close_date: string | null;
  notes: string | null;
};

const schema = z.object({
  title: z.string().trim().min(1).max(150),
  value: z.coerce.number().min(0).max(999999999),
  stage: z.enum(["prospect", "negotiation", "won", "lost"]),
  expected_close_date: z.string().optional(),
  lead_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});
type DealForm = z.infer<typeof schema>;

function DealsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deal[];
    },
  });
  const { data: leads } = useQuery({
    queryKey: ["leads-min"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id, name").order("name");
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (vals: DealForm & { id?: string }) => {
      const payload = {
        title: vals.title,
        value: vals.value,
        stage: vals.stage,
        expected_close_date: vals.expected_close_date || null,
        lead_id: vals.lead_id || null,
        notes: vals.notes || null,
        owner_id: user!.id,
      };
      if (vals.id) {
        const { error } = await supabase.from("deals").update(payload).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deals").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Saved");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase.from("deals").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="grid h-64 place-items-center"><Spinner /></div>;
  const deals = data ?? [];

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Pipeline overview"
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New deal
          </button>
        }
      />

      {deals.length === 0 ? (
        <EmptyState title="No deals yet" description="Create your first deal to start tracking your pipeline." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((s) => {
            const items = deals.filter((d) => d.stage === s.id);
            const total = items.reduce((a, d) => a + Number(d.value), 0);
            return (
              <div key={s.id} className={`rounded-lg border border-t-4 bg-card p-3 ${s.color}`}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{items.length} • ${total.toLocaleString()}</div>
                </div>
                <div className="space-y-2">
                  {items.map((d) => (
                    <div key={d.id} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm">{d.title}</div>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(d); setModalOpen(true); }} className="rounded p-1 hover:bg-muted"><Pencil className="h-3 w-3" /></button>
                          <button onClick={() => { if (confirm("Delete?")) del.mutate(d.id); }} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-accent">${Number(d.value).toLocaleString()}</div>
                      {d.expected_close_date && <div className="mt-1 text-xs text-muted-foreground">Close: {d.expected_close_date}</div>}
                      <select
                        value={d.stage}
                        onChange={(e) => moveStage.mutate({ id: d.id, stage: e.target.value as Stage })}
                        className="mt-2 w-full rounded border bg-background px-2 py-1 text-xs"
                      >
                        {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                      </select>
                    </div>
                  ))}
                  {items.length === 0 && <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DealModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        initial={editing}
        leads={leads ?? []}
        onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })}
        submitting={upsert.isPending}
      />
    </div>
  );
}

function DealModal({
  open, onClose, initial, leads, onSubmit, submitting,
}: {
  open: boolean; onClose: () => void; initial: Deal | null;
  leads: { id: string; name: string }[];
  onSubmit: (v: DealForm) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<DealForm>({
    title: initial?.title ?? "",
    value: initial?.value ?? 0,
    stage: initial?.stage ?? "prospect",
    expected_close_date: initial?.expected_close_date ?? "",
    lead_id: initial?.lead_id ?? "",
    notes: initial?.notes ?? "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  function submit() {
    const r = schema.safeParse(form);
    if (!r.success) {
      const e: Record<string, string> = {};
      r.error.issues.forEach((i) => e[i.path[0] as string] = i.message);
      setErrs(e);
      return;
    }
    onSubmit(r.data);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit deal" : "New deal"}
      footer={
        <>
          <button onClick={onClose} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={submitting} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-sm font-medium">Title *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          {errs.title && <p className="text-xs text-destructive">{errs.title}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Value (USD)</label>
          <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Stage</label>
          <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Expected close</label>
          <input type="date" value={form.expected_close_date ?? ""} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Lead</label>
          <select value={form.lead_id ?? ""} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— none —</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
      </div>
    </Modal>
  );
}
