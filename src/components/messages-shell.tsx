"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Two-pane inbox layout. On mobile, shows only the sidebar at `/messages`
 * and only the thread once a conversation is selected (`/messages/[id]`) —
 * a server layout can't branch on the active route, so this thin client
 * wrapper handles the responsive show/hide. */
export function MessagesShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isThreadOpen = pathname !== "/messages";

  return (
    <div className="mx-auto grid h-[calc(100vh-3.5rem)] max-w-6xl grid-cols-1 md:grid-cols-[280px_1fr]">
      <aside
        className={cn(
          "flex-col border-r border-border",
          isThreadOpen ? "hidden md:flex" : "flex",
        )}
      >
        {sidebar}
      </aside>
      <main className={cn("flex-col", isThreadOpen ? "flex" : "hidden md:flex")}>
        {children}
      </main>
    </div>
  );
}
