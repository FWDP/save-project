import { Redirect } from 'expo-router';
// Keep old app links usable after workspace retirement.
export default function LegacyWorkspaces() { return <Redirect href="/" />; }
