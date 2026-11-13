export const COOKIE_NAME='zodiac_session';
const encoder=new TextEncoder();
function hex(raw:ArrayBuffer){return [...new Uint8Array(raw)].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function key(secret:string){return crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function createSession(secret:string,now=Date.now()){
  const nonce=hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const payload=`${Math.floor(now/1000)+28800}.${nonce}`;
  return `${payload}.${hex(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload)))}`;
}
export async function verifySession(token:string,secret:string,now=Date.now()){
  const parts=token.split('.');
  if(parts.length!==3||!/^\d{10}$/.test(parts[0])||!/^[0-9a-f]{32}$/.test(parts[1])||!/^[0-9a-f]{64}$/.test(parts[2]))return false;
  const expiry=Number(parts[0]);if(expiry<Math.floor(now/1000)||expiry>Math.floor(now/1000)+28900)return false;
  const signature=Uint8Array.from(parts[2].match(/../g)!,v=>parseInt(v,16));
  return crypto.subtle.verify('HMAC',await key(secret),signature,encoder.encode(parts.slice(0,2).join('.')));
}
export function requestCookie(request:Request){return request.headers.get('cookie')?.split(';').map(p=>p.trim()).find(p=>p.startsWith(COOKIE_NAME+'='))?.slice(COOKIE_NAME.length+1)||'';}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin)return false;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}}
export async function equalPassword(a:string,b:string){const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(a)),crypto.subtle.digest('SHA-256',encoder.encode(b))]);const aa=new Uint8Array(x),bb=new Uint8Array(y);let difference=0;for(let i=0;i<aa.length;i++)difference|=aa[i]^bb[i];return difference===0;}
