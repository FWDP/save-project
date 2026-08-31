import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';

import { LinkStellarAccountDto, PreparePaymentDto, PrepareVaultInvocationDto, StellarEventsQueryDto, SubmitStellarTransactionDto } from './stellar.dto';
import { assertMatchingSignedTransaction, buildSep7SigningUrl, loadIntegritySigner, transactionHash } from './stellar.sep7';
import { StellarAccount, StellarAccountDocument, StellarContractEvent, StellarContractEventDocument, StellarSigningRequest, StellarSigningRequestDocument } from './stellar.schema';
import { SavingsService } from '../savings/savings.service';

type SigningRequest = {
  idempotencyKey: string;
  kind: 'classic' | 'soroban';
  action: string;
  source: string;
  unsignedXdr: string;
  status: 'prepared' | 'submitted' | 'pending' | 'success' | 'failed';
  hash: string;
  fee?: string;
  savingsGoalId?: string;
  goalId?: string;
  error?: string;
  createdAt: string;
};

function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([key, item]) => [String(key), jsonSafe(item)]));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonSafe(item)]));
  }
  return value;
}

@Injectable()
export class StellarService implements OnModuleInit, OnModuleDestroy {
  private readonly horizonUrl: string;
  private readonly rpcUrl: string;
  private readonly networkPassphrase: string;
  private readonly vaultContractId?: string;
  private readonly xlmSacId: string;
  private readonly maxSorobanFee: bigint;
  private readonly callbackBaseUrl?: string;
  private readonly originDomain?: string;
  private readonly integritySigner?: Keypair;
  private readonly horizon: Horizon.Server;
  private readonly rpc: rpc.Server;
  private readonly signingRequests = new Map<string, SigningRequest>();
  private readonly linkedAccounts = new Set<string>();
  private eventCursor?: string;
  private eventTimer?: NodeJS.Timeout;
  private readonly eventPollMs: number;

  constructor(
    config: ConfigService,
    @InjectModel(StellarAccount.name) private readonly accountModel: Model<StellarAccountDocument>,
    @InjectModel(StellarSigningRequest.name) private readonly signingRequestModel: Model<StellarSigningRequestDocument>,
    @InjectModel(StellarContractEvent.name) private readonly eventModel: Model<StellarContractEventDocument>,
    private readonly savingsService: SavingsService,
  ) {
    this.horizonUrl = config.get('STELLAR_HORIZON_URL') ?? 'https://horizon-testnet.stellar.org';
    this.rpcUrl = config.get('STELLAR_RPC_URL') ?? 'https://soroban-testnet.stellar.org';
    this.networkPassphrase = config.get('STELLAR_NETWORK_PASSPHRASE') ?? Networks.TESTNET;
    this.vaultContractId = config.get('STELLAR_VAULT_CONTRACT_ID');
    this.xlmSacId = config.get('STELLAR_XLM_SAC_ID') ?? Asset.native().contractId(this.networkPassphrase);
    const configuredMaxSorobanFee = String(config.get('STELLAR_MAX_SOROBAN_FEE') ?? '1000000000').trim();
    if (!/^\d+$/.test(configuredMaxSorobanFee) || BigInt(configuredMaxSorobanFee) <= 0n) {
      throw new Error('STELLAR_MAX_SOROBAN_FEE must be a positive integer in stroops');
    }
    this.maxSorobanFee = BigInt(configuredMaxSorobanFee);
    this.eventPollMs = Math.max(Number(config.get('STELLAR_EVENT_POLL_MS') ?? 15_000), 5_000);
    this.callbackBaseUrl = config.get<string>('STELLAR_CALLBACK_BASE_URL')?.replace(/\/+$/, '');
    this.originDomain = config.get<string>('STELLAR_ORIGIN_DOMAIN')?.trim() || undefined;
    this.integritySigner = loadIntegritySigner(config.get<string>('STELLAR_INTEGRITY_SIGNER_SECRET_FILE'));
    if (this.originDomain && !this.integritySigner) {
      throw new Error('STELLAR_ORIGIN_DOMAIN requires STELLAR_INTEGRITY_SIGNER_SECRET_FILE');
    }
    this.horizon = new Horizon.Server(this.horizonUrl, { allowHttp: this.horizonUrl.startsWith('http://') });
    this.rpc = new rpc.Server(this.rpcUrl, { allowHttp: this.rpcUrl.startsWith('http://') });
  }

