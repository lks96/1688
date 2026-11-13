import {COOKIE_NAME,sameOrigin} from '@/lib/auth';
import {privateHeaders} from '@/lib/runtime';
export async function POST(request:Request){if(!sameOrigin(request))return Response.json({error:'来源校验失败'},{status:403});return Response.json({ok:true},{headers:{...privateHeaders,'Set-Cookie':`${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`}});}
