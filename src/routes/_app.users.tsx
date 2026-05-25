import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, Spinner, Badge } from "@/components/ui-kit";
import { ShieldCheck, User as UserIcon } from "lucide-react";

export const Route = createFileRoute("/_app/users")({
  component: UsersAdmin,
});

type Profile = { id: string; email: string | null; full_name: string | null; created_at: string };
type Role = { user_id: string; role: "admin" | "sales" };

function UsersAdmin() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return { profiles: (profiles ?? []) as Profile[], roles: (roles ?? []) as Role[] };
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-admin"] });
      toast.success("Role updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <Navigate to="/dashboard" />;
  if (isLoading) return <div className="grid h-64 place-items-center"><Spinner /></div>;

  const profiles = data?.profiles ?? [];
  const adminIds = new Set((data?.roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage team members and roles"
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const isUserAdmin = adminIds.has(p.id);
              const isSelf = p.id === user?.id;
              return (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted">
                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="font-medium">{p.full_name || "—"}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                  <td className="px-4 py-3">
                    {isUserAdmin ? <Badge tone="info"><ShieldCheck className="mr-1 inline h-3 w-3" />Admin</Badge> : <Badge>Sales</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      disabled={isSelf}
                      onClick={() => setRole.mutate({ userId: p.id, makeAdmin: !isUserAdmin })}
                      className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
                    >
                      {isUserAdmin ? "Revoke admin" : "Make admin"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">New signups default to the Sales role. Promote trusted users to Admin here.</p>
    </div>
  );
}
