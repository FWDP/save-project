import { AsyncLocalStorage } from 'node:async_hooks';
import { UnauthorizedException } from '@nestjs/common';
export const authContext = new AsyncLocalStorage<{
  userId?: string;
  admin?: boolean;
}>();
export function currentOwner() {
  const id = authContext.getStore()?.userId;
  if (!id) throw new UnauthorizedException('Sign in to continue');
  return id;
}
