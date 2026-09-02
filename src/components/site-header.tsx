"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  Home,
  LogOut,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { roleHome } from "@/lib/role";
import type { Profile } from "@/lib/types";

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "text-primary")} strokeWidth={active ? 2.4 : 2} />
      <span className="hidden sm:block">{label}</span>
    </Link>
  );
}

export function SiteHeader({
  profile,
  claimedCreatorSlug,
}: {
  profile: Profile | null;
  claimedCreatorSlug: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [q, setQ] = useState("");

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
  }

  // Signed-in users get their role's own home surface; signed-out visitors
  // get the public landing page.
  const homeHref = profile ? roleHome(profile.account_type) : "/";
  const homeActive = pathname === "/" || pathname === homeHref;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="size-4.5" />
          </span>
          <span className="hidden text-base leading-none md:block">
            Creator<span className="text-primary">Network</span>
          </span>
        </Link>

        <form onSubmit={onSearchSubmit} className="ml-1 hidden max-w-xs flex-1 md:block">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search creators"
              className="h-9 rounded-md bg-secondary pl-8"
            />
          </div>
        </form>

        <nav className="ml-auto flex items-center">
          <NavLink href={homeHref} icon={Home} label="Home" active={homeActive} />
          <NavLink
            href="/search"
            icon={Users}
            label="Talent"
            active={pathname.startsWith("/search")}
          />
          {profile ? (
            <NavLink
              href="/messages"
              icon={MessageSquare}
              label="Messages"
              active={pathname.startsWith("/messages")}
            />
          ) : null}

          <Button
            variant="ghost"
            size="icon"
            className="ml-1"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-4.5 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute size-4.5 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          </Button>

          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="ml-1 h-9 gap-1.5 px-1.5">
                    <Avatar className="size-7">
                      <AvatarImage
                        src={profile.photo_url ?? undefined}
                        alt={profile.full_name ?? ""}
                      />
                      <AvatarFallback className="text-xs">
                        {initials(profile.full_name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {profile.full_name ?? profile.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={
                    <Link href="/dashboard">
                      <Home className="size-4" /> Dashboard
                    </Link>
                  }
                />
                {claimedCreatorSlug ? (
                  <DropdownMenuItem
                    render={
                      <Link href={`/creators/${claimedCreatorSlug}`}>
                        <Users className="size-4" /> My profile
                      </Link>
                    }
                  />
                ) : null}
                <DropdownMenuItem
                  render={
                    <Link href="/settings">
                      <Settings className="size-4" /> Settings
                    </Link>
                  }
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  render={
                    <a href="/auth/signout">
                      <LogOut className="size-4" /> Sign out
                    </a>
                  }
                />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <LinkButton href="/login" variant="ghost" size="sm">
                Log in
              </LinkButton>
              <LinkButton href="/signup" size="sm">
                Sign up
              </LinkButton>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
