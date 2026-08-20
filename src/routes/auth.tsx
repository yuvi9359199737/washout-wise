import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROLE_LABELS, type AppRole } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WASHOUT ConMed Mapper" },
      {
        name: "description",
        content:
          "Sign in to WASHOUT to check patient medications against protocol restrictions and calculate washout clearance dates.",
      },
      { property: "og:title", content: "Sign in — WASHOUT ConMed Mapper" },
      {
        property: "og:description",
        content: "Secure access for clinical research coordinators, investigators and CRAs.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function describeAuthError(
  error: { message: string; code?: string; status?: number },
  email: string,
): { title: string; description: string } {
  const code = error.code ?? "";
  const message = error.message.toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return {
      title: "Email or password is incorrect",
      description: `No account matches ${email || "that email"} with this password. Check for typos, or use the Create account tab if you haven't registered yet.`,
    };
  }
  if (code === "email_not_confirmed" || message.includes("not confirmed")) {
    return {
      title: "Email address not confirmed yet",
      description:
        "Open the confirmation link we emailed you, then sign in again. If it never arrived, create the account again to get a fresh link.",
    };
  }
  if (code === "user_not_found") {
    return {
      title: "No account found for this email",
      description: "Switch to the Create account tab to register with this email address.",
    };
  }
  if (code === "over_email_send_rate_limit" || error.status === 429) {
    return {
      title: "Too many attempts",
      description: "Please wait a minute before trying again.",
    };
  }
  if (code === "user_banned") {
    return {
      title: "This account is locked",
      description: "Contact your study administrator to restore access.",
    };
  }
  if (message.includes("password") && message.includes("least")) {
    return {
      title: "Password is too short",
      description: "Use at least 6 characters.",
    };
  }
  if (message.includes("fetch") || message.includes("network")) {
    return {
      title: "Can't reach the server",
      description: "Check your internet connection and try again.",
    };
  }
  return {
    title: "Sign-in failed",
    description: `${error.message}. If this keeps happening, contact your study administrator.`,
  };
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("coordinator");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter your email and password", {
        description: "Both fields are required to sign in.",
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const { title, description } = describeAuthError(error, email);
      toast.error(title, { description });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName, role },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setAwaitingConfirm(true);
    toast.success("Account created — check your email to confirm it.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-sidebar-primary" aria-hidden="true" />
          <span className="text-lg font-bold tracking-[0.22em]">WASHOUT</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold text-sidebar-accent-foreground">
            Stop ConMed protocol deviations before they happen.
          </h2>
          <p className="mt-4 text-sm text-sidebar-foreground/80">
            WHO-DD standardisation, 5 × half-life clearance maths and per-protocol prohibited drug
            checks — in one screen, with an audit trail behind every calculation.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">
          De-identified subject data only. GCP-aligned audit logging enabled.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="text-lg font-bold tracking-[0.22em] text-primary">WASHOUT</span>
          </div>
          {awaitingConfirm ? (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Confirm your email</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Click
                it, then come back and sign in.
              </p>
              <Button className="mt-4 w-full" onClick={() => setAwaitingConfirm(false)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Work email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Site role</Label>
                    <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ROLE_LABELS) as AppRole[])
                          .filter((r) => r !== "admin")
                          .map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="underline underline-offset-4">
              Back to overview
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
