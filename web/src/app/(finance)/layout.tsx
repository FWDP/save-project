import Link from "next/link";
import { requireSession } from "@/lib/supabase";
import { Brand } from "@/components/icon";
import { Navigation } from "@/components/navigation";
import { signOut } from "@/app/auth/actions";
export default async function FinanceLayout({children}: {children: React.ReactNode}) {
  const session = await requireSession();
  const name = String(session.user.user_metadata?.name || session.user.email || 'Your account');
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><Link href="/overview" aria-label="SAVE overview"><Brand /></Link>
      <Navigation />
      <div className="account"><span className="avatar">{name.slice(0,2).toUpperCase()}</span>
        <div><strong>{name}</strong><span>My finances</span></div>
        <form action={signOut}><button className="signout" aria-label="Sign out">↪</button></form>
      </div>
    </aside>
    <div className="workspace-main"><header className="topbar"><strong>My finances</strong><span className="currency-tag">PHP</span></header>
      <main id="main-content" className="content">{children}</main>
      <footer className="app-footer"><span>SAVE · Make room for what matters.</span><span>Asia/Manila</span></footer>
    </div>
  </div>;
}
