import {buildOmissions} from './omissions.ts';
import {scoreOmissionStrategy} from './omission-strategy.ts';
import {backtestOmissionTop10} from './omission-backtest.ts';
export type RawDraw = { expect: string; openTime: string; openCode: string; zodiac: string };
export type Draw = { issue: string; time: string; numbers: number[]; animals: string[]; offset: number; y: number[]; counts: number[]; base: number[] };
export type Metrics = { draws: number; brier: number; meanHits: number; anyHit: number; allHit: number };
export const ZODIACS = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
export const METHODS = [
  {id:'rotation',label:'动态轮换',name:'3 / 7 / 14期走势＋轮换约束',description:'平码动态轮换',target:'regular'},
] as const;
export type MethodId = typeof METHODS[number]['id'];
export type ModelName = MethodId;
export const MODELS = ['rotation'] as const;
export const MODEL_VERSION = '2026-11-04-rotation-only-v5';
const normalize = (z: string) => z.replaceAll('龍','龙').replaceAll('馬','马').replaceAll('雞','鸡').replaceAll('豬','猪');
const mean = (a: number[]) => a.reduce((s,v)=>s+v,0)/a.length;
const choose = (n:number,r:number) => { if(n<r)return 0; let v=1;for(let i=1;i<=r;i++)v=v*(n-i+1)/i;return v; };
export function baseProbabilities(offset: number): number[] {
  return ZODIACS.map((_,z)=>1-choose(49-(z===offset?5:4),7)/choose(49,7));
}
export function chinaNow(): string { return new Date(Date.now()+8*3600000).toISOString().slice(0,19).replace('T',' '); }
// Published lunar-year boundaries, known before any draw. Pin supported history
// and the next year because ICU currently starts lunar 2027 one day too late.
// Source: https://www.hko.gov.hk/tc/gts/time/calendar/pdf/files/2027.pdf
const zodiacYearStarts:Record<number,string>={2025:'2025-01-29',2026:'2026-02-17',2027:'2027-02-06'};
const zodiacCalendar = new Intl.DateTimeFormat('en-u-ca-chinese',{year:'numeric',timeZone:'Asia/Shanghai'});
// Calendar metadata is available before a draw; never derive it from its outcome.
export function calendarOffset(date:string):number {
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(date))throw new Error('预测日期格式异常');
  const civilYear=Number(date.slice(0,4)),publishedStart=zodiacYearStarts[civilYear];
  if(publishedStart)return (civilYear-(date<publishedStart?1:0)-2020+120)%12;
  const year=zodiacCalendar.formatToParts(new Date(date+'T12:00:00+08:00')).find(p=>String(p.type)==='relatedYear');
  if(!year)throw new Error('无法确定日期的生肖映射，停止预测');
  return (Number(year.value)-2020+120)%12;
}
function nextDay(time:string):string {
  const date=new Date(time.slice(0,10)+'T12:00:00+08:00');
  date.setUTCDate(date.getUTCDate()+1);
  return date.toISOString().slice(0,10);
}
export function cleanDraws(raw: RawDraw[], cutoff=chinaNow()) {
  const found=new Map<string,Draw>();let duplicates=0,future=0;
  for(const r of raw){
    if(!r || !/^20\d{2}\d{3}$/.test(String(r.expect)) || !/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.openTime))throw new Error('开奖期号或时间格式异常');
    if(r.openTime>cutoff){future++;continue;}
    const numbers=r.openCode.split(',').map(Number),animals=r.zodiac.split(',').map(normalize);
    if(numbers.length!==7||new Set(numbers).size!==7||numbers.some(n=>!Number.isInteger(n)||n<1||n>49)||animals.length!==7||animals.some(z=>!ZODIACS.includes(z)))throw new Error(`${r.expect}期号码或生肖异常`);
    const offsets=numbers.map((n,i)=>(ZODIACS.indexOf(animals[i])+n-1)%12);
    if(new Set(offsets).size!==1)throw new Error(`${r.expect}期号码与生肖对应矛盾`);
    const offset=offsets[0],counts=ZODIACS.map(z=>animals.filter(a=>a===z).length);
    const draw:Draw={issue:String(r.expect),time:r.openTime,numbers,animals,offset,counts,y:counts.map(n=>Number(n>0)),base:baseProbabilities(offset)};
    const previous=found.get(draw.issue);
    if(previous){if(JSON.stringify(previous)!==JSON.stringify(draw))throw new Error(`${draw.issue}期存在冲突记录`);duplicates++;}else found.set(draw.issue,draw);
  }
  const rows=[...found.values()].sort((a,b)=>a.time.localeCompare(b.time));
  if(new Set(rows.map(r=>r.time)).size!==rows.length)throw new Error('相同开奖时间存在不同期号');
  return {rows,audit:{rawRows:raw.length,duplicates,future,usableRows:rows.length}};
}
function top3(p:number[]){return p.map((v,i)=>({v,i})).sort((a,b)=>Math.round(b.v*1e12)-Math.round(a.v*1e12)||a.i-b.i).slice(0,3).map(a=>a.i);}
const sameSet=(a:number[],b:number[])=>a.length===b.length&&a.every(z=>b.includes(z));
// Fixed before inspecting backtest results. These are selection constraints, not
// assumptions that an animal becomes less likely to be drawn after selection.
export function selectRotation(probabilities:number[],history:number[][]){
  const previous=history.at(-1)??[],beforePrevious=history.at(-2)??[];
  const recent=history.slice(-5);
  const scores=probabilities.map((p,z)=>Math.max(0,Math.min(100,100*p-2*recent.filter(s=>s.includes(z)).length)));
  const blocked=previous.filter(z=>beforePrevious.includes(z));
  let selected:number[]=[];let best=-Infinity;
  for(let a=0;a<10;a++)for(let b=a+1;b<11;b++)for(let c=b+1;c<12;c++){
    const group=[a,b,c];
    if(group.some(z=>blocked.includes(z))||group.filter(z=>previous.includes(z)).length>1||history.slice(-7).some(s=>sameSet(s,group)))continue;
    const value=group.reduce((sum,z)=>sum+scores[z],0);
    if(Math.round(value*1e10)>Math.round(best*1e10)){best=value;selected=group;}
  }
  if(selected.length!==3)throw new Error('无法生成满足轮换规则的候选');
  selected.sort((a,b)=>Math.round(scores[b]*1e10)-Math.round(scores[a]*1e10)||a-b);
  return {selected,scores,blocked,previous,added:selected.filter(z=>!previous.includes(z)),removed:previous.filter(z=>!selected.includes(z))};
}
function blank(){return {draws:0,brier:0,meanHits:0,anyHit:0,allHit:0};}
function update(m:Metrics,p:number[],row:Draw,selected=top3(p)){const hit=selected.reduce((s,z)=>s+row.y[z],0);m.draws++;m.brier+=mean(p.map((v,z)=>(v-row.y[z])**2));m.meanHits+=hit;m.anyHit+=Number(hit>0);m.allHit+=Number(hit===3);}
function finish(m:Metrics):Metrics {const n=m.draws;return {draws:n,brier:m.brier/n,meanHits:m.meanHits/n,anyHit:m.anyHit/n,allHit:m.allHit/n};}
function replayDraws(rows:Draw[]){
  const history:Draw[]=[],prefix:number[][]=[Array(12).fill(0)],rotationHistory:number[][]=[];
  let currentRotation:ReturnType<typeof selectRotation>;
  const validation={rotation:blank()},test={rotation:blank()};
  const testPredictions:{row:Draw;predictions:Record<MethodId,number[]>;rotationSelection:number[];trainingThroughIssue:string;trainingThroughTime:string;trainingDraws:number}[]=[];
  function makePredictions(targetDate:string):Record<MethodId,number[]>{
    const t=history.length;
    if(history.at(-1)&&history.at(-1)!.time.slice(0,10)>=targetDate)throw new Error('预测输入包含当期或之后的数据');
    const base=baseProbabilities(calendarOffset(targetDate));
    const short=(n:number,strength:number)=>{const start=Math.max(0,t-n);return base.map((b,z)=>Math.min(.999999,Math.max(.000001,b+(prefix[t][z]-prefix[start][z])/(strength+t-start))));};
    const p3=short(3,6),p7=short(7,12),p14=short(14,20);
    const rotation=base.map((_,z)=>.5*p3[z]+.3*p7[z]+.2*p14[z]);
    currentRotation=selectRotation(rotation,rotationHistory);
    return {rotation};
  }
  for(let t=0;t<rows.length;t++){
    const row=rows[t];
    if(t>=90){
      const predictions=makePredictions(row.time.slice(0,10)),rotationSelection=[...currentRotation!.selected];
      const bucket=row.time.startsWith('2025')?validation:test;
      update(bucket.rotation,predictions.rotation,row,rotationSelection);
      if(row.time.slice(0,4)>='2026')testPredictions.push({row,predictions,rotationSelection,trainingThroughIssue:history[t-1].issue,trainingThroughTime:history[t-1].time,trainingDraws:t});
      rotationHistory.push(rotationSelection);
    }
    history.push(row);
    prefix.push(prefix.at(-1)!.map((s,z)=>s+(row.y[z]-row.base[z])));
  }
  return {validation,test,testPredictions,makePredictions,rotation:()=>currentRotation};
}
export function forecastFromHistory(raw:RawDraw[],targetDate:string,cutoff=chinaNow()){
  const {rows}=cleanDraws(raw,cutoff);
  if(rows.length<90)throw new Error('有效记录不足90期');
  if(rows.at(-1)!.time.slice(0,10)>=targetDate)throw new Error('预测输入包含当期或之后的数据');
  const replay=replayDraws(rows),predictions=replay.makePredictions(targetDate),rotation=replay.rotation();
  return {modelVersion:MODEL_VERSION,targetDate,trainingThroughIssue:rows.at(-1)!.issue,trainingThroughTime:rows.at(-1)!.time,trainingDraws:rows.length,
    methods:{rotation:{candidates:rotation.selected.map(z=>ZODIACS[z]),predictionScores:predictions.rotation}}};
}
export function analyze(raw:RawDraw[],cutoff=chinaNow()){
  const {rows,audit}=cleanDraws(raw,cutoff);
  if(rows.length<180)throw new Error('有效记录不足180期');
  const replay=replayDraws(rows),{validation,test,testPredictions}=replay;
  if(!validation.rotation.draws||!test.rotation.draws)throw new Error('缺少2025年验证或2026年起测试记录');
  for(const id of MODELS){validation[id]=finish(validation[id]);test[id]=finish(test[id]);}
  const latest=rows.at(-1)!,forecastFor=nextDay(latest.time),forecastOffset=calendarOffset(forecastFor);
  const predictions=replay.makePredictions(forecastFor),currentRotation=replay.rotation();
  const rank=(id:MethodId)=>{
    const values=predictions[id],base=baseProbabilities(forecastOffset);
    return values.map((score,z)=>({zodiac:ZODIACS[z],score,strategyScore:currentRotation.scores[z],
      selected:currentRotation.selected.includes(z),base:base[z],
      last30:rows.slice(-30).reduce((s,r)=>s+r.y[z],0),
      last30Count:rows.slice(-30).reduce((s,r)=>s+r.counts[z],0),
      last90:rows.slice(-90).reduce((s,r)=>s+r.y[z],0),
      numbers:Array.from({length:49},(_,i)=>i+1).filter(n=>(forecastOffset-n+121)%12===z)
    })).sort((a,b)=>Number(b.selected)-Number(a.selected)||Math.round(b.strategyScore*1e10)-Math.round(a.strategyScore*1e10)||ZODIACS.indexOf(a.zodiac)-ZODIACS.indexOf(b.zodiac));
  };
  const reference={draws:testPredictions.length,brier:0,meanHits:0,anyHit:0,allHit:0};
  for(const {row} of testPredictions){
    const h=row.y[row.offset],k=row.y.reduce((s,y)=>s+y,0)-h;
    reference.meanHits+=h+2*k/11;reference.anyHit+=h?1:1-choose(11-k,2)/55;reference.allHit+=h*choose(k,2)/55;
    reference.brier+=mean(row.base.map((p,z)=>(p-row.y[z])**2));
  }
  for(const key of ['meanHits','anyHit','allHit','brier'] as const)reference[key]/=reference.draws;
  const variants=Object.fromEntries(METHODS.map(method=>{
    const id=method.id,ranking=rank(id);
    const fullPerformance=testPredictions.map(({row,predictions,rotationSelection,trainingThroughIssue,trainingThroughTime,trainingDraws})=>{
      const selected=rotationSelection;
      const hits=selected.reduce((s,z)=>s+row.y[z],0);
      return {issue:row.issue,time:row.time,candidates:selected.map(z=>ZODIACS[z]),hits,actualAnimals:[...row.animals],actualNumbers:[...row.numbers],trainingThroughIssue,trainingThroughTime,trainingDraws,predictionScores:predictions[id]};
    });
    const key=(c:string[])=>[...c].sort().join(',');let changes=0;
    for(let i=1;i<fullPerformance.length;i++)if(key(fullPerformance[i].candidates)!==key(fullPerformance[i-1].candidates))changes++;
    const last=fullPerformance.slice(-30);
    return [id,{...method,ranking,candidates:ranking.slice(0,3),metric:test[id],development:validation[id],performance:fullPerformance.reverse(),recentMeanHits:mean(last.map(r=>r.hits)),
      recentReference:reference.meanHits,recentHitCount:last.reduce((s,r)=>s+r.hits,0),setChangeRate:changes/Math.max(1,fullPerformance.length-1),
      sameAsPrevious:key(ranking.slice(0,3).map(r=>r.zodiac))===key(last.at(-1)!.candidates),historicalOnly:true}];
  })) as Record<MethodId,{id:MethodId;label:string;name:string;description:string;target:'regular';ranking:ReturnType<typeof rank>;candidates:ReturnType<typeof rank>;metric:Metrics;development:Metrics;performance:{issue:string;time:string;candidates:string[];hits:number;actualAnimals:string[];actualNumbers:number[];trainingThroughIssue:string;trainingThroughTime:string;trainingDraws:number;predictionScores:number[]}[];recentMeanHits:number;recentReference:number;recentHitCount:number;setChangeRate:number;sameAsPrevious:boolean;historicalOnly:boolean}>;
  const rotationPolicy={minimumReplacements:2,maximumConsecutiveSelections:2,noRepeatWithin:7,scoreKind:'selection_score_not_probability',previous:currentRotation.previous.map(z=>ZODIACS[z]),added:currentRotation.added.map(z=>ZODIACS[z]),removed:currentRotation.removed.map(z=>ZODIACS[z]),blocked:currentRotation.blocked.map(z=>ZODIACS[z]),note:''};
  const normal=variants.rotation;
  const omissions=buildOmissions(rows);
  const omissionStrategy=scoreOmissionStrategy(omissions,forecastFor,forecastOffset);
  const omissionBacktest=backtestOmissionTop10(rows,calendarOffset);
  const omissionModes={special:{strategy:omissionStrategy,backtest:omissionBacktest},all:{strategy:scoreOmissionStrategy(omissions,forecastFor,forecastOffset,'all'),backtest:backtestOmissionTop10(rows,calendarOffset,'all')}};
  return {omissions,omissionStrategy,omissionBacktest,omissionModes,modelVersion:MODEL_VERSION,variants,rotationPolicy,research:{status:'exploratory_reused_history',independentValidation:false,preDrawArchive:false,note:''},
    backtestProtocol:{inputBoundary:'strictly_before_target_date',mappingSource:'calendar_date_only',updateOrder:'forecast_then_score_then_observe',recordType:'retrospective_simulation'},
    backtestRange:{from:testPredictions[0].row.time.slice(0,10),to:testPredictions.at(-1)!.row.time.slice(0,10),draws:testPredictions.length},audit,first:rows[0].time,
    latest:{issue:latest.issue,time:latest.time,numbers:latest.numbers,animals:latest.animals},forecastFor,ranking:normal.ranking,candidates:normal.candidates,model:'rotation' as MethodId,
    validation,test,reference,references:{rotation:reference},hasAdvantage:false,recentHitCount:normal.recentHitCount,
    recentDraws:rows.slice(-30).reverse().map(r=>({issue:r.issue,time:r.time,numbers:r.numbers,animals:r.animals})),performance:normal.performance,cutoff};
}
export type Analysis=ReturnType<typeof analyze>;
