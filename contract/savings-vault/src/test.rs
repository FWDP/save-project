extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Env,
};

struct Fixture {
    env: Env,
    client: SavingsVaultClient<'static>,
    owner: Address,
    contributor: Address,
    token: token::Client<'static>,
}

fn fixture() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_800_000_000);
    let owner = Address::generate(&env);
    let contributor = Address::generate(&env);
    let admin = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let contract = env.register(SavingsVault, ());
    let client = SavingsVaultClient::new(&env, &contract);
    let token = token::Client::new(&env, &asset);
    let token_admin = token::StellarAssetClient::new(&env, &asset);
    token_admin.mint(&contributor, &100_000);
    Fixture {
        env,
        client,
        owner,
        contributor,
        token,
    }
}

#[test]
fn create_and_list_goal() {
    let f = fixture();
    let id = f
        .client
        .create_goal(&f.owner, &f.token.address, &10_000, &Some(1_900_000_000));
    assert_eq!(id, 1);
    let goal = f.client.get_goal(&id);
    assert_eq!(goal.owner, f.owner);
    assert_eq!(goal.balance, 0);
    assert_eq!(goal.status, GoalStatus::Active);
    assert_eq!(f.client.list_goals(&goal.owner).len(), 1);
}

#[test]
fn new_owner_has_an_empty_goal_list() {
    let f = fixture();
    assert!(f.client.list_goals(&f.owner).is_empty());
}

#[test]
fn contribution_transfers_tokens_and_reaches_target() {
    let f = fixture();
    let id = f
        .client
        .create_goal(&f.owner, &f.token.address, &10_000, &None);
    let goal = f.client.contribute(&id, &f.contributor, &10_000);
    assert_eq!(goal.balance, 10_000);
    assert_eq!(f.token.balance(&f.contributor), 90_000);
    assert_eq!(f.token.balance(&f.client.address), 10_000);
    assert_eq!(f.client.complete_goal(&id).status, GoalStatus::Completed);
    assert_eq!(
        f.client.try_complete_goal(&id),
        Err(Ok(VaultError::GoalNotActive))
    );
}

#[test]
fn deadline_can_complete_and_owner_can_withdraw() {
    let f = fixture();
    let id = f
        .client
        .create_goal(&f.owner, &f.token.address, &50_000, &Some(1_800_000_100));
    f.client.contribute(&id, &f.contributor, &8_000);
    f.env.ledger().set_timestamp(1_800_000_101);
    f.client.complete_goal(&id);
    let goal = f.client.withdraw(&id, &3_000);
    assert_eq!(goal.balance, 5_000);
    assert_eq!(f.token.balance(&f.owner), 3_000);
}

#[test]
fn cancellation_refunds_balance() {
    let f = fixture();
    let id = f
        .client
        .create_goal(&f.owner, &f.token.address, &50_000, &None);
    f.client.contribute(&id, &f.contributor, &7_500);
    let goal = f.client.cancel_goal(&id);
    assert_eq!(goal.status, GoalStatus::Cancelled);
    assert_eq!(goal.balance, 0);
    assert_eq!(f.token.balance(&f.owner), 7_500);
    assert_eq!(
        f.client.try_cancel_goal(&id),
        Err(Ok(VaultError::GoalNotActive))
    );
}

#[test]
fn rejects_invalid_lifecycle_actions() {
    let f = fixture();
    assert_eq!(
        f.client
            .try_create_goal(&f.owner, &f.token.address, &0, &None),
        Err(Ok(VaultError::InvalidAmount))
    );
    let id = f
        .client
        .create_goal(&f.owner, &f.token.address, &10_000, &None);
    assert_eq!(
        f.client.try_complete_goal(&id),
        Err(Ok(VaultError::CompletionConditionsNotMet))
    );
    assert_eq!(
        f.client.try_withdraw(&id, &1),
        Err(Ok(VaultError::GoalNotCompleted))
    );
    f.client.cancel_goal(&id);
    assert_eq!(
        f.client.try_contribute(&id, &f.contributor, &1),
        Err(Ok(VaultError::GoalNotActive))
    );
}
