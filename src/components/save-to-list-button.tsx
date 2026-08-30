"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { addCreatorToList, createTalentList } from "@/lib/actions/lists";
import { Bookmark, Plus } from "lucide-react";
import type { TalentList } from "@/lib/types";

export function SaveToListButton({ creatorId }: { creatorId: string }) {
  const [lists, setLists] = useState<TalentList[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isPending, startTransition] = useTransition();

  async function loadLists() {
    if (lists !== null) return;
    setLoading(true);
    try {
      const res = await fetch("/api/lists");
      const data = await res.json();
      setLists(data.lists ?? []);
    } finally {
      setLoading(false);
    }
  }

  function saveTo(listId: string) {
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("list_id", listId);
        fd.set("creator_id", creatorId);
        await addCreatorToList(fd);
        toast.success("Saved to list.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function createAndSave() {
    const name = newListName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const listFd = new FormData();
        listFd.set("name", name);
        const created = await createTalentList(listFd);
        if (!created) throw new Error("Failed to create list.");
        const itemFd = new FormData();
        itemFd.set("list_id", created.id);
        itemFd.set("creator_id", creatorId);
        await addCreatorToList(itemFd);
        setLists((prev) => [{ id: created.id, name, org_id: "", created_by: null, created_at: new Date().toISOString() }, ...(prev ?? [])]);
        setNewListName("");
        toast.success(`Saved to new list "${name}".`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && loadLists()}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Save to list"
            onClick={(e) => e.stopPropagation()}
          >
            <Bookmark className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading lists...</div>
        ) : lists && lists.length > 0 ? (
          lists.map((l) => (
            <DropdownMenuItem key={l.id} disabled={isPending} onClick={() => saveTo(l.id)}>
              {l.name}
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">No lists yet.</div>
        )}
        <DropdownMenuSeparator />
        <div className="flex items-center gap-1 p-1">
          <Input
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="New list name"
            className="h-7 text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndSave();
              }
            }}
          />
          <Button size="icon-sm" variant="ghost" disabled={isPending || !newListName.trim()} onClick={createAndSave}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
