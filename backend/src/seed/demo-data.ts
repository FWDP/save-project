export type Category = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
};

export type Transaction = {
  id: string;
  userId: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  merchant?: string;
  tags?: string[];
  recurring?: boolean;
  receiptUri?: string;
  customFields?: Record<string, string>;
};

export type Budget = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  period: 'monthly' | 'weekly';
};

export type SavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status: 'draft';
  transactionHash?: string;
  contractId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const demoDate = (monthOffset: number, day: number) => {
  const now = new Date();
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset + 1, 0),
  ).getUTCDate();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + monthOffset,
      Math.min(day, lastDay),
    ),
  )
    .toISOString()
    .slice(0, 10);
};

// ---------------------------------------------------------------------------
// Categories  (26 expense + 6 income = 32 total)
// ---------------------------------------------------------------------------

export const DEMO_CATEGORIES: Category[] = (
  [
    // — Expense —
    ['Groceries', 'expense', '#f59e0b'],
    ['Fuel', 'expense', '#06b6d4'],
    ['Dine Out', 'expense', '#f97316'],
    ['Rent', 'expense', '#84cc16'],
    ['Electricity', 'expense', '#eab308'],
    ['Water - House', 'expense', '#0ea5e9'],
    ['Mobile Data', 'expense', '#8b5cf6'],
    ['Cable & Internet', 'expense', '#6366f1'],
    ['Transportation', 'expense', '#3b82f6'],
    ['Healthcare', 'expense', '#10b981'],
    ['Haircuts & Grooming', 'expense', '#64748b'],
    ['School Fees', 'expense', '#ef4444'],
    ['Entertainment', 'expense', '#ec4899'],
    ['Shopping', 'expense', '#a855f7'],
    ['Subscriptions', 'expense', '#14b8a6'],
    ['Home Improvement', 'expense', '#f97316'],
    ['Vehicle Loans', 'expense', '#db2777'],
    ['Parking', 'expense', '#ef4444'],
    ['Toll', 'expense', '#eab308'],
    ['Gifts', 'expense', '#f43f5e'],
    ['Pets', 'expense', '#22c55e'],
    ['Insurance', 'expense', '#0284c7'],
    ['Clothing', 'expense', '#c026d3'],
    ['Books & Education', 'expense', '#0891b2'],
    ['Sports & Fitness', 'expense', '#16a34a'],
    ['Travel', 'expense', '#dc2626'],
    // — Income —
    ['Salary', 'income', '#22c55e'],
    ['Freelance Income', 'income', '#06b6d4'],
    ['Business Income', 'income', '#8b5cf6'],
    ['Investment Income', 'income', '#3b82f6'],
    ['Bonus', 'income', '#f59e0b'],
    ['Other Income', 'income', '#64748b'],
  ] as [string, Category['type'], string][]
).map(([name, type, color], index) => ({
  id: `demo_cat_${index + 1}`,
  name,
  type,
  color,
}));

// ---------------------------------------------------------------------------
// Transactions  (6 months of data)
// ---------------------------------------------------------------------------

type DemoTransactionInput = Omit<Transaction, 'id' | 'userId' | 'status' | 'date'> & {
  userId?: string;
  month: number;
  day: number;
};

