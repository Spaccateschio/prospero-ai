import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardWidgetItem = {
  id: string;
  kind: "widget";
  widgetKey: string;
  size: "sm" | "md" | "lg";
};

export type DashboardFolderItem = {
  id: string;
  kind: "folder";
  name: string;
  size: "sm" | "md" | "lg";
  items: Array<{ widgetKey: string }>;
};

export type DashboardLayoutItem = DashboardWidgetItem | DashboardFolderItem;

export const getDashboardLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ company_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("dashboard_layouts")
      .select("layout")
      .eq("company_id", data.company_id)
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { layout: (row?.layout ?? null) as DashboardLayoutItem[] | null };
  });

const WidgetItemSchema = z.object({
  id: z.string(),
  kind: z.literal("widget"),
  widgetKey: z.string(),
  size: z.enum(["sm", "md", "lg"]),
});
const FolderItemSchema = z.object({
  id: z.string(),
  kind: z.literal("folder"),
  name: z.string().max(60),
  size: z.enum(["sm", "md", "lg"]),
  items: z.array(z.object({ widgetKey: z.string() })).max(30),
});

export const saveDashboardLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      layout: z.array(z.union([WidgetItemSchema, FolderItemSchema])).max(60),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("dashboard_layouts").upsert(
      {
        user_id: userId,
        company_id: data.company_id,
        name: "Default",
        is_default: true,
        layout: data.layout as unknown as import("@/integrations/supabase/types").Json,
      },
      { onConflict: "user_id,company_id,name" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
