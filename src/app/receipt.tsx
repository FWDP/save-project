import { Redirect } from 'expo-router';

// Keep old receipt links on the same reactive draft and complete transaction form.
export default function ReceiptScreen() {
  return <Redirect href="/expense-add" />;
}
