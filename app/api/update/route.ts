import {getDashboard,readUpdateStatus} from '@/lib/data';
import {privateHeaders,secret} from '@/lib/runtime';
import {equalPassword} from '@/lib/auth';
export const dynamic='force-dynamic';
async function writerAllowed(request:Request){const key=request.headers.get('X-Site-Update-Key');return !!key&&await equalPassword(key,secret('UPDATE_TOKEN'));}
export async function POST(request:Request){if(!await writerAllowed(request))return Response.json({error:'更新访问未授权'},{status:401,headers:privateHeaders});const result=await getDashboard(true,true);const saved=await readUpdateStatus();return Response.json({...saved,attemptedAt:result.attemptedAt,error:result.error||saved.error},{status:result.error?503:200,headers:privateHeaders});}
export async function GET(request:Request){if(!await writerAllowed(request))return Response.json({error:'更新访问未授权'},{status:401,headers:privateHeaders});return Response.json(await readUpdateStatus(),{headers:privateHeaders});}
