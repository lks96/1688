import {env} from 'cloudflare:workers';
import seed from './long-history-seed.json';
import {chinaNow,type RawDraw} from './model';
import {replayLongHistory,type YearHistory,type LongHistoryResult} from './long-history';
let years:YearHistory=seed as YearHistory,loaded=false,lastAttempt=0;
type LongHistoryState=LongHistoryResult&{fetchedAt:string;warning:string|null};
let cached:LongHistoryState|null=null;
const key='zodiac/long-history-2021-v1.json';
export async function getLongHistory(force=false){
 if(cached&&Date.now()-lastAttempt<(force?20000:300000))return cached;
 return (async()=>{
  if(!loaded){try{const stored=await env.BUCKET?.get(key);if(stored)years=await stored.json<YearHistory>();}catch{}loaded=true;}
  lastAttempt=Date.now();const currentYear=Number(chinaNow().slice(0,4));
  const requested=Array.from({length:currentYear-2020},(_,i)=>2021+i).filter(year=>force||year===currentYear||!years[String(year)]?.length);
  const errors:string[]=[];
  // Limit concurrent sockets while retrieving all years.
  for(let i=0;i<requested.length;i+=3){const batch=requested.slice(i,i+3);const results=await Promise.allSettled(batch.map(async year=>{
   const response=await fetch(`https://history.macaumarksix.com/history/macaujc2/y/${year}`,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('接口返回异常');const body=await response.text();if(body.length>5000000)throw new Error('响应过大');
   const payload=JSON.parse(body);if(payload.code!==200||!Array.isArray(payload.data)||!payload.data.length)throw new Error('没有有效数据');
   return payload.data.map((r:RawDraw)=>({expect:r.expect,openTime:r.openTime,openCode:r.openCode,zodiac:r.zodiac})) as RawDraw[];
  }));results.forEach((r,j)=>{if(r.status==='fulfilled')years[String(batch[j])]=r.value;else errors.push(`${batch[j]}年同步失败，使用已保存记录`);});}
  const result=replayLongHistory(years);
  try{await env.BUCKET?.put(key,JSON.stringify(years),{httpMetadata:{contentType:'application/json'}});}catch{errors.push('本次记录未能持久保存');}
  cached={...result,fetchedAt:chinaNow(),warning:errors.join('；')||null};return cached;
 })();
}

export async function getAnnualHistory(force=false){
 const state=await getLongHistory(force);
 const {replayAnnualHistory}=await import('./annual-history');
 return {...replayAnnualHistory(years,state.cutoff),fetchedAt:state.fetchedAt,warning:state.warning};
}

export async function getIntersectionHistory(force=false){
 const state=await getLongHistory(force);
 const {replayAnnualHistory}=await import('./annual-history');
 const {buildIntersectionHistory}=await import('./intersection-history');
 return {...buildIntersectionHistory(state,replayAnnualHistory(years,state.cutoff)),fetchedAt:state.fetchedAt,warning:state.warning};
}