const raw: DemoTransactionInput[] = [
  // ─── Month 0 (current month) ───────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       tags: ['income', 'salary'], recurring: true, month: 0, day: 1  },
  { type: 'income',  amount: 12000,   category: 'Freelance Income',    description: 'Mobile design project',         merchant: 'Northstar Studio',          tags: ['client', 'freelance'],          month: 0, day: 15 },
  { type: 'expense', amount: 1500,    category: 'Fuel',                description: 'Full tank gasoline',            merchant: 'Petron AAHA Ventures OPC', tags: ['car'],                           month: 0, day: 3  },
  { type: 'expense', amount: 555,     category: 'Dine Out',            description: 'Coffee and lunch',              merchant: 'Starbucks Coffee',          tags: ['food'],                          month: 0, day: 5  },
  { type: 'expense', amount: 285,     category: 'Groceries',           description: 'Household groceries',           merchant: 'Marilyn Store',                                                       month: 0, day: 6  },
  { type: 'expense', amount: 181,     category: 'Groceries',           description: 'Convenience store purchase',    merchant: '7-Eleven',                                                            month: 0, day: 7  },
  { type: 'expense', amount: 118,     category: 'Groceries',           description: 'Fresh produce',                 merchant: 'Dali Everyday Grocery',                                               month: 0, day: 8  },
  { type: 'expense', amount: 2200,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                  tags: ['utilities'], recurring: true,   month: 0, day: 9  },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',         tags: ['housing'],   recurring: true,   month: 0, day: 10 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: 0, day: 11 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: 0, day: 12 },
  { type: 'expense', amount: 850,     category: 'Dine Out',            description: 'Family dinner',                 merchant: 'Jollibee',                  tags: ['family'],                        month: 0, day: 14 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: 0, day: 16 },
  { type: 'expense', amount: 640,     category: 'Healthcare',          description: 'Vitamins and medicine',         merchant: 'Mercury Drug',                                                        month: 0, day: 18 },
  { type: 'expense', amount: 320,     category: 'Transportation',      description: 'Ride-hailing trips',            merchant: 'Grab',                                                                month: 0, day: 20 },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: 0, day: 21 },
  { type: 'expense', amount: 1100,    category: 'Shopping',            description: 'New work shirt',                merchant: 'Uniqlo',                                                              month: 0, day: 23 },
  { type: 'expense', amount: 300,     category: 'Haircuts & Grooming', description: 'Monthly haircut',               merchant: "Bruno's Barbers",                                                     month: 0, day: 25 },
  { type: 'expense', amount: 160,     category: 'Parking',             description: 'Office parking',                merchant: 'Ayala Parking',                                                       month: 0, day: 27 },
  { type: 'expense', amount: 95,      category: 'Toll',                description: 'Expressway toll',               merchant: 'Autosweep',                                                           month: 0, day: 28 },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: 0, day: 5  },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: 0, day: 1  },
  { type: 'expense', amount: 780,     category: 'Healthcare',          description: 'Check-up and labs',             merchant: 'MedExpress Clinic',                                                   month: 0, day: 22 },

  // ─── Month -1 ─────────────────────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       recurring: true,                         month: -1, day: 1  },
  { type: 'income',  amount: 8000,    category: 'Freelance Income',    description: 'Website consultation',          merchant: 'Acme Labs',                                                           month: -1, day: 18 },
  { type: 'expense', amount: 2525.05, category: 'Fuel',                description: 'Fuel and engine oil',           merchant: 'Shell',                                                               month: -1, day: 2  },
  { type: 'expense', amount: 4250,    category: 'Groceries',           description: 'Monthly grocery run',           merchant: 'SM Supermarket',                                                      month: -1, day: 4  },
  { type: 'expense', amount: 1800,    category: 'Dine Out',            description: 'Birthday dinner',               merchant: 'Mesa Filipino Moderne',                                               month: -1, day: 6  },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',          recurring: true,                         month: -1, day: 10 },
  { type: 'expense', amount: 2100,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                   recurring: true,                         month: -1, day: 11 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: -1, day: 12 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: -1, day: 13 },
  { type: 'expense', amount: 1300,    category: 'Healthcare',          description: 'Dental consultation',           merchant: 'Smile Dental Clinic',                                                 month: -1, day: 15 },
  { type: 'expense', amount: 980,     category: 'Shopping',            description: 'Household supplies',            merchant: 'Ace Hardware',                                                        month: -1, day: 17 },
  { type: 'expense', amount: 650,     category: 'Entertainment',       description: 'Cinema tickets',                merchant: 'SM Cinema',                                                           month: -1, day: 20 },
  { type: 'expense', amount: 550,     category: 'Transportation',      description: 'Bus and train fares',           merchant: 'Beep',                                                                month: -1, day: 22 },
  { type: 'expense', amount: 1200,    category: 'Gifts',               description: 'Anniversary gift',              merchant: 'National Book Store',                                                 month: -1, day: 24 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: -1, day: 26 },
  { type: 'expense', amount: 900,     category: 'Pets',                description: 'Pet food and supplies',         merchant: 'Pet Express',                                                         month: -1, day: 28 },
  { type: 'expense', amount: 2800,    category: 'School Fees',         description: 'Tuition installment',           merchant: 'University Cashier',                                                  month: -1, day: 5  },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: -1, day: 5  },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: -1, day: 21 },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: -1, day: 1  },
  { type: 'expense', amount: 3200,    category: 'Travel',              description: 'Weekend trip expenses',         merchant: 'Airbnb',                    tags: ['leisure'],                       month: -1, day: 8  },

  // ─── Month -2 ─────────────────────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       recurring: true,                         month: -2, day: 1  },
  { type: 'income',  amount: 15000,   category: 'Freelance Income',    description: 'App UI project',                merchant: 'Pixel Studio PH',                                                     month: -2, day: 12 },
  { type: 'income',  amount: 3500,    category: 'Investment Income',   description: 'Dividend payout',               merchant: 'COL Financial',                                                       month: -2, day: 20 },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',          recurring: true,                         month: -2, day: 10 },
  { type: 'expense', amount: 3850,    category: 'Groceries',           description: 'Grocery shopping',              merchant: 'Robinsons Supermarket',                                               month: -2, day: 4  },
  { type: 'expense', amount: 2350,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                   recurring: true,                         month: -2, day: 11 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: -2, day: 16 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: -2, day: 12 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: -2, day: 13 },
  { type: 'expense', amount: 1800,    category: 'Fuel',                description: 'Full tank gasoline',            merchant: 'Petron',                    tags: ['car'],                           month: -2, day: 3  },
  { type: 'expense', amount: 4500,    category: 'Home Improvement',    description: 'Bathroom fixtures',             merchant: 'AllHome',                                                             month: -2, day: 15 },
  { type: 'expense', amount: 2100,    category: 'Clothing',            description: 'Work clothes',                  merchant: 'H&M',                       tags: ['clothes'],                       month: -2, day: 18 },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: -2, day: 5  },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: -2, day: 21 },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: -2, day: 1  },
  { type: 'expense', amount: 680,     category: 'Entertainment',       description: 'Concert tickets',               merchant: 'TicketNet',                                                           month: -2, day: 22 },
  { type: 'expense', amount: 320,     category: 'Transportation',      description: 'Grab rides',                    merchant: 'Grab',                                                                month: -2, day: 24 },
  { type: 'expense', amount: 750,     category: 'Books & Education',   description: 'Online course',                 merchant: 'Udemy',                                                               month: -2, day: 8  },

  // ─── Month -3 ─────────────────────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       recurring: true,                         month: -3, day: 1  },
  { type: 'income',  amount: 5000,    category: 'Other Income',        description: 'Referral bonus',                merchant: 'GCash',                                                               month: -3, day: 10 },
  { type: 'income',  amount: 20000,   category: 'Bonus',               description: 'Quarterly performance bonus',   merchant: 'SAVE Demo Employer',                                                  month: -3, day: 15 },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',          recurring: true,                         month: -3, day: 10 },
  { type: 'expense', amount: 5200,    category: 'Groceries',           description: 'Monthly grocery run',           merchant: 'S&R Membership Shopping',                                             month: -3, day: 4  },
  { type: 'expense', amount: 2400,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                   recurring: true,                         month: -3, day: 11 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: -3, day: 16 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: -3, day: 12 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: -3, day: 13 },
  { type: 'expense', amount: 2000,    category: 'Fuel',                description: 'Gasoline and car wash',         merchant: 'Shell',                     tags: ['car'],                           month: -3, day: 6  },
  { type: 'expense', amount: 8000,    category: 'Travel',              description: 'Cebu weekend getaway',          merchant: 'Cebu Pacific',              tags: ['leisure', 'travel'],             month: -3, day: 20 },
  { type: 'expense', amount: 3500,    category: 'Shopping',            description: 'Birthday shopping spree',       merchant: 'SM Mall of Asia',                                                     month: -3, day: 21 },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: -3, day: 5  },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: -3, day: 21 },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: -3, day: 1  },
  { type: 'expense', amount: 2500,    category: 'Insurance',           description: 'Annual car insurance (quarter)',merchant: 'Malayan Insurance',                                                    month: -3, day: 14 },
  { type: 'expense', amount: 1800,    category: 'Healthcare',          description: 'Annual physical exam',          merchant: "St. Luke's Medical",                                                  month: -3, day: 17 },

  // ─── Month -4 ─────────────────────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       recurring: true,                         month: -4, day: 1  },
  { type: 'income',  amount: 6500,    category: 'Business Income',     description: 'Side hustle proceeds',          merchant: 'Personal',                                                            month: -4, day: 25 },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',          recurring: true,                         month: -4, day: 10 },
  { type: 'expense', amount: 4100,    category: 'Groceries',           description: 'Grocery shopping',              merchant: 'Puregold',                                                            month: -4, day: 3  },
  { type: 'expense', amount: 2250,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                   recurring: true,                         month: -4, day: 11 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: -4, day: 16 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: -4, day: 12 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: -4, day: 13 },
  { type: 'expense', amount: 1650,    category: 'Fuel',                description: 'Gasoline',                      merchant: 'Petron',                    tags: ['car'],                           month: -4, day: 5  },
  { type: 'expense', amount: 6000,    category: 'Vehicle Loans',       description: 'Car amortization',              merchant: 'BPI Family Bank',           recurring: true,                         month: -4, day: 10 },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: -4, day: 5  },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: -4, day: 21 },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: -4, day: 1  },
  { type: 'expense', amount: 1250,    category: 'Dine Out',            description: 'Team lunch out',                merchant: 'Yabu',                      tags: ['work'],                          month: -4, day: 19 },
  { type: 'expense', amount: 850,     category: 'Entertainment',       description: 'Board game night',              merchant: 'The Loft BGC',                                                        month: -4, day: 26 },

  // ─── Month -5 ─────────────────────────────────────────────────────────
  { type: 'income',  amount: 45000,   category: 'Salary',              description: 'Monthly salary',                merchant: 'SAVE Demo Employer',       recurring: true,                         month: -5, day: 1  },
  { type: 'income',  amount: 10000,   category: 'Freelance Income',    description: 'Logo & branding project',       merchant: 'Brand House',                                                         month: -5, day: 20 },
  { type: 'expense', amount: 12000,   category: 'Rent',                description: 'Apartment rent',                merchant: 'Property Manager',          recurring: true,                         month: -5, day: 10 },
  { type: 'expense', amount: 3700,    category: 'Groceries',           description: 'Grocery shopping',              merchant: 'Walter Mart',                                                         month: -5, day: 4  },
  { type: 'expense', amount: 2050,    category: 'Electricity',         description: 'Monthly electric bill',         merchant: 'Meralco',                   recurring: true,                         month: -5, day: 11 },
  { type: 'expense', amount: 450,     category: 'Water - House',       description: 'Water utility bill',            merchant: 'Manila Water',              recurring: true,                         month: -5, day: 16 },
  { type: 'expense', amount: 1699,    category: 'Cable & Internet',    description: 'Home fiber internet',           merchant: 'PLDT',                      recurring: true,                         month: -5, day: 12 },
  { type: 'expense', amount: 799,     category: 'Mobile Data',         description: 'Mobile postpaid plan',          merchant: 'Globe Telecom',             recurring: true,                         month: -5, day: 13 },
  { type: 'expense', amount: 1700,    category: 'Fuel',                description: 'Full tank',                     merchant: 'Shell',                     tags: ['car'],                           month: -5, day: 2  },
  { type: 'expense', amount: 6000,    category: 'Vehicle Loans',       description: 'Car amortization',              merchant: 'BPI Family Bank',           recurring: true,                         month: -5, day: 10 },
  { type: 'expense', amount: 499,     category: 'Subscriptions',       description: 'Video streaming',               merchant: 'Netflix',                   recurring: true,                         month: -5, day: 5  },
  { type: 'expense', amount: 249,     category: 'Subscriptions',       description: 'Music subscription',            merchant: 'Spotify',                   recurring: true,                         month: -5, day: 21 },
  { type: 'expense', amount: 1450,    category: 'Sports & Fitness',    description: 'Gym monthly fee',               merchant: 'Anytime Fitness',           recurring: true,                         month: -5, day: 1  },
  { type: 'expense', amount: 4800,    category: 'School Fees',         description: 'Enrollment fee',                merchant: 'University Cashier',                                                  month: -5, day: 7  },
  { type: 'expense', amount: 2200,    category: 'Books & Education',   description: 'Textbooks and review materials',merchant: 'National Book Store',                                                 month: -5, day: 9  },
  { type: 'expense', amount: 1200,    category: 'Shopping',            description: 'Back-to-school supplies',       merchant: 'Landmark',                                                            month: -5, day: 10 },
  { type: 'expense', amount: 600,     category: 'Healthcare',          description: 'Eye check-up and lenses',       merchant: '20/20 Optical',                                                       month: -5, day: 23 },
];

