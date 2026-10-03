import { createWorkspace, fetchWorkspaces } from './api';

export async function loadAccountWorkspaces(userId: string) {
  const list = await fetchWorkspaces();
  if (list.length) return list;
  // The API enforces one personal workspace per authenticated owner.
  const personal = await createWorkspace({
    name: 'Personal', kind: 'personal', currency: 'PHP',
    clientMutationId: `mobile-personal-${userId}`,
  }, userId);
  return [personal];
}
