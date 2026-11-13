import {authorized,privateHeaders} from '@/lib/runtime';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return Response.json({authenticated:await authorized(request)},{headers:privateHeaders});}catch{return Response.json({authenticated:false},{headers:privateHeaders});}}
