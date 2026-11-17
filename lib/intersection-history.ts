import type {LongHistoryResult} from './long-history.ts';
import type {AnnualHistoryResult} from './annual-history.ts';
import type {OmissionBet} from './omission-backtest.ts';
import type {OmissionScope} from './omissions.ts';
export type IntersectionCandidate={number:number;longRank:number;annualRank:number};
export type IntersectionInput={issue:string;time:string;longNumbers:number[];annualNumbers:number[];candidates:IntersectionCandidate[];specialNumber:number;regularNumbers:number[];trainingThroughIssue:string;trainingThroughTime:string};
export function intersectTop10(long:OmissionBet,annual:OmissionBet){
 if(!long.ranking||!annual.ranking||long.frequencyRanks?.length!==10||annual.frequencyRanks?.length!==10)throw new Error('交集需要两套完整的前10码预测');
 const longPicks=long.frequencyRanks.map(rank=>({number:long.ranking![rank-1],rank}));
 const annualPicks=annual.frequencyRanks.map(rank=>({number:annual.ranking![rank-1],rank}));
 return {longNumbers:longPicks.map(c=>c.number),annualNumbers:annualPicks.map(c=>c.number),candidates:longPicks.flatMap(c=>{const other=annualPicks.find(a=>a.number===c.number);return other?[{number:c.number,longRank:c.rank,annualRank:other.rank}]:[];})};
}
export function settleIntersectionHistory(input:IntersectionInput[]){
 const chronological=[...input].sort((a,b)=>a.time.localeCompare(b.time)||a.issue.localeCompare(b.issue));
 if(new Set(chronological.map(r=>r.issue)).size!==chronological.length)throw new Error('交集账本出现重复期号');
 let unitCents=1000,stakeCents=0,returnCents=0,betDraws=0,hits=0,betNumbers=0,maxStakeCents=0,maxStakeIssue:string|null=null;
 const rows=chronological.map(row=>{
  if(row.trainingThroughTime>=row.time)throw new Error('交集预测包含当期或未来记录');
  const numbers=row.candidates.map(c=>c.number);
  const expected=row.longNumbers.filter(n=>row.annualNumbers.includes(n));
  if(row.longNumbers.length!==10||row.annualNumbers.length!==10||new Set(row.longNumbers).size!==10||new Set(row.annualNumbers).size!==10||new Set(numbers).size!==numbers.length||numbers.length!==expected.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>49||!expected.includes(n)))throw new Error('交集号码异常');
  const bought=numbers.length>0,hit=bought&&numbers.includes(row.specialNumber),stakePerNumberCents=bought?unitCents:0;
  const stake=stakePerNumberCents*numbers.length,returned=hit?unitCents*47:0;
  stakeCents+=stake;returnCents+=returned;betDraws+=Number(bought);hits+=Number(hit);betNumbers+=numbers.length;
  if(stake>maxStakeCents){maxStakeCents=stake;maxStakeIssue=row.issue;}
  if(bought)unitCents=hit?1000:unitCents+1000;
  return {...row,bought,hit,signalHit:hit,stakePerNumberCents,stakeCents:stake,returnCents:returned,profitCents:returned-stake,cumulativeProfitCents:returnCents-stakeCents,nextUnitCents:unitCents};
 });
 return {summary:{draws:rows.length,betDraws,emptyDraws:rows.length-betDraws,hits,betNumbers,meanIntersection:rows.length?betNumbers/rows.length:0,stakeCents,returnCents,profitCents:returnCents-stakeCents,roi:stakeCents?(returnCents-stakeCents)/stakeCents:0,maxStakeCents,maxStakeIssue,from:rows[0]?.time.slice(0,10)??'',to:rows.at(-1)?.time.slice(0,10)??''},nextUnitCents:unitCents,rows:rows.reverse()};
}
export function buildIntersectionHistory(long:LongHistoryResult,annual:AnnualHistoryResult){
 const forScope=(scope:OmissionScope)=>{
  const annualRows=new Map<string,{row:OmissionBet;ready:boolean}>();
  for(const y of annual.years)y.scopes[scope].forEach((row,i)=>annualRows.set(row.issue,{row,ready:i>=99}));
  const inputs:IntersectionInput[]=[];
  long.scopes[scope].forEach((row,i)=>{
   const yearly=annualRows.get(row.issue);
   if(i<100||!yearly?.ready)return;
   if(yearly.row.trainingThroughTime>=row.time)throw new Error('年内预测包含当期或未来记录');
   if(row.time!==yearly.row.time||row.specialNumber!==yearly.row.specialNumber||JSON.stringify(row.regularNumbers)!==JSON.stringify(yearly.row.regularNumbers))throw new Error('两套回测的开奖记录不一致');
   inputs.push({issue:row.issue,time:row.time,...intersectTop10(row,yearly.row),specialNumber:row.specialNumber,regularNumbers:row.regularNumbers??[],trainingThroughIssue:row.trainingThroughIssue,trainingThroughTime:row.trainingThroughTime});
  });
  const ledger=settleIntersectionHistory(inputs),forecast=long.forecasts[scope];
  const year=annual.years.find(y=>y.year===forecast.forecastFor.slice(0,4));
  const yearly=year?.forecasts?.[scope];
  const ready=long.scopes[scope].length>=100&&!!year&&year.draws>=100&&!!yearly&&yearly.forecastFor===forecast.forecastFor;
  const longNumbers=forecast.candidates.map(c=>c.number),annualNumbers=yearly?.candidates.map(c=>c.number)??[];
  const candidates=ready?forecast.candidates.flatMap(c=>{const a=yearly!.candidates.find(a=>a.number===c.number);return a?[{number:c.number,longRank:c.rank,annualRank:a.rank}]:[];}):[];
  return {...ledger,forecast:{forecastFor:forecast.forecastFor,trainingThroughIssue:forecast.trainingThroughIssue,trainingThroughTime:forecast.trainingThroughTime,ready,bought:ready&&candidates.length>0,longNumbers,annualNumbers,candidates,stakePerNumberCents:ready&&candidates.length?ledger.nextUnitCents:0,stakeCents:ready?ledger.nextUnitCents*candidates.length:0,warmupRemaining:Math.max(0,100-(year?.draws??0))}};
 };
 return {audit:long.audit,cutoff:long.cutoff,scopes:{special:forScope('special'),all:forScope('all')}};
}
export type IntersectionHistoryResult=ReturnType<typeof buildIntersectionHistory>;
