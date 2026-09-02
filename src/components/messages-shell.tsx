"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Two-pane inbox layout. On mobile, shows only the sidebar at `basePath`
 * and only the thread once one is selected (`<basePath>/[id]`) — a server
 * layout can't branch on the active route, so this thin client wrapper
 * handles the responsive show/hide. Shared by /messages and /nolan. */
export function MessagesShell({
  sidebar,
  children,
  basePath = "/messages",
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  basePath?: string;
}) {
  const pathname = usePathname();
  const isThreadOpen = pathname !== basePath;

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
