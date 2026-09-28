export type Workspace = {
  id: string;
  name: string;
  kind: "personal" | "business";
  currency: string;
  timezone: string;
  role: "owner" | "admin" | "finance" | "member" | "viewer";
  memberCount: number;
};
export type Transaction = {
  id: string;
  workspaceId: string;
  createdBy: string;
  clientMutationId: string;
  type: "income" | "expense";
  amountMinor: number;
  description: string;
  category: string;
  merchant: string;
  date: string;
  revision: number;
};
export type TransactionPage = {
  items: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  summary: { incomeMinor: number; expenseMinor: number; balanceMinor: number };
  categories: { name: string; amountMinor: number; count: number }[];
};
export type ActionState = { error?: string; message?: string };
export type ConvertedReport = {
  quote: {
    base: string;
    target: string;
    rate: number;
    provider: string;
    asOf: string;
    expiresAt: string;
  };
  total: number;
  summary: TransactionPage["summary"];
  categories: TransactionPage["categories"];
};

export type CategoryOption = {
  name: string;
  type: "income" | "expense";
  parentCategory?: string;
  subcategory?: string;
};

export type ApiCategory = CategoryOption & {
  id: string;
  color: string;
  builtIn?: boolean;
};

export type ApiBudget = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  period: "monthly" | "weekly";
};

export type ApiSavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status:
    | "draft"
    | "pending"
    | "active"
    | "completed"
    | "withdrawn"
    | "cancelled";
  network?: string;
  ownerAddress?: string;
  contractId?: string;
  vaultGoalId?: string;
  transactionHash?: string;
};

export type PersonalTransaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
};
