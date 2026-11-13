import {COOKIE_NAME,createSession,equalPassword,sameOrigin} from '@/lib/auth';
import {privateHeaders,secret} from '@/lib/runtime';
export const dynamic='force-dynamic';
const attempts=new Map<string,number[]>();
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'请求来源校验失败，请刷新页面'},{status:403,headers:privateHeaders});
  const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'visitor';
  const history=(attempts.get(ip)||[]).filter(t=>t>Date.now()-300000);
  if(history.length>=8)return Response.json({error:'尝试次数较多，请5分钟后再试'},{status:429,headers:privateHeaders});
  history.push(Date.now());attempts.set(ip,history);
  try{
    const body=await request.text();if(body.length>1024)return Response.json({error:'请求过大'},{status:413,headers:privateHeaders});
    const password=JSON.parse(body).password;
    if(typeof password!=='string'||!await equalPassword(password,secret('ACCESS_PASSWORD')))return Response.json({error:'密码不正确，请重新输入'},{status:403,headers:privateHeaders});
    const token=await createSession(secret('SESSION_SECRET'));attempts.delete(ip);
    return Response.json({ok:true},{headers:{...privateHeaders,'Set-Cookie':`${COOKIE_NAME}=${token}; Path=/; Max-Age=28800; HttpOnly; Secure; SameSite=Strict`}});
  }catch{return Response.json({error:'登录暂时不可用，请稍后重试'},{status:500,headers:privateHeaders});}
}
