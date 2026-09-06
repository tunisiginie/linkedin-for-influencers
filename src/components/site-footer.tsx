import Link from "next/link";
import { Briefcase } from "lucide-react";

const LINK_GROUPS = [
  {
    title: "Discover",
    links: [
      { href: "/search", label: "Find creators" },
      { href: "/search?sort=roi", label: "Top JAE Scores" },
      { href: "/jae-score", label: "What's the JAE Score?" },
    ],
  },
  {
    title: "Creators",
    links: [
      { href: "/creator", label: "Creator home" },
      { href: "/claim", label: "Claim your profile" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Sign up" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Briefcase className="size-4.5" />
            </span>
            <span className="font-semibold">
              Creator<span className="text-primary">Network</span>
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            The professional network for content creators and the sponsors who work with them.
          </p>
        </div>
        {LINK_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CreatorNetwork. All rights reserved.
      </div>
    </footer>
  );
}
