import { requireSession } from '@/lib/supabase';
export default async function AccountSettings() {
  const { user } = await requireSession();
  return <><div className="page-heading"><div><h1>Your account</h1><p>Your financial records sync across SAVE Web and Mobile.</p></div></div>
    <section className="panel settings-panel"><dl className="report-stats">
      <div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Currency</dt><dd>PHP</dd></div><div><dt>Timezone</dt><dd>Asia/Manila</dd></div>
    </dl></section></>;
}
