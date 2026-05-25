import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, Spinner, EmptyState, Badge } from "@/components/ui-kit";
import { Modal } from "@/components/Modal";
import { Plus, Phone, Users, FileText, Bell, Check, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/activities")({
  component: ActivitiesPage,
});

type ActType = "call" | "meeting" | "note" | "follow_up";
type Activity = {
  id: string;
  owner_id: string;
  type: ActType;
  subject: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  lead_id: string | null;
  deal_id: string | null;
};

const ICONS: Record<ActType, React.ComponentType<{ className?: string }>> = {
  call: Phone, meeting: Users, note: FileText, follow_up: Bell,
};
const LABEL: Record<ActType, string> = { call: "Call", meeting: "Meeting", note: "Note", follow_up: "Follow-up" };

const schema = z.object({
  type: z.enum(["call", "meeting", "note", "follow_up"]),
  subject: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional(),
  due_date: z.string().optional(),
  lead_id: z.string().optional(),
  deal_id: z.string().optional(),
});
type ActForm = z.infer<typeof schema>;

function ActivitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["activities", filter],
    queryFn: async () => {
      let q = supabase.from("activities").select("*").order("due_date", { ascending: true, nullsFirst: false });
      if (filter) q = q.eq("type", filter as ActType);
      const { data, error } = await q;
      if (error) throw error;
      return data as Activity[];
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-min"],
    queryFn: async () => (await supabase.from("leads").select("id, name").order("name")).data ?? [],
  });
  const { data: deals } = useQuery({
    queryKey: ["deals-min"],
    queryFn: async () => (await supabase.from("deals").select("id, title").order("title")).data ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (v: ActForm & { id?: string }) => {
      const payload = {
        type: v.type,
        subject: v.subject,
        description: v.description || null,
        due_date: v.due_date || null,
        lead_id: v.lead_id || null,
        deal_id: v.deal_id || null,
        owner_id: user!.id,
      };
      if (v.id) {
        const { error } = await supabase.from("activities").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("activities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Saved");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from("activities").update({ completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deleted");
    },
  });

  return (
    <div>
      <PageHeader
        title="Activities"
        description="Calls, meetings, notes, and follow-ups"
        actions={
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New activity
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">All types</option>
          {(Object.keys(LABEL) as ActType[]).map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid h-48 place-items-center"><Spinner /></div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No activities" description="Log your first call, meeting, or follow-up." />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((a) => {
            const Icon = ICONS[a.type];
            return (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <button
                  onClick={() => toggle.mutate({ id: a.id, completed: !a.completed })}
                  className={`mt-0.5 grid h-5 w-5 place-items-center rounded border ${a.completed ? "border-success bg-success text-success-foreground" : "border-border"}`}
                >
                  {a.completed && <Check className="h-3 w-3" />}
                </button>
                <div className="grid h-8 w-8 place-items-center rounded-md bg-accent/10 text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className={`font-medium ${a.completed ? "text-muted-foreground line-through" : ""}`}>{a.subject}</div>
                    <Badge tone="info">{LABEL[a.type]}</Badge>
                  </div>
                  {a.description && <div className="mt-1 text-sm text-muted-foreground">{a.description}</div>}
                  {a.due_date && <div className="mt-1 text-xs text-muted-foreground">Due {new Date(a.due_date).toLocaleString()}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(a); setModalOpen(true); }} className="rounded p-1.5 hover:bg-muted"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => { if (confirm("Delete?")) del.mutate(a.id); }} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ActivityModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        initial={editing}
        leads={leads ?? []}
        deals={deals ?? []}
        onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })}
        submitting={upsert.isPending}
      />
    </div>
  );
}

function ActivityModal({
  open, onClose, initial, leads, deals, onSubmit, submitting,
}: {
  open: boolean; onClose: () => void; initial: Activity | null;
  leads: { id: string; name: string }[];
  deals: { id: string; title: string }[];
  onSubmit: (v: ActForm) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<ActForm>({
    type: initial?.type ?? "call",
    subject: initial?.subject ?? "",
    description: initial?.description ?? "",
    due_date: initial?.due_date ? initial.due_date.slice(0, 16) : "",
    lead_id: initial?.lead_id ?? "",
    deal_id: initial?.deal_id ?? "",
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
      open={open} onClose={onClose}
      title={initial ? "Edit activity" : "New activity"}
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
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ActType })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            {(Object.keys(LABEL) as ActType[]).map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Due</label>
          <input type="datetime-local" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-sm font-medium">Subject *</label>
          <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          {errs.subject && <p className="text-xs text-destructive">{errs.subject}</p>}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Lead</label>
          <select value={form.lead_id ?? ""} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— none —</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Deal</label>
          <select value={form.deal_id ?? ""} onChange={(e) => setForm({ ...form, deal_id: e.target.value })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            <option value="">— none —</option>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
        </div>
      </div>
    </Modal>
  );
}
