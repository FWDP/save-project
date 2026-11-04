import { LocalFinance } from '@/components/local-finance';
export default async function Page({ params }: { params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  return <LocalFinance view="transaction" id={transactionId} />;
}
