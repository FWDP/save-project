import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { Budget, BudgetDocument } from '../budgets/budget.schema';
import { Category, CategoryDocument } from '../categories/category.schema';
import { SavingsGoal, SavingsGoalDocument } from '../savings/savings-goal.schema';
import { Transaction, TransactionDocument } from '../transactions/transaction.schema';
import { User, UserDocument } from '../users/user.schema';
import {
    DEMO_BUDGETS,
    DEMO_CATEGORIES,
    DEMO_SAVINGS_GOALS,
    DEMO_TRANSACTIONS,
} from './demo-data';

async function seed() {
  console.log('Bootstrapping SAVE NestJS Application Context for seeding...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const resetExistingData = process.argv.includes('--reset');

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
  const transactionModel = app.get<Model<TransactionDocument>>(getModelToken(Transaction.name));
  const budgetModel = app.get<Model<BudgetDocument>>(getModelToken(Budget.name));
  const savingsGoalModel = app.get<Model<SavingsGoalDocument>>(getModelToken(SavingsGoal.name));

  const collectionCounts = await Promise.all([
    userModel.countDocuments({}),
    categoryModel.countDocuments({}),
    transactionModel.countDocuments({}),
    budgetModel.countDocuments({}),
    savingsGoalModel.countDocuments({}),
  ]);
  if (collectionCounts.some((count) => count > 0) && !resetExistingData) {
    console.error(
      'Seed refused: finance data already exists. Pass --reset only to intentionally clear seeded collections.',
    );
    await app.close();
    process.exitCode = 1;
    return;
  }

  if (resetExistingData) {
    console.warn(
      'Explicit --reset requested; deleting every document in users, categories, transactions, budgets, and savings goals.',
    );
    await Promise.all([
      userModel.deleteMany({}),
      categoryModel.deleteMany({}),
      transactionModel.deleteMany({}),
      budgetModel.deleteMany({}),
      savingsGoalModel.deleteMany({}),
    ]);
    console.log('Seeded collections cleared.');
  }

  // Seed Users
  const users = await userModel.insertMany([
    { name: 'Super Admin', email: 'admin@save.app', role: 'admin' },
    { name: 'Marcus Lee', email: 'marcus@save.app', role: 'user' },
  ]);
  console.log(`Seeded ${users.length} users.`);

  const demoUserId = users[1]._id.toString();

  // Seed Categories
  const categories = await categoryModel.insertMany(
    DEMO_CATEGORIES.map(({ name, type, color }) => ({ name, type, color })),
  );
  console.log(`Seeded ${categories.length} categories.`);

  // Seed Transactions
  const transactions = await transactionModel.insertMany(
    DEMO_TRANSACTIONS.map(
      ({ type, amount, category, description, date, status, merchant, tags, recurring, receiptUri, customFields }) => ({
        userId: demoUserId,
        type,
        amount,
        category,
        description,
        date,
        status,
        merchant,
        tags,
        recurring,
        receiptUri,
        customFields,
      }),
    ),
  );
  console.log(`Seeded ${transactions.length} transactions.`);

  // Seed Budgets
  const budgets = await budgetModel.insertMany(
    DEMO_BUDGETS.map(({ category, limit, spent, period }) => ({
      userId: demoUserId,
      category,
      limit,
      spent,
      period,
    })),
  );
  console.log(`Seeded ${budgets.length} budgets.`);

  // Seed Savings Goals
  const goals = await savingsGoalModel.insertMany(
    DEMO_SAVINGS_GOALS.map(({ name, targetAmount, fundedAmount, targetDate, asset, status }) => ({
      name,
      targetAmount,
      fundedAmount,
      targetDate,
      asset,
      status,
    })),
  );
  console.log(`Seeded ${goals.length} savings goals.`);

  console.log('\n=============================================');
  console.log('  Database Seeding Completed Successfully!  ');
  console.log('=============================================');
  console.log('Demo Users:');
  console.log(`- Admin:  admin@save.app (ID: ${users[0]._id})`);
  console.log(`- Member: marcus@save.app (ID: ${demoUserId})`);
  console.log('=============================================\n');

  await app.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Database seeding failed:', err);
  process.exit(1);
});