export const DEMO_TRANSACTIONS: Transaction[] = raw.map(
  ({ month, day, userId = 'usr_2', ...transaction }, index) => ({
    id: `demo_txn_${index + 1}`,
    userId,
    status: 'approved' as const,
    date: demoDate(month, day),
    ...transaction,
  }),
);

// ---------------------------------------------------------------------------
// Budgets  (monthly limits with realistic spend progress)
// ---------------------------------------------------------------------------

export const DEMO_BUDGETS: Budget[] = (
  [
    ['Groceries',          12000,  4834],
    ['Fuel',               10000,  4025.05],
    ['Dine Out',            7000,  3205],
    ['Rent',               26000, 24000],
    ['Electricity',         7000,  4300],
    ['Water - House',       2000,   900],
    ['Mobile Data',         1799,  1598],
    ['Cable & Internet',    3500,  3398],
    ['Transportation',      3000,   870],
    ['Healthcare',          5000,  1940],
    ['Shopping',            5000,  2080],
    ['Entertainment',       2500,   650],
    ['Subscriptions',       2500,  1247],
    ['Sports & Fitness',    2000,  1450],
    ['Vehicle Loans',       7000,  6000],
    ['School Fees',         5000,  2800],
    ['Travel',             15000,  3200],
    ['Insurance',           5000,  2500],
  ] as [string, number, number][]
).map(([category, limit, spent], index) => ({
  id: `demo_budget_${index + 1}`,
  userId: 'usr_2',
  category: String(category),
  limit: Number(limit),
  spent: Number(spent),
  period: 'monthly' as const,
}));

