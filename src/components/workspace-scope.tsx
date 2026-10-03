import { type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkspace } from './providers/workspace-provider';
import { supportsPersonalFinance } from '@/lib/workspace-scope';
import { FinancePage } from './layout/finance-page';
export function WorkspaceScope({ children, personalOnly = false, write = false }: PropsWithChildren<{ personalOnly?: boolean; write?: boolean }>) {
  const { workspaces, selectedId } = useWorkspace();
  const workspace = workspaces.find(item => item.id === selectedId);
  const router = useRouter();
  const personal = supportsPersonalFinance(workspace);
  if (!workspace || (personalOnly && !personal) || (write && workspace.role === 'viewer'))
    return <FinancePage title={workspace?.name ?? 'Choose workspace'} subtitle="Workspace access">
      <Text style={{ color: '#a1afc3', lineHeight: 24 }}>{!workspace ? 'Select a workspace to continue.' : personalOnly && !personal ? 'This feature is available in personal PHP workspaces. Select your personal workspace to use it.' : 'You have read-only access to this workspace.'}</Text>
      <Pressable style={{ padding: 16 }} onPress={() => router.push('/workspaces')}><Text style={{ color: '#75b6ff' }}>Choose workspace</Text></Pressable>
    </FinancePage>;
  return <View key={workspace.id} style={{ flex: 1 }}>{children}</View>;
}
