import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode as string) === "signup" ? "signup" : "login",
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});
const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Required").max(100),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const nav = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const isSignup = mode === "signup";
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) nav({ to: "/dashboard" });
  }, [user, authLoading, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const schema = isSignup ? signupSchema : loginSchema;
    const result = schema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    const { error } = isSignup
      ? await signUp(form.email, form.password, form.fullName)
      : await signIn(form.email, form.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(isSignup ? "Account created" : "Welcome back");
    nav({ to: "/dashboard" });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent text-accent-foreground text-xs">P</div>
          Pulse CRM
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">Your sales pipeline, organized.</h2>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/70">
            Track leads, manage deals through every stage, and never miss a follow-up.
          </p>
        </div>
        <div className="text-xs text-sidebar-foreground/50">© Pulse CRM</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignup ? "Create your account" : "Sign in"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup ? "Start managing your pipeline" : "Welcome back to Pulse CRM"}
            </p>
          </div>

          {isSignup && (
            <Field label="Full name" error={errors.fullName}>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="input"
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="Email" error={errors.email}>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input"
              autoComplete="email"
            />
          </Field>
          <Field label="Password" error={errors.password}>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input"
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? "Create account" : "Sign in"}
          </button>

          <div className="text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>Already have an account? <Link to="/auth" className="text-accent hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link to="/auth" search={{ mode: "signup" }} className="text-accent hover:underline">Create account</Link></>
            )}
          </div>
        </form>
      </div>

      <style>{`
        .input { width:100%; border-radius:0.375rem; border:1px solid var(--color-border); background:var(--color-background); padding:0.5rem 0.75rem; font-size:0.875rem; outline:none; }
        .input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-ring) 20%, transparent); }
      `}</style>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