  onModuleInit() {
    if (!this.vaultContractId) return;
    const poll = async () => {
      try {
        const page = await this.getVaultEvents(this.eventCursor ? { cursor: this.eventCursor, limit: 100 } : { limit: 100 });
        this.eventCursor = page.cursor;
      } catch {
        // RPC outages are retried on the next interval; no signing or state mutation occurs here.
      }
    };
    void poll();
    this.eventTimer = setInterval(() => void poll(), this.eventPollMs);
  }

  onModuleDestroy() {
    if (this.eventTimer) clearInterval(this.eventTimer);
  }

  async networkHealth() {
    try {
      const [network, ledger] = await Promise.all([this.rpc.getNetwork(), this.rpc.getLatestLedger()]);
      return {
        network: 'testnet',
        passphrase: network.passphrase,
        protocolVersion: network.protocolVersion,
        latestLedger: ledger.sequence,
        horizonUrl: this.horizonUrl,
        rpcUrl: this.rpcUrl,
        vaultContractId: this.vaultContractId ?? null,
        xlmSacId: this.xlmSacId,
        sep7: {
          callbackEnabled: Boolean(this.callbackBaseUrl),
          requestSigningEnabled: Boolean(this.originDomain && this.integritySigner),
          requestSigningPublicKey: this.integritySigner?.publicKey() ?? null,
          originDomain: this.originDomain ?? null,
        },
      };
    } catch (error) {
      throw new ServiceUnavailableException(`Stellar Testnet is unavailable: ${error instanceof Error ? error.message : 'unknown RPC error'}`);
    }
  }

  stellarToml() {
    const lines = [
      'NETWORK_PASSPHRASE="Test SDF Network ; September 2015"',
      'VERSION="2.0.0"',
    ];
    if (this.integritySigner) lines.push(`URI_REQUEST_SIGNING_KEY="${this.integritySigner.publicKey()}"`);
    return `${lines.join('\n')}\n`;
  }

  async linkAccount(dto: LinkStellarAccountDto) {
    this.assertAccount(dto.address);
    const portfolio = await this.getPortfolio(dto.address);
    this.linkedAccounts.add(dto.address);
    void this.accountModel.updateOne({ address: dto.address }, { $set: { network: 'testnet', signingMode: 'watch-only', lastSyncedAt: new Date() } }, { upsert: true }).catch(() => undefined);
    return { ...portfolio, linked: true, signingMode: 'external-wallet', secretsStored: false };
  }

