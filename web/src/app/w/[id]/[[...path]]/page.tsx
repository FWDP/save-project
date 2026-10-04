import { redirect } from "next/navigation";
export default async function LegacyWorkspace({ params }: { params: Promise<{id: string; path?: string[]}> }) {
  const { path = [] } = await params;
  const allowed = new Set(['overview','transactions','budgets','categories','savings','reports','settings']);
  redirect(allowed.has(path[0]) ? '/' + path.map(encodeURIComponent).join('/') : '/overview');
}
