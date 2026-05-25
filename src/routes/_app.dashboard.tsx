import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, StatCard, Spinner } from "@/components/ui-kit";
import { Users, Briefcase, TrendingUp, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const STAGES = ["prospect", "negotiation", "won", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  prospect: "Prospect", negotiation: "Negotiation", won: "Won", lost: "Lost",
};
const COLORS = ["oklch(0.55 0.13 245)", "oklch(0.78 0.15 75)", "oklch(0.62 0.14 152)", "oklch(0.58 0.22 27)"];

function Dashboard() {
  const { isAdmin } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [leads, deals, activities] = await Promise.all([
        supabase.from("leads").select("id, status, created_at"),
        supabase.from("deals").select("id, stage, value, created_at"),
        supabase.from("activities").select("id, type, completed, due_date"),
      ]);
      return {
        leads: leads.data ?? [],
        deals: deals.data ?? [],
        activities: activities.data ?? [],
      };
    },
  });

  if (isLoading) return <div className="grid h-64 place-items-center"><Spinner /></div>;

  const deals = data?.deals ?? [];
  const leads = data?.leads ?? [];
  const activities = data?.activities ?? [];

  const stageData = STAGES.map((s) => ({
    name: STAGE_LABEL[s],
    count: deals.filter((d) => d.stage === s).length,
    value: deals.filter((d) => d.stage === s).reduce((a, d) => a + Number(d.value ?? 0), 0),
  }));
  const wonValue = deals.filter((d) => d.stage === "won").reduce((a, d) => a + Number(d.value ?? 0), 0);
  const openValue = deals.filter((d) => d.stage === "prospect" || d.stage === "negotiation").reduce((a, d) => a + Number(d.value ?? 0), 0);
  const pendingActs = activities.filter((a) => !a.completed).length;

  return (
    <div>
      <PageHeader title="Dashboard" description={isAdmin ? "All team activity" : "Your sales activity"} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads" value={leads.length} icon={Users} />
        <StatCard label="Open deals" value={deals.filter((d) => d.stage !== "won" && d.stage !== "lost").length} icon={Briefcase} hint={`$${openValue.toLocaleString()} pipeline`} />
        <StatCard label="Won revenue" value={`$${wonValue.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Pending tasks" value={pendingActs} icon={TrendingUp} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-medium">Pipeline by stage</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 256)" />
                <XAxis dataKey="name" stroke="oklch(0.5 0.03 256)" fontSize={12} />
                <YAxis stroke="oklch(0.5 0.03 256)" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => name === "value" ? `$${v.toLocaleString()}` : v}
                />
                <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <div className="mb-4 text-sm font-medium">Deals by stage</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stageData} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {stageData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {stageData.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i] }} />{s.name}</div>
                <span className="text-muted-foreground">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
