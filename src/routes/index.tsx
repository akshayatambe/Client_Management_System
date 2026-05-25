import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart3, Users, Briefcase, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs">P</div>
            Pulse CRM
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Built for modern sales teams
          </div>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight">
            Close more deals with a CRM that gets out of your way.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Track leads, manage your pipeline, and log every call, meeting, and follow-up — all in one clean workspace.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/auth" className="rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-muted">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-4">
          {[
            { icon: Users, title: "Lead management", desc: "Capture, qualify, and route leads to the right rep." },
            { icon: Briefcase, title: "Deal pipeline", desc: "Visualize stages from Prospect to Won." },
            { icon: CheckCircle2, title: "Activity tracking", desc: "Calls, meetings, notes & follow-ups." },
            { icon: BarChart3, title: "Analytics", desc: "Real-time dashboards & forecasts." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5">
              <f.icon className="h-5 w-5 text-accent" />
              <div className="mt-3 font-medium">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
