import {authorized,privateHeaders} from '@/lib/runtime';
import {getDashboard} from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  try{
    if(!await authorized(request))return Response.json({error:'请先输入访问密码'},{status:401,headers:privateHeaders});
    const state=await getDashboard(new URL(request.url).searchParams.get('refresh')==='1');
    return Response.json(state,{headers:privateHeaders});
  }catch{return Response.json({error:'模型暂时不可用，请稍后重试'},{status:503,headers:privateHeaders});}
}
