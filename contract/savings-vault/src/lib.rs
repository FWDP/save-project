#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Vec,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const PERSISTENT_LIFETIME: u32 = 365 * DAY_IN_LEDGERS;
const PERSISTENT_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 7 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum GoalStatus {
    Active,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Goal {
    pub id: u128,
    pub owner: Address,
    pub asset: Address,
    pub target_amount: i128,
    pub target_date: Option<u64>,
    pub balance: i128,
    pub status: GoalStatus,
}

#[contractevent]
pub struct GoalCreated {
    #[topic]
    pub goal_id: u128,
    #[topic]
    pub owner: Address,
    pub asset: Address,
    pub target_amount: i128,
    pub target_date: Option<u64>,
}

#[contractevent]
pub struct Contribution {
    #[topic]
    pub goal_id: u128,
    #[topic]
    pub contributor: Address,
    pub amount: i128,
    pub balance: i128,
}

#[contractevent]
pub struct GoalCompleted {
    #[topic]
    pub goal_id: u128,
    pub balance: i128,
}

#[contractevent]
pub struct Withdrawal {
    #[topic]
    pub goal_id: u128,
    #[topic]
    pub owner: Address,
    pub amount: i128,
    pub balance: i128,
}

#[contractevent]
pub struct GoalCancelled {
    #[topic]
    pub goal_id: u128,
    #[topic]
    pub owner: Address,
    pub refunded: i128,
}

#[contracttype]
enum DataKey {
    Counter,
    AllowedAsset,
    Goal(u128),
    OwnerGoals(Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    GoalNotFound = 1,
    InvalidAmount = 2,
    InvalidTargetDate = 3,
    GoalNotActive = 4,
    GoalNotCompleted = 5,
    CompletionConditionsNotMet = 6,
    InsufficientBalance = 7,
    ArithmeticOverflow = 8,
    UnsupportedAsset = 9,
}

#[contract]
pub struct SavingsVault;

#[contractimpl]
impl SavingsVault {
    pub fn __constructor(env: Env, allowed_asset: Address) {
        env.storage()
            .instance()
            .set(&DataKey::AllowedAsset, &allowed_asset);
        bump_instance(&env);
    }

    pub fn allowed_asset(env: Env) -> Address {
        bump_instance(&env);
        env.storage()
            .instance()
            .get(&DataKey::AllowedAsset)
            .expect("allowed asset must be configured at deployment")
    }

    pub fn create_goal(
        env: Env,
        owner: Address,
        asset: Address,
        target_amount: i128,
        target_date: Option<u64>,
    ) -> Result<u128, VaultError> {
        owner.require_auth();
        if target_amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        if target_date.is_some_and(|deadline| deadline <= env.ledger().timestamp()) {
            return Err(VaultError::InvalidTargetDate);
        }
        if asset != Self::allowed_asset(env.clone()) {
            return Err(VaultError::UnsupportedAsset);
        }

        bump_instance(&env);
        let id = env
            .storage()
            .instance()
            .get::<_, u128>(&DataKey::Counter)
            .unwrap_or(0)
            .checked_add(1)
            .ok_or(VaultError::ArithmeticOverflow)?;
        env.storage().instance().set(&DataKey::Counter, &id);

        let goal = Goal {
            id,
            owner: owner.clone(),
            asset: asset.clone(),
            target_amount,
            target_date,
            balance: 0,
            status: GoalStatus::Active,
        };
        write_goal(&env, &goal);

        let owner_key = DataKey::OwnerGoals(owner.clone());
        let mut ids = env
            .storage()
            .persistent()
            .get::<_, Vec<u128>>(&owner_key)
            .unwrap_or(Vec::new(&env));
        ids.push_back(id);
        env.storage().persistent().set(&owner_key, &ids);
        bump_persistent(&env, &owner_key);
        GoalCreated {
            goal_id: id,
            owner,
            asset,
            target_amount,
            target_date,
        }
        .publish(&env);
        Ok(id)
    }

    pub fn contribute(
        env: Env,
        goal_id: u128,
        contributor: Address,
        amount: i128,
    ) -> Result<Goal, VaultError> {
        contributor.require_auth();
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        let mut goal = read_goal(&env, goal_id)?;
        if goal.status != GoalStatus::Active {
            return Err(VaultError::GoalNotActive);
        }
        let next_balance = goal
            .balance
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        token::Client::new(&env, &goal.asset).transfer(
            &contributor,
            env.current_contract_address(),
            &amount,
        );
        goal.balance = next_balance;
        write_goal(&env, &goal);
        Contribution {
            goal_id,
            contributor,
            amount,
            balance: next_balance,
        }
        .publish(&env);
        Ok(goal)
    }

    pub fn complete_goal(env: Env, goal_id: u128) -> Result<Goal, VaultError> {
        let mut goal = read_goal(&env, goal_id)?;
        if goal.status != GoalStatus::Active {
            return Err(VaultError::GoalNotActive);
        }
        let target_reached = goal.balance >= goal.target_amount;
        let deadline_reached = goal
            .target_date
            .is_some_and(|deadline| env.ledger().timestamp() >= deadline);
        if !target_reached && !deadline_reached {
            return Err(VaultError::CompletionConditionsNotMet);
        }
        goal.status = GoalStatus::Completed;
        write_goal(&env, &goal);
        GoalCompleted {
            goal_id,
            balance: goal.balance,
        }
        .publish(&env);
        Ok(goal)
    }

    pub fn withdraw(env: Env, goal_id: u128, amount: i128) -> Result<Goal, VaultError> {
        if amount <= 0 {
            return Err(VaultError::InvalidAmount);
        }
        let mut goal = read_goal(&env, goal_id)?;
        goal.owner.require_auth();
        if goal.status != GoalStatus::Completed {
            return Err(VaultError::GoalNotCompleted);
        }
        if amount > goal.balance {
            return Err(VaultError::InsufficientBalance);
        }
        token::Client::new(&env, &goal.asset).transfer(
            &env.current_contract_address(),
            &goal.owner,
            &amount,
        );
        goal.balance -= amount;
        write_goal(&env, &goal);
        Withdrawal {
            goal_id,
            owner: goal.owner.clone(),
            amount,
            balance: goal.balance,
        }
        .publish(&env);
        Ok(goal)
    }

    pub fn cancel_goal(env: Env, goal_id: u128) -> Result<Goal, VaultError> {
        let mut goal = read_goal(&env, goal_id)?;
        goal.owner.require_auth();
        if goal.status != GoalStatus::Active {
            return Err(VaultError::GoalNotActive);
        }
        let refund = goal.balance;
        if refund > 0 {
            token::Client::new(&env, &goal.asset).transfer(
                &env.current_contract_address(),
                &goal.owner,
                &refund,
            );
            goal.balance = 0;
        }
        goal.status = GoalStatus::Cancelled;
        write_goal(&env, &goal);
        GoalCancelled {
            goal_id,
            owner: goal.owner.clone(),
            refunded: refund,
        }
        .publish(&env);
        Ok(goal)
    }

    pub fn get_goal(env: Env, goal_id: u128) -> Result<Goal, VaultError> {
        read_goal(&env, goal_id)
    }

    pub fn list_goals(env: Env, owner: Address) -> Vec<Goal> {
        let key = DataKey::OwnerGoals(owner);
        let Some(ids) = env.storage().persistent().get::<_, Vec<u128>>(&key) else {
            return Vec::new(&env);
        };
        bump_persistent(&env, &key);
        let mut goals = Vec::new(&env);
        for id in ids.iter() {
            if let Ok(goal) = read_goal(&env, id) {
                goals.push_back(goal);
            }
        }
        goals
    }
}

fn read_goal(env: &Env, id: u128) -> Result<Goal, VaultError> {
    let key = DataKey::Goal(id);
    let goal = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(VaultError::GoalNotFound)?;
    bump_persistent(env, &key);
    Ok(goal)
}

fn write_goal(env: &Env, goal: &Goal) {
    let key = DataKey::Goal(goal.id);
    env.storage().persistent().set(&key, goal);
    bump_persistent(env, &key);
    bump_instance(env);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_LIFETIME);
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_LIFETIME);
}

#[cfg(test)]
mod test;
