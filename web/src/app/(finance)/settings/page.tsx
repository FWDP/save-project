import { DatabaseSyncSettings } from '@/components/local-finance';
import { requireSession } from '@/lib/supabase';
export default async function AccountSettings() {
  const { user } = await requireSession();
  return <><div className="page-heading"><div><h1>Your account</h1><p>Financial records are local by default. You can opt into database sync below; receipt photos stay on this device.</p></div></div>
    <section className="panel settings-panel"><dl className="report-stats">
      <div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Currency</dt><dd>PHP</dd></div><div><dt>Timezone</dt><dd>Asia/Manila</dd></div>
    </dl></section><DatabaseSyncSettings /></>;
}
