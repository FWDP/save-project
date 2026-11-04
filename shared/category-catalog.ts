export const CATEGORY_GROUPS = [
  { name: 'Income', type: 'income', children: ['Salary/Wages', 'Business Income', 'Freelance Income', 'Other Income'] },
  { name: 'Housing & Home', type: 'expense', children: ['Rent', 'Home Improvement', 'Appliances/Furniture Depreciation', 'Labor Cost', 'HOA Association Dues', 'HOA Stickers'] },
  { name: 'Utilities & Connectivity', type: 'expense', children: ['Electricity', 'Water - House', 'Water - Drinking', 'LPG', 'Cable & Internet', 'Mobile Data'] },
  { name: 'Food & Dining', type: 'expense', children: ['Groceries', 'Dine Out'] },
  { name: 'Transportation & Vehicle', type: 'expense', children: ['Transportation', 'Fuel', 'Parking', 'Toll', 'Vehicle Registration', 'Vehicles & Accessories'] },
  { name: 'Insurance & Loans', type: 'expense', children: ['Personal Insurance', 'Vehicle Insurance', 'Personal Loans', 'Vehicle Loans'] },
  { name: 'Education & School', type: 'expense', children: ['Tuition Fees', 'School Books', 'School Supplies', 'School Uniforms', 'School Service', 'School Parties/Events', 'Miscellaneous School Fees'] },
  { name: 'Health & Wellness', type: 'expense', children: ['Medicines', 'Vitamins & Supplements', 'Eyeglasses'] },
  { name: 'Personal Care & Clothing', type: 'expense', children: ['Clothes', 'Shoes', 'Haircuts & Grooming', 'Detergent & Bleach'] },
  { name: 'Sports & Recreation', type: 'expense', children: ['Golf', 'Golf Equipment', 'Bowling', 'Bowling Equipment', 'Ultimate Frisbee', 'Ultimate Frisbee Equipment', 'Other Sports', 'Playgrounds/Parks'] },
  { name: 'Entertainment & Leisure', type: 'expense', children: ['Movies & Cinema', 'Arcade Games', 'Web & Gaming'] },
  { name: 'Office & Work', type: 'expense', children: ['Office Supplies'] },
  { name: 'Lifestyle & Miscellaneous', type: 'expense', children: ['Gifts'] },
  { name: 'Tobacco & Vape', type: 'expense', children: ['Cigarettes', 'Vape'] },
] as const;

export const BUILTIN_CATEGORIES = CATEGORY_GROUPS.flatMap((group) =>
  [undefined, ...group.children].map((subcategory) => {
    const name = subcategory ? `${group.name} / ${subcategory}` : group.name;
    return {
      id: `builtin:${name}`,
      name,
      type: group.type,
      color: group.type === 'income' ? '#19c983' : '#6366F1',
      parentCategory: subcategory ? group.name : undefined,
      subcategory,
      builtIn: true,
    };
  }),
);
