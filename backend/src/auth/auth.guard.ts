import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { authContext } from './auth-context';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = (request.path as string).toLowerCase().replace(/\/+$/, '');
    // Network evidence and wallet callbacks remain public; private finance records do not.
    if (
      !/^\/(transactions|budgets|categories|savings-goals|users|workspaces|receipts)(\/|$)/.test(
        path,
      ) &&
      path !== '/stellar/vault/prepare'
    )
      return true;
    const authorization = request.headers.authorization;
    if (
      typeof authorization !== 'string' ||
      !/^Bearer \S+$/.test(authorization)
    )
      throw new UnauthorizedException();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key)
      throw new ServiceUnavailableException('Authentication is not configured');
    let response: Response;
    try {
      response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
        headers: { apikey: key, Authorization: authorization },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Sign-in verification unavailable. Please retry.',
      );
    }
    if (response.status >= 500)
      throw new ServiceUnavailableException('Sign-in verification unavailable');
    if (!response.ok)
      throw new UnauthorizedException('Session expired. Please sign in again.');
    const user = await response.json();
    if (typeof user.id !== 'string' || !user.id)
      throw new UnauthorizedException();
    const store = authContext.getStore();
    if (!store)
      throw new ServiceUnavailableException(
        'Authentication context unavailable',
      );
    store.userId = user.id;
    store.admin = user.app_metadata?.role === 'admin';
    if (/^\/users(\/|$)/.test(path) && !store.admin)
      throw new ForbiddenException();
    return true;
  }
}
