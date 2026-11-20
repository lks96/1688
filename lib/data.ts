import seed from './seed.json';
import {analyze,chinaNow,type RawDraw,type Analysis} from './model';
import {env} from 'cloudflare:workers';
export type DashboardState={analysis:Analysis;source:'live'|'partial'|'snapshot';fetchedAt:string|null;attemptedAt:string|null;error:string|null;refreshSeconds:number};
let rawCache=seed as RawDraw[];
let cache:DashboardState|null=null;
let lastAttempt=0;
let loaded=false;
let persisted=false;
const REFRESH_SECONDS=300;
export function initialState():DashboardState {
  if(!cache)cache={analysis:analyze(rawCache),source:'snapshot',fetchedAt:null,attemptedAt:null,error:null,refreshSeconds:REFRESH_SECONDS};
  return cache;
}
// A completed calendar year is immutable; reuse it only when every day is present.
// Missing days still trigger a fetch, including leap-day gaps.
export function hasCompleteYear(raw:RawDraw[],year:number):boolean{
 const dates=new Set(raw.filter(row=>row.openTime.startsWith(`${year}-`)).map(row=>row.openTime.slice(0,10)));
 for(let day=Date.UTC(year,0,1);day<Date.UTC(year+1,0,1);day+=86400000){if(!dates.has(new Date(day).toISOString().slice(0,10)))return false;}
 return true;
}
function syncFailure(year:number,reason:unknown):string{
 const error=reason instanceof Error?reason:null;
 const detail=error?.name==='TimeoutError'||error?.name==='AbortError'?'请求超时':error?.message.startsWith(`${year}年`)?error.message.slice(5):error instanceof SyntaxError?'接口返回的不是有效JSON':'网络请求失败';
 console.warn('[dashboard] year sync failed',JSON.stringify({year,reason:detail}));
 return `${year}年同步失败（${detail}），使用已保存记录`;
}
async function fetchYear(year:number):Promise<RawDraw[]>{
  const response=await fetch(`https://history.macaumarksix.com/history/macaujc2/y/${year}`,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`${year}年接口返回${response.status}`);
  const text=await response.text();if(text.length>5000000)throw new Error('接口响应过大');
  const payload=JSON.parse(text);
  if(payload.code!==200||!Array.isArray(payload.data))throw new Error(`${year}年接口格式异常`);
  const rows=payload.data.filter((r:RawDraw)=>r&&typeof r.openTime==='string'&&r.openTime.startsWith(`${year}-`)).map((r:RawDraw)=>({expect:String(r.expect),openTime:r.openTime,openCode:r.openCode,zodiac:r.zodiac}));
  if(!rows.length)throw new Error(`${year}年暂无记录`);
  return rows;
}
async function restore(){
  if(loaded)return;
  loaded=true;
  if(env.BUCKET){try{const file=await env.BUCKET.get('zodiac/state-v1.json');if(file){const saved=await file.json<{raw:RawDraw[];state:DashboardState}>();const analysis=analyze(saved.raw);rawCache=saved.raw;cache={...saved.state,analysis};persisted=true;}}catch{}}
  loaded=true;
}
export async function getDashboard(force=false,scheduled=false):Promise<DashboardState>{
  // Populate a usable snapshot before any request-owned I/O can be cancelled.
  initialState();
  await restore();
  const age=Date.now()-lastAttempt;
  if(!scheduled&&lastAttempt&&age<(force?20000:REFRESH_SECONDS*1000))return cache!;
  lastAttempt=Date.now();
  return (async()=>{
    const attemptedAt=chinaNow();
    try{
      const year=Number(attemptedAt.slice(0,4));
      const years=Array.from({length:year-2024},(_,i)=>2025+i).filter(y=>y===year||!hasCompleteYear(rawCache,y));
      const fetched=await Promise.allSettled(years.map(fetchYear));
      const incoming:RawDraw[]=[],errors:string[]=[];
      fetched.forEach((r,i)=>{if(r.status==='fulfilled')incoming.push(...r.value);else errors.push(syncFailure(years[i],r.reason));});
      if(!incoming.length)throw new Error(errors.join('；')||'开奖接口暂时无法连接，当前显示上次有效记录');
      const combined=[...rawCache,...incoming];
      const analysis=analyze(combined);
      const newRaw=Array.from(new Map(combined.map(r=>[r.expect,r])).values());
      const candidate:DashboardState={analysis,source:errors.length?'partial':'live',fetchedAt:chinaNow(),attemptedAt,error:errors.join('；')||null,refreshSeconds:REFRESH_SECONDS};
      if(!env.BUCKET)throw new Error('持久化存储尚未连接，暂时显示历史快照');
      await env.BUCKET.put('zodiac/state-v1.json',JSON.stringify({raw:newRaw,state:candidate}),{httpMetadata:{contentType:'application/json'}});
      rawCache=newRaw;cache=candidate;persisted=true;
    }catch(error){cache={...cache!,attemptedAt,error:error instanceof Error?error.message:'获取失败，显示上次有效记录',source:'snapshot'};}
    return cache!;
  })();
}
export async function readUpdateStatus(){
  const file=await env.BUCKET?.get('zodiac/state-v1.json');
  if(!file)return {persisted:false,error:'尚无已保存的更新'};
  const saved=await file.json<{state:DashboardState}>();
  return {persisted:true,latest:saved.state.analysis.latest,forecastFor:saved.state.analysis.forecastFor,fetchedAt:saved.state.fetchedAt,error:saved.state.error};
}
