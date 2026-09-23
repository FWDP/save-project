import Link from "next/link";
import { api } from "@/lib/api";
import { requireSession } from "@/lib/supabase";
import { Brand, Icon } from "@/components/icon";
import { Navigation } from "@/components/navigation";
import { signOut } from "@/app/auth/actions";
import type { Workspace } from "@/lib/types";
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [workspace, workspaces, session] = await Promise.all([
    api<Workspace>(`/workspaces/${encodeURIComponent(id)}`),
    api<Workspace[]>("/workspaces"),
    requireSession(),
  ]);
  const name = String(
    session.user.user_metadata?.name ||
      session.user.email?.split("@")[0] ||
      "Your account",
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href={`/w/${workspace.id}/overview`} aria-label="SAVE overview">
          <Brand />
        </Link>
        <Navigation workspace={workspace} workspaces={workspaces} />
        <div className="sidebar-note">
          <span className="note-icon">
            <Icon name="wallet" />
          </span>
          <strong>A clearer financial picture.</strong>
          <p>
            Small steps today.
            <br />
            More possibilities tomorrow.
          </p>
        </div>
        <div className="account">
          <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <span>
              {workspace.role === "finance"
                ? "Finance manager"
                : workspace.role}
            </span>
          </div>
          <form action={signOut}>
            <button title="Sign out" className="signout" aria-label="Sign out">
              ↪
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <span className="breadcrumb">
            Your workspace <span>/</span> <strong>{workspace.name}</strong>
          </span>
          <div className="topbar-right">
            <span className={`kind-badge ${workspace.kind}`}>
              {workspace.kind === "business" ? "Business" : "Personal"}
            </span>
            <span className="currency-tag">PHP</span>
          </div>
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
        <footer className="app-footer">
          <span>SAVE · Make room for what matters.</span>
          <span>{workspace.timezone}</span>
        </footer>
      </div>
    </div>
  );
}