// ---------------------------------------------------------------------------
// Savings Goals
// ---------------------------------------------------------------------------

export const DEMO_SAVINGS_GOALS: SavingsGoal[] = [
  {
    id: 'demo_goal_1',
    name: 'Emergency Fund',
    targetAmount: 100000,
    fundedAmount: 38000,
    targetDate: demoDate(6, 28),
    asset: 'XLM',
    status: 'draft',
  },
  {
    id: 'demo_goal_2',
    name: 'New Laptop',
    targetAmount: 65000,
    fundedAmount: 22000,
    targetDate: demoDate(3, 15),
    asset: 'XLM',
    status: 'draft',
  },
  {
    id: 'demo_goal_3',
    name: 'Family Vacation',
    targetAmount: 80000,
    fundedAmount: 15000,
    targetDate: demoDate(9, 1),
    asset: 'XLM',
    status: 'draft',
  },
  {
    id: 'demo_goal_4',
    name: 'House Down Payment',
    targetAmount: 500000,
    fundedAmount: 85000,
    targetDate: demoDate(24, 1),
    asset: 'XLM',
    status: 'draft',
  },
  {
    id: 'demo_goal_5',
    name: 'Car Upgrade',
    targetAmount: 350000,
    fundedAmount: 60000,
    targetDate: demoDate(18, 15),
    asset: 'XLM',
    status: 'draft',
  },
  {
    id: 'demo_goal_6',
    name: 'Wedding Fund',
    targetAmount: 200000,
    fundedAmount: 42000,
    targetDate: demoDate(12, 1),
    asset: 'XLM',
    status: 'draft',
  },
];
