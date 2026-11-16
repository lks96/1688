import {authorized,privateHeaders} from '@/lib/runtime';
import {getAnnualHistory} from '@/lib/long-history-data';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 try{
  if(!await authorized(request))return Response.json({error:'请先输入访问密码'},{status:401,headers:privateHeaders});
  return Response.json(await getAnnualHistory(new URL(request.url).searchParams.get('refresh')==='1'),{headers:privateHeaders});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'逐年独立回测暂时不可用'},{status:503,headers:privateHeaders});}
}
