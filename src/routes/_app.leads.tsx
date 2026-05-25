import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounced } from "@/hooks/use-debounced";
import { PageHeader, Badge, EmptyState, Spinner } from "@/components/ui-kit";
import { Modal } from "@/components/Modal";
import { Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsPage,
});

const PAGE_SIZE = 10;

type Lead = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "unqualified";
  notes: string | null;
  created_at: string;
};

const schema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  source: z.string().trim().max(60).optional(),
  status: z.enum(["new", "contacted", "qualified", "unqualified"]),
  notes: z.string().trim().max(2000).optional(),
});
type LeadForm = z.infer<typeof schema>;

const STATUS_OPTS = ["new", "contacted", "qualified", "unqualified"] as const;
const STATUS_TONE: Record<string, "info" | "warning" | "success" | "destructive"> = {
  new: "info", contacted: "warning", qualified: "success", unqualified: "destructive",
};

function LeadsPage() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const debounced = useDebounced(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["leads", debounced, status, page],
    queryFn: async () => {
      let q = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false });
      if (debounced) q = q.or(`name.ilike.%${debounced}%,email.ilike.%${debounced}%,company.ilike.%${debounced}%`);
      if (status) q = q.eq("status", status as Lead["status"]);
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as Lead[], count: count ?? 0 };
    },
  });

  const upsert = useMutation({
    mutationFn: async (vals: LeadForm & { id?: string }) => {
      const payload = {
        name: vals.name,
        email: vals.email || null,
        phone: vals.phone || null,
        company: vals.company || null,
        source: vals.source || null,
        status: vals.status,
        notes: vals.notes || null,
        owner_id: user!.id,
      };
      if (vals.id) {
        const { error } = await supabase.from("leads").update(payload).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leads").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Lead updated" : "Lead created");
      setModalOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lead deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Leads"
        description={isAdmin ? "All leads across the team" : "Your leads"}
        actions={
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New lead
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search name, email, company"
            className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {isLoading ? (
          <div className="grid h-48 place-items-center"><Spinner /></div>
        ) : rows.length === 0 ? (
          <EmptyState title="No leads yet" description="Create your first lead to get started." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{l.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.company || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.email || "—"}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[l.status]}>{l.status}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.source || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button className="rounded p-1.5 hover:bg-muted" onClick={() => { setEditing(l); setModalOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm("Delete this lead?")) del.mutate(l.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>{data?.count ?? 0} total</div>
        <div className="flex items-center gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border p-1 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border p-1 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <LeadModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        initial={editing}
        onSubmit={(v) => upsert.mutate({ ...v, id: editing?.id })}
        submitting={upsert.isPending}
      />
    </div>
  );
}

function LeadModal({
  open, onClose, initial, onSubmit, submitting,
}: {
  open: boolean; onClose: () => void; initial: Lead | null;
  onSubmit: (v: LeadForm) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<LeadForm>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    company: initial?.company ?? "",
    source: initial?.source ?? "",
    status: initial?.status ?? "new",
    notes: initial?.notes ?? "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Reset form when 'initial' changes
  useState(() => { setErrs({}); });

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
      title={initial ? "Edit lead" : "New lead"}
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
        <FormInput label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={errs.name} />
        <FormInput label="Company" value={form.company ?? ""} onChange={(v) => setForm({ ...form, company: v })} />
        <FormInput label="Email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} error={errs.email} />
        <FormInput label="Phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} />
        <FormInput label="Source" value={form.source ?? ""} onChange={(v) => setForm({ ...form, source: v })} />
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as LeadForm["status"] })} className="w-full rounded-md border bg-background px-3 py-2 text-sm">
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
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

function FormInput({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