  async getPortfolio(address: string) {
    this.assertAccount(address);
    try {
      const account = await this.horizon.loadAccount(address);
      return {
        address,
        sequence: account.sequence,
        balances: account.balances.map((balance) => ({
          asset: balance.asset_type === 'native' ? 'XLM' : `${'asset_code' in balance ? balance.asset_code : 'POOL'}`,
          issuer: 'asset_issuer' in balance ? balance.asset_issuer : undefined,
          balance: balance.balance,
          assetType: balance.asset_type,
        })),
        subentryCount: account.subentry_count,
        lastModifiedLedger: account.last_modified_ledger,
        explorerUrl: `https://stellar.expert/explorer/testnet/account/${address}`,
      };
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to load Testnet account: ${error instanceof Error ? error.message : 'Horizon error'}`);
    }
  }

  async getPayments(address: string, limit = 20) {
    this.assertAccount(address);
    try {
      const page = await this.horizon.payments().forAccount(address).order('desc').limit(Math.min(Math.max(limit, 1), 100)).call();
      return page.records.map((record: any) => ({ id: record.id, type: record.type, from: record.from, to: record.to, amount: record.amount, asset: record.asset_type === 'native' ? 'XLM' : record.asset_code, transactionHash: record.transaction_hash, createdAt: record.created_at, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${record.transaction_hash}` }));
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to load Testnet payments: ${error instanceof Error ? error.message : 'Horizon error'}`);
    }
  }

  async preparePayment(dto: PreparePaymentDto) {
    this.assertAccount(dto.source); this.assertAccount(dto.destination);
    const existing = await this.findSigningRequest(dto.idempotencyKey);
    if (existing) {
      if (existing.action !== 'payment' || existing.source !== dto.source) throw new ConflictException('Idempotency key is already assigned to a different request');
      return this.presentSigningRequest(existing);
    }
    try {
      const source = await this.horizon.loadAccount(dto.source);
      let builder = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase })
        .addOperation(Operation.payment({ destination: dto.destination, asset: Asset.native(), amount: dto.amount }));
      if (dto.memo) builder = builder.addMemo(Memo.text(dto.memo.slice(0, 28)));
      const transaction = builder.setTimeout(180).build();
      return this.recordSigningRequest(dto.idempotencyKey, 'classic', 'payment', dto.source, transaction.toXDR());
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to prepare payment: ${error instanceof Error ? error.message : 'Horizon error'}`);
    }
  }

  async prepareVaultInvocation(dto: PrepareVaultInvocationDto) {
    this.assertAccount(dto.source);
    const contractId = this.requireVaultContract();
    const existing = await this.findSigningRequest(dto.idempotencyKey);
    if (existing) {
      if (existing.action !== dto.action || existing.source !== dto.source) throw new ConflictException('Idempotency key is already assigned to a different request');
      return this.presentSigningRequest(existing);
    }
    try {
      const source = await this.rpc.getAccount(dto.source);
      const contract = new Contract(contractId);
      const operation = contract.call(dto.action, ...this.vaultArguments(dto));
      const raw = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: this.networkPassphrase }).addOperation(operation).setTimeout(180).build();
      const prepared = await this.rpc.prepareTransaction(raw);
      const simulatedFee = BigInt(prepared.fee);
      if (simulatedFee > this.maxSorobanFee) {
        throw new BadRequestException(
          `Simulated fee ${prepared.fee} stroops exceeds configured maximum ${this.maxSorobanFee.toString()} stroops`,
        );
      }
      return this.recordSigningRequest(
        dto.idempotencyKey,
        'soroban',
        dto.action,
        dto.source,
        prepared.toXDR(),
        prepared.fee,
        { savingsGoalId: dto.savingsGoalId, goalId: dto.goalId },
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException(`Unable to simulate vault invocation: ${error instanceof Error ? error.message : 'RPC error'}`);
    }
  }

  async submitTransaction(dto: SubmitStellarTransactionDto) {
    let transaction: ReturnType<typeof TransactionBuilder.fromXDR>;
    try { transaction = TransactionBuilder.fromXDR(dto.signedXdr, this.networkPassphrase); } catch { throw new BadRequestException('Invalid signed transaction XDR'); }
    if (!('signatures' in transaction) || transaction.signatures.length === 0) throw new BadRequestException('Transaction has no signatures');
    const request = dto.idempotencyKey ? await this.findSigningRequest(dto.idempotencyKey) : undefined;
    if (request) {
      try { assertMatchingSignedTransaction(request.unsignedXdr, dto.signedXdr, this.networkPassphrase); }
      catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Signed transaction mismatch'); }
      if (['submitted', 'pending', 'success'].includes(request.status)) return this.presentSigningRequest(request);
    }
    try {
      if (dto.kind === 'classic') {
        const result = await this.horizon.submitTransaction(transaction as any);
        if (request) Object.assign(request, { status: 'success', hash: result.hash, error: undefined });
        if (dto.idempotencyKey) await this.persistRequestUpdate(dto.idempotencyKey, 'success', result.hash);
        return { kind: dto.kind, status: 'success', hash: result.hash, ledger: result.ledger, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.hash}` };
      }
      const result = await this.rpc.sendTransaction(transaction as any);
      if (request) Object.assign(request, { status: result.status === 'PENDING' ? 'pending' : 'submitted', hash: result.hash, error: undefined });
      if (dto.idempotencyKey) await this.persistRequestUpdate(dto.idempotencyKey, result.status === 'PENDING' ? 'pending' : 'submitted', result.hash);
      return { kind: dto.kind, status: result.status.toLowerCase(), hash: result.hash, latestLedger: result.latestLedger, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${result.hash}` };
    } catch (error) {
      if (request) {
        request.status = 'failed';
        request.error = error instanceof Error ? error.message : 'network error';
        await this.persistRequestUpdate(request.idempotencyKey, 'failed', request.hash, request.error);
      }
      throw new ServiceUnavailableException(`Transaction submission failed: ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  async receiveSep7Callback(idempotencyKey: string, signedXdr: string) {
    const request = await this.findSigningRequest(idempotencyKey);
    if (!request) throw new BadRequestException('Unknown or expired signing request');
    try { assertMatchingSignedTransaction(request.unsignedXdr, signedXdr, this.networkPassphrase); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Signed transaction mismatch'); }
    return this.submitTransaction({ signedXdr, kind: request.kind, idempotencyKey });
  }

  async getSigningRequest(idempotencyKey: string) {
    const request = await this.findSigningRequest(idempotencyKey);
    if (!request) throw new BadRequestException('Signing request not found');
    await this.reconcileSigningRequest(request);
    return this.presentSigningRequest(request);
  }

  async getTransaction(hash: string, kind: 'classic' | 'soroban') {
    try {
      if (kind === 'classic') {
        const result = await this.horizon.transactions().transaction(hash).call();
        return { kind, hash, status: result.successful ? 'success' : 'failed', ledger: result.ledger, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}` };
      }
      const result = await this.rpc.getTransaction(hash);
      return { kind, hash, status: result.status.toLowerCase(), latestLedger: result.latestLedger, explorerUrl: `https://stellar.expert/explorer/testnet/tx/${hash}` };
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to reconcile transaction: ${error instanceof Error ? error.message : 'network error'}`);
    }
  }

  async listVaultGoals(owner: string) {
    this.assertAccount(owner);
    try {
      const response = await this.rpc.queryContract<any[]>(this.requireVaultContract(), 'list_goals', { owner }, this.networkPassphrase);
      const goals = (response.result ?? []).map((raw) => this.presentGoal(raw));
      const eventPage = await this.getVaultEvents({ limit: 100 });
      const goalIds = new Set(goals.map((goal) => goal.id));
      const events = eventPage.events
        .map((event) => ({
          ...event,
          type: String(event.topics[0] ?? 'contract_event'),
          goalId: event.topics.length > 1 ? String(event.topics[1]) : null,
          explorerUrl: `https://stellar.expert/explorer/testnet/tx/${event.txHash}`,
        }))
        .filter((event) => event.goalId && goalIds.has(event.goalId));
      return { owner, goals, events, ledgerVerified: response.isReadCall, contractId: this.vaultContractId };
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to query vault goals: ${error instanceof Error ? error.message : 'RPC error'}`);
    }
  }

  private presentGoal(raw: unknown) {
    const goal = raw as Record<string, unknown>;
    const stringValue = (value: unknown) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string') return value;
      const rendered = String(value);
      return rendered === '[object Object]' ? JSON.stringify(jsonSafe(value)) : rendered;
    };
    const rawStatus = goal.status as { tag?: unknown } | string | undefined;
    const status = typeof rawStatus === 'string' ? rawStatus : stringValue(rawStatus?.tag) ?? 'Unknown';
    return {
      id: stringValue(goal.id) ?? '0',
      owner: stringValue(goal.owner) ?? '',
      asset: stringValue(goal.asset) ?? '',
      targetAmount: stringValue(goal.target_amount ?? goal.targetAmount) ?? '0',
      targetDate: stringValue(goal.target_date ?? goal.targetDate),
      balance: stringValue(goal.balance) ?? '0',
      status,
    };
  }

  async getVaultEvents(query: StellarEventsQueryDto) {
    const contractId = this.requireVaultContract();
    try {
      const request: rpc.Api.GetEventsRequest = query.cursor
        ? { filters: [{ type: 'contract', contractIds: [contractId] }], cursor: query.cursor, limit: query.limit ?? 50 }
        : { filters: [{ type: 'contract', contractIds: [contractId] }], startLedger: query.startLedger ?? Math.max((await this.rpc.getLatestLedger()).sequence - 10_000, 1), limit: query.limit ?? 50 };
      const response = await this.rpc.getEvents(request);
      const events = response.events.map((event) => ({ id: event.id, ledger: event.ledger, ledgerClosedAt: event.ledgerClosedAt, txHash: event.txHash, contractId: event.contractId?.toString() ?? contractId, topics: event.topic.map((topic) => jsonSafe(scValToNative(topic))), value: jsonSafe(scValToNative(event.value)), successful: event.inSuccessfulContractCall }));
      if (events.length) void this.eventModel.bulkWrite(events.map((event) => ({ updateOne: { filter: { eventId: event.id }, update: { $set: { eventId: event.id, contractId: event.contractId, ledger: event.ledger, transactionHash: event.txHash, ledgerClosedAt: event.ledgerClosedAt, topics: event.topics, value: event.value, successful: event.successful } }, upsert: true } }))).catch(() => undefined);
      return { cursor: response.cursor, events };
    } catch (error) {
      throw new ServiceUnavailableException(`Unable to fetch vault events: ${error instanceof Error ? error.message : 'RPC error'}`);
    }
  }

  private vaultArguments(dto: PrepareVaultInvocationDto) {
    const id = () => { if (!dto.goalId) throw new BadRequestException('goalId is required'); return nativeToScVal(BigInt(dto.goalId), { type: 'u128' }); };
    const amount = (value = dto.amount) => { if (!value || BigInt(value) <= 0n) throw new BadRequestException('A positive amount is required'); return nativeToScVal(BigInt(value), { type: 'i128' }); };
    if (dto.action === 'create_goal') {
      const owner = dto.owner ?? dto.source; this.assertAccount(owner);
      const assetContractId = dto.assetContractId || this.xlmSacId;
      if (!StrKey.isValidContract(assetContractId)) throw new BadRequestException('A valid SAC assetContractId is required');
      return [new Address(owner).toScVal(), new Address(assetContractId).toScVal(), amount(dto.targetAmount), dto.targetDate ? nativeToScVal(BigInt(dto.targetDate), { type: 'u64' }) : nativeToScVal(null)];
    }
    if (dto.action === 'contribute') { const contributor = dto.contributor ?? dto.source; this.assertAccount(contributor); return [id(), new Address(contributor).toScVal(), amount()]; }
    if (dto.action === 'withdraw') return [id(), amount()];
    return [id()];
  }

  private async recordSigningRequest(
    idempotencyKey: string,
    kind: SigningRequest['kind'],
    action: string,
    source: string,
    unsignedXdr: string,
    fee = BASE_FEE,
    linkedGoal: Pick<SigningRequest, 'savingsGoalId' | 'goalId'> = {},
  ) {
    const request: SigningRequest = {
      idempotencyKey,
      kind,
      action,
      source,
      unsignedXdr,
      status: 'prepared',
      hash: transactionHash(unsignedXdr, this.networkPassphrase),
      fee: String(fee),
      savingsGoalId: linkedGoal.savingsGoalId,
      goalId: linkedGoal.goalId,
      createdAt: new Date().toISOString(),
    };
    this.signingRequests.set(idempotencyKey, request);
    await this.signingRequestModel.updateOne({ idempotencyKey }, { $set: request }, { upsert: true });
    return this.presentSigningRequest(request);
  }

  private presentSigningRequest(request: SigningRequest) {
    const callbackUrl = this.callbackBaseUrl
      ? `${this.callbackBaseUrl}/stellar/signing-requests/${encodeURIComponent(request.idempotencyKey)}/callback`
      : undefined;
    return {
      ...request,
      network: 'testnet',
      networkPassphrase: this.networkPassphrase,
      callbackUrl: callbackUrl ?? null,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${request.hash}`,
      signingUrl: buildSep7SigningUrl({
        xdr: request.unsignedXdr,
        source: request.source,
        action: request.action,
        callbackUrl,
        originDomain: this.originDomain,
        signer: this.integritySigner,
      }),
    };
  }

  private async findSigningRequest(idempotencyKey: string): Promise<SigningRequest | undefined> {
    const cached = this.signingRequests.get(idempotencyKey);
    if (cached) return cached;
    const persisted = await this.signingRequestModel.findOne({ idempotencyKey }).lean().exec();
    if (!persisted?.hash || !persisted.source) return undefined;
    const request: SigningRequest = {
      idempotencyKey: persisted.idempotencyKey,
      kind: persisted.kind as SigningRequest['kind'],
      action: persisted.action,
      source: persisted.source,
      unsignedXdr: persisted.unsignedXdr,
      status: persisted.status as SigningRequest['status'],
      hash: persisted.hash,
      fee: persisted.fee,
      savingsGoalId: persisted.savingsGoalId,
      goalId: persisted.goalId,
      error: persisted.error,
      createdAt: ((persisted as unknown as { createdAt?: Date }).createdAt ?? new Date()).toISOString(),
    };
    this.signingRequests.set(idempotencyKey, request);
    return request;
  }

  private async reconcileSigningRequest(request: SigningRequest): Promise<void> {
    if (request.status === 'success') return;
    try {
      if (request.kind === 'classic') {
        const result = await this.horizon.transactions().transaction(request.hash).call();
        request.status = result.successful ? 'success' : 'failed';
        request.error = result.successful ? undefined : 'Transaction failed on Stellar Testnet';
      } else {
        const result = await this.rpc.getTransaction(request.hash);
        if (result.status === 'SUCCESS') {
          request.status = 'success';
          request.error = undefined;
          await this.syncLinkedSavingsGoal(request, result.returnValue);
        }
        else if (result.status === 'FAILED') { request.status = 'failed'; request.error = 'Soroban transaction failed on Stellar Testnet'; }
        else if (result.status === 'NOT_FOUND' && Date.now() - Date.parse(request.createdAt) > 180_000) {
          request.status = 'failed'; request.error = 'Wallet approval expired. Prepare a fresh request and retry.';
        }
      }
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status !== 404) return;
      if (Date.now() - Date.parse(request.createdAt) > 180_000) {
        request.status = 'failed'; request.error = 'Wallet approval expired. Prepare a fresh request and retry.';
      }
    }
    await this.persistRequestUpdate(request.idempotencyKey, request.status, request.hash, request.error, request.goalId);
  }

  private async syncLinkedSavingsGoal(request: SigningRequest, returnValue?: unknown) {
    if (!request.savingsGoalId) return;
    try {
      if (request.action === 'create_goal' && returnValue) {
        request.goalId = String(scValToNative(returnValue as Parameters<typeof scValToNative>[0]));
      }
      if (!request.goalId) return;

      const response = await this.rpc.queryContract<Record<string, unknown>>(
        this.requireVaultContract(),
        'get_goal',
        { goal_id: BigInt(request.goalId) },
        this.networkPassphrase,
      );
      const goal = this.presentGoal(response.result);
      const balance = Number(BigInt(goal.balance)) / 10_000_000;
      const status = goal.status === 'Cancelled'
        ? 'cancelled'
        : goal.status === 'Completed' && BigInt(goal.balance) === 0n
          ? 'withdrawn'
          : goal.status === 'Completed'
            ? 'completed'
            : 'active';
      await this.savingsService.update(request.savingsGoalId, {
        fundedAmount: balance,
        status,
        network: 'testnet',
        ownerAddress: goal.owner,
        contractId: this.requireVaultContract(),
        vaultGoalId: request.goalId,
        transactionHash: request.hash,
      });
    } catch {
      // The confirmed on-chain transaction remains authoritative. A later
      // refresh can retry tracker reconciliation without affecting funds.
    }
  }

  private assertAccount(address: string) {
    if (!StrKey.isValidEd25519PublicKey(address)) throw new BadRequestException('Invalid Stellar G-address');
  }

  private requireVaultContract() {
    if (!this.vaultContractId || !StrKey.isValidContract(this.vaultContractId)) throw new ConflictException('STELLAR_VAULT_CONTRACT_ID is not configured');
    return this.vaultContractId;
  }

  private async persistRequestUpdate(idempotencyKey: string, status: SigningRequest['status'], hash: string, error?: string, goalId?: string) {
    await this.signingRequestModel.updateOne(
      { idempotencyKey },
      { $set: { status, hash, error: error ?? null, ...(goalId ? { goalId } : {}) } },
    ).catch(() => undefined);
  }
}
