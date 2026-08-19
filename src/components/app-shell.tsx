import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Pill,
  Users,
  FileBarChart2,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, useProfile } from "@/hooks/use-session";

const NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/drugs", label: "Drug Search", Icon: Pill },
  { to: "/calculator", label: "Washout Calculator", Icon: Activity },
  { to: "/patients", label: "Patients", Icon: Users },
  { to: "/studies", label: "Studies", Icon: FlaskConical },
  { to: "/reports", label: "Reports", Icon: FileBarChart2 },
] as const;

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <ClipboardList className="h-5 w-5 text-sidebar-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-sidebar-accent-foreground">
              WASHOUT
            </p>
            <p className="text-[11px] text-sidebar-foreground/70">ConMed Mapper</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{
                className:
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm bg-sidebar-accent text-sidebar-accent-foreground font-semibold",
              }}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4 text-xs">
          <p className="truncate font-medium text-sidebar-accent-foreground">
            {profile?.fullName || profile?.email || "Signed in"}
          </p>
          <p className="text-sidebar-foreground/70">
            {profile ? ROLE_LABELS[profile.primaryRole] : "—"}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-3 inline-flex items-center gap-1.5 text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
              {description ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Button variant="ghost" size="sm" className="md:hidden" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
            {NAV.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-muted-foreground"
                activeProps={{
                  className:
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-xs bg-secondary text-secondary-foreground font-semibold",
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
