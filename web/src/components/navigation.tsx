"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Workspace } from "@/lib/types";
import { Icon } from "./icon";
type NavigationLink = {
  path: string;
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
};
export function Navigation({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links: NavigationLink[] = [
    { path: "overview", label: "Overview", icon: "overview" },
    { path: "transactions", label: "Transactions", icon: "transactions" },
    ...(workspace.kind === "personal" && workspace.currency === "PHP"
      ? [
          { path: "budgets", label: "Budgets", icon: "reports" },
          { path: "categories", label: "Categories", icon: "transactions" },
          { path: "savings", label: "Savings goals", icon: "wallet" },
        ]
      : []),
    { path: "reports", label: "Reports", icon: "reports" },
    { path: "settings", label: "Workspace", icon: "workspace" },
  ];
  return (
    <>
      <label className="workspace-switch">
        YOUR WORKSPACE
        <select
          aria-label="Switch workspace"
          value={workspace.id}
          onChange={(event) => router.push(`/w/${event.target.value}/overview`)}
        >
          {workspaces.map((item) => (
            <option value={item.id} key={item.id}>
              {item.name} · {item.kind}
            </option>
          ))}
        </select>
      </label>
      <nav aria-label="Main navigation" className="main-nav">
        {links.map((link) => {
          const href = `/w/${workspace.id}/${link.path}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={link.icon} />
              {link.label}
              {active && <span className="nav-dot" />}
            </Link>
          );
        })}
      </nav>
      <Link className="new-workspace-link" href="/workspaces/new">
        <Icon name="plus" size={16} /> New workspace
      </Link>
    </>
  );
}
