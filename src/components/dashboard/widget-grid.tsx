import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Pencil, Check, Plus, X, Maximize2, Minimize2, GripVertical, Folder as FolderIcon,
  FolderPlus, Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import {
  getDashboardLayout, saveDashboardLayout,
  type DashboardLayoutItem, type DashboardFolderItem,
} from "@/lib/dashboard-layout.functions";
import { WIDGET_REGISTRY, DEFAULT_LAYOUT, getWidgetDef } from "@/components/dashboard/widgets";

const SIZE_COLS: Record<"sm" | "md" | "lg", string> = {
  sm: "col-span-1",
  md: "col-span-1 sm:col-span-2",
  lg: "col-span-1 sm:col-span-2 lg:col-span-3",
};
const SIZE_ORDER: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];

function newId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function WidgetGrid({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const fetchLayout = useServerFn(getDashboardLayout);
  const saveLayout = useServerFn(saveDashboardLayout);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-layout", companyId],
    queryFn: () => fetchLayout({ data: { company_id: companyId } }),
  });

  const [layout, setLayout] = useState<DashboardLayoutItem[] | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [openFolder, setOpenFolder] = useState<DashboardFolderItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [folderNameDraft, setFolderNameDraft] = useState("");

  useEffect(() => {
    if (data !== undefined && layout === null) {
      setLayout(data?.layout && data.layout.length > 0 ? data.layout : DEFAULT_LAYOUT);
    }
  }, [data, layout]);

  const saveMut = useMutation({
    mutationFn: (l: DashboardLayoutItem[]) => saveLayout({ data: { company_id: companyId, layout: l } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-layout", companyId] });
    },
    onError: (e) => toast.error("Errore salvataggio layout", { description: e instanceof Error ? e.message : "" }),
  });

  function commit(next: DashboardLayoutItem[]) {
    setLayout(next);
  }

  function exitEditMode() {
    setEditMode(false);
    setSelectMode(false);
    setSelected(new Set());
    if (layout) saveMut.mutate(layout);
  }

  function cycleSize(id: string) {
    if (!layout) return;
    commit(
      layout.map((item) => {
        if (item.id !== id) return item;
        const idx = SIZE_ORDER.indexOf(item.size);
        const next = SIZE_ORDER[(idx + 1) % SIZE_ORDER.length];
        return { ...item, size: next };
      }),
    );
  }

  function removeItem(id: string) {
    if (!layout) return;
    commit(layout.filter((item) => item.id !== id));
  }

  function handleDrop(targetId: string) {
    if (!layout || !dragId || dragId === targetId) { setDragId(null); return; }
    const from = layout.findIndex((i) => i.id === dragId);
    const to = layout.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    const next = [...layout];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
    setDragId(null);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function groupSelectedIntoFolder() {
    if (!layout || selected.size < 2) return;
    const selectedItems = layout.filter((i) => selected.has(i.id));
    const widgetRefs: Array<{ widgetKey: string }> = [];
    for (const item of selectedItems) {
      if (item.kind === "widget") widgetRefs.push({ widgetKey: item.widgetKey });
      else widgetRefs.push(...item.items);
    }
    const folder: DashboardFolderItem = {
      id: newId(),
      kind: "folder",
      name: folderNameDraft.trim() || "Nuova cartella",
      size: "sm",
      items: widgetRefs,
    };
    const firstIndex = layout.findIndex((i) => selected.has(i.id));
    const remaining = layout.filter((i) => !selected.has(i.id));
    remaining.splice(Math.min(firstIndex, remaining.length), 0, folder);
    commit(remaining);
    setSelected(new Set());
    setSelectMode(false);
    setFolderNameDraft("");
    toast.success("Cartella creata");
  }

  function removeFromFolder(folderId: string, widgetKey: string) {
    if (!layout) return;
    const next = layout.map((item) => {
      if (item.id !== folderId || item.kind !== "folder") return item;
      const items = item.items.filter((i) => i.widgetKey !== widgetKey);
      return { ...item, items };
    }).filter((item) => !(item.kind === "folder" && item.items.length === 0));
    commit(next);
    setOpenFolder((f) => {
      if (!f) return f;
      const items = f.items.filter((i) => i.widgetKey !== widgetKey);
      return items.length > 0 ? { ...f, items } : null;
    });
  }

  function addWidget(widgetKey: string) {
    if (!layout) return;
    const def = getWidgetDef(widgetKey);
    if (!def) return;
    commit([...layout, { id: newId(), kind: "widget", widgetKey, size: def.defaultSize }]);
    setAddOpen(false);
  }

  const usedWidgetKeys = useMemo(() => {
    const keys = new Set<string>();
    (layout ?? []).forEach((item) => {
      if (item.kind === "widget") keys.add(item.widgetKey);
      else item.items.forEach((i) => keys.add(i.widgetKey));
    });
    return keys;
  }, [layout]);

  const availableToAdd = WIDGET_REGISTRY.filter((w) => !usedWidgetKeys.has(w.key));

  if (isLoading || !layout) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {editMode && selectMode && (
          <div className="mr-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.size} selezionati</span>
            <Input
              placeholder="Nome cartella"
              value={folderNameDraft}
              onChange={(e) => setFolderNameDraft(e.target.value)}
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" variant="outline" disabled={selected.size < 2} onClick={groupSelectedIntoFolder}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Crea cartella
            </Button>
          </div>
        )}
        {editMode && (
          <>
            <Button size="sm" variant={selectMode ? "default" : "outline"} onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Raggruppa
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Aggiungi widget
            </Button>
          </>
        )}
        <Button size="sm" variant={editMode ? "default" : "outline"} onClick={() => (editMode ? exitEditMode() : setEditMode(true))}>
          {editMode ? <><Check className="mr-1.5 h-3.5 w-3.5" /> Fine</> : <><Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifica</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {layout.map((item) => (
          <div
            key={item.id}
            className={`${SIZE_COLS[item.size]} ${editMode ? "animate-[wiggle_0.25s_ease-in-out_infinite]" : ""}`}
            draggable={editMode && !selectMode}
            onDragStart={() => setDragId(item.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(item.id)}
          >
            <div className="relative h-full">
              {editMode && (
                <div className="absolute -top-2 -right-2 z-10 flex gap-1">
                  {selectMode ? (
                    <div className="rounded-full bg-background p-1 shadow">
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="rounded-full bg-background p-1 text-muted-foreground shadow hover:text-foreground"
                        onClick={() => cycleSize(item.id)}
                        title="Ridimensiona"
                      >
                        {item.size === "lg" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                        onClick={() => removeItem(item.id)}
                        title="Rimuovi"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {editMode && !selectMode && (
                <div className="absolute -top-2 -left-2 z-10 cursor-grab rounded-full bg-background p-1 text-muted-foreground shadow">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
              )}

              {item.kind === "folder" ? (
                <FolderCard folder={item} companyId={companyId} onOpen={() => !editMode && setOpenFolder(item)} editMode={editMode} />
              ) : (
                (() => {
                  const def = getWidgetDef(item.widgetKey);
                  if (!def) return null;
                  return <div className="h-full">{def.render(companyId)}</div>;
                })()
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={openFolder !== null} onOpenChange={(v) => !v && setOpenFolder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FolderIcon className="h-4 w-4" /> {openFolder?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {openFolder?.items.map((i) => {
              const def = getWidgetDef(i.widgetKey);
              if (!def) return null;
              return (
                <div key={i.widgetKey} className="relative">
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 z-10 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
                    onClick={() => removeFromFolder(openFolder.id, i.widgetKey)}
                    title="Togli dalla cartella"
                  >
                    <X className="h-3 w-3" />
                  </button>
                  {def.render(companyId)}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi widget</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {availableToAdd.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Hai già tutti i widget disponibili in dashboard.</p>
            ) : (
              availableToAdd.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left text-sm hover:bg-muted/50"
                  onClick={() => addWidget(w.key)}
                >
                  {w.title}
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderCard({
  folder, companyId, onOpen, editMode,
}: {
  folder: DashboardFolderItem;
  companyId: string;
  onOpen: () => void;
  editMode: boolean;
}) {
  return (
    <Card
      className={`h-full ${editMode ? "" : "cursor-pointer hover:border-primary/50"} transition-colors`}
      onClick={onOpen}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FolderIcon className="h-4 w-4 text-primary" /> {folder.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-1.5">
          {folder.items.slice(0, 4).map((i) => {
            const def = getWidgetDef(i.widgetKey);
            return (
              <div key={i.widgetKey} className="truncate rounded bg-muted/50 px-2 py-1.5 text-[10px] text-muted-foreground">
                {def?.title ?? i.widgetKey}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{folder.items.length} widget</p>
        <span className="hidden">{companyId}</span>
      </CardContent>
    </Card>
  );
}
