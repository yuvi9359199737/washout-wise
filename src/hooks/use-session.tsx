import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "coordinator" | "pi" | "cra";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  coordinator: "Study Coordinator",
  pi: "Principal Investigator",
  cra: "Clinical Research Associate",
};

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const [profile, roles] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      const roleList = (roles.data ?? []).map((r) => r.role as AppRole);
      return {
        fullName: profile.data?.full_name ?? "",
        email: profile.data?.email ?? user?.email ?? "",
        roles: roleList,
        primaryRole: (roleList[0] ?? "coordinator") as AppRole,
        isAdmin: roleList.includes("admin"),
        canWrite: roleList.some((r) => r === "admin" || r === "coordinator" || r === "pi"),
      };
    },
  });
}
