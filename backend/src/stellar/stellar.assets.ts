import { BadRequestException } from '@nestjs/common';
import { StrKey } from '@stellar/stellar-sdk';

export function assertAllowedVaultAsset(requestedAsset: string | undefined, allowedAsset: string): string {
  const asset = requestedAsset?.trim() || allowedAsset;
  if (!StrKey.isValidContract(asset)) {
    throw new BadRequestException('A valid SAC assetContractId is required');
  }
  if (asset !== allowedAsset) {
    throw new BadRequestException('Only the configured Native XLM SAC is supported by this Testnet alpha');
  }
  return asset;
}
