"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { NolanChat } from "@/components/nolan-chat";

/** Bottom-right floating Nolan, mounted once in the root layout. Sits at
 * z-40 like the header — every Base UI popup layer (dialogs, dropdowns,
 * selects) is z-50, so those still render above it, and Toaster is
 * top-right so there's no collision.
 *
 * Hidden on /nolan itself: that page is the full chat surface (history,
 * document upload), and a second floating chat stacked on top of it would
 * just be a duplicate of what the page already is. */
export function NolanWidget({ canPersist }: { canPersist: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/nolan")) return null;

  return (
    <>
      <Button
        type="button"
        size="icon-xl"
        className="fixed right-5 bottom-5 z-40 rounded-full shadow-[var(--shadow-lg)]"
        aria-label={open ? "Close Nolan" : "Ask Nolan"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X className="size-5" /> : <Bot className="size-5" />}
      </Button>

      {/* Kept mounted (not conditionally rendered) so the ephemeral
          conversation survives closing and reopening the widget within the
          same page — only `hidden` toggles, matching the app's other
          visibility-vs-unmount choices. */}
      <div
        hidden={!open}
        className="fixed right-5 bottom-[5.25rem] z-40 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-(--radius-2xl) border border-border bg-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-1.5 font-semibold">
            <Bot className="size-4 text-primary" /> Nolan
          </div>
          <LinkButton href="/nolan" variant="ghost" size="xs">
            Full view
          </LinkButton>
        </div>
        <div className="min-h-0 flex-1">
          <NolanChat
            threadId={null}
            initialMessages={[]}
            canPersist={canPersist}
            showUploadHint={false}
          />
        </div>
      </div>
    </>
  );
}
