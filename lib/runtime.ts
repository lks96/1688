import { env } from 'cloudflare:workers';
import { requestCookie,verifySession } from './auth';
export function secret(name:'ACCESS_PASSWORD'|'SESSION_SECRET'|'UPDATE_TOKEN'){
  const value=(env as unknown as Record<string,unknown>)[name];
  if(typeof value!=='string'||!value)throw new Error('站点访问配置尚未生效');
  return value;
}
export async function authorized(request:Request){return verifySession(requestCookie(request),secret('SESSION_SECRET'));}
export const privateHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
