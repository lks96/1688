import {calendarOffset,ZODIACS} from './model.ts';
export type SettlementRules = {
  singleEnabled:boolean; pairEnabled:boolean; tripleEnabled:boolean;
  singleStake:number; pairStake:number; tripleStake:number;
};
export const DEFAULT_SETTLEMENT_RULES:Readonly<SettlementRules>=Object.freeze({
  singleEnabled:true,pairEnabled:false,tripleEnabled:true,
  singleStake:100,pairStake:100,tripleStake:100,
});
export const SETTLEMENT_MULTIPLIERS=Object.freeze({single:2,specialSingle:1.8,pair:4,specialPair:3.5,triple:10,specialTriple:8.5});
export function specialZodiacForDate(date:string){return ZODIACS[calendarOffset(date.slice(0,10))];}
export function restoreSettlementRules(value:unknown):SettlementRules{
 if(!value||typeof value!=='object')throw new Error('下注设置无效');
 const source=value as Record<string,unknown>;
 const rules=Object.fromEntries(Object.keys(DEFAULT_SETTLEMENT_RULES).map(key=>[key,source[key]])) as SettlementRules;
 validateSettlementRules(rules);return rules;
}
export type SettlementInput={issue:string;time:string;candidates:string[];actualAnimals:string[]};
export type PairSettlement={zodiacs:string[];hit:boolean;stakeCents:number;returnCents:number};
export type DrawSettlement={
  specialZodiac:string;hitZodiacs:string[];tripleHit:boolean;pairBets:PairSettlement[];
  singleStakeCents:number;pairStakeCents:number;tripleStakeCents:number;
  singleReturnCents:number;pairReturnCents:number;tripleReturnCents:number;
  stakeCents:number;returnCents:number;profitCents:number;
};
export function validateSettlementRules(rules:SettlementRules):void{
  for(const key of Object.keys(DEFAULT_SETTLEMENT_RULES) as (keyof SettlementRules)[]){
    const value=rules[key];
    if(key.endsWith('Enabled')){if(typeof value!=='boolean')throw new Error('下注开关无效');continue;}
    const max=key.endsWith('Stake')?1000000:1000;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max||Math.abs(value*100-Math.round(value*100))>1e-7)throw new Error('金额无效，请输入范围内最多两位小数的非负数。');
  }
}
function settleValidated(row:SettlementInput,rules:SettlementRules):DrawSettlement{
  if(row.candidates.length!==3||new Set(row.candidates).size!==3||row.actualAnimals.length!==7)throw new Error(`${row.issue}期结算记录不完整`);
  const specialZodiac=specialZodiacForDate(row.time);
  const actual=new Set(row.actualAnimals),hitZodiacs=row.candidates.filter(z=>actual.has(z));
  const singleUnit=rules.singleEnabled?Math.round(rules.singleStake*100):0;
  const pairUnit=rules.pairEnabled?Math.round(rules.pairStake*100):0;
  const tripleStakeCents=rules.tripleEnabled?Math.round(rules.tripleStake*100):0;
  const payout=(stake:number,multiplier:number)=>Math.round(stake*Math.round(multiplier*100)/100);
  const singleReturnCents=hitZodiacs.reduce((sum,z)=>sum+payout(singleUnit,z===specialZodiac?SETTLEMENT_MULTIPLIERS.specialSingle:SETTLEMENT_MULTIPLIERS.single),0);
  const pairBets:PairSettlement[]=rules.pairEnabled?[[0,1],[0,2],[1,2]].map(indices=>{
    const zodiacs=indices.map(i=>row.candidates[i]),hit=zodiacs.every(z=>actual.has(z));
    return {zodiacs,hit,stakeCents:pairUnit,returnCents:hit?payout(pairUnit,zodiacs.includes(specialZodiac)?SETTLEMENT_MULTIPLIERS.specialPair:SETTLEMENT_MULTIPLIERS.pair):0};
  }):[];
  const singleStakeCents=3*singleUnit,pairStakeCents=3*pairUnit;
  const pairReturnCents=pairBets.reduce((sum,pair)=>sum+pair.returnCents,0);
  const tripleHit=hitZodiacs.length===3;
  const tripleReturnCents=tripleHit?payout(tripleStakeCents,row.candidates.includes(specialZodiac)?SETTLEMENT_MULTIPLIERS.specialTriple:SETTLEMENT_MULTIPLIERS.triple):0;
  const stakeCents=singleStakeCents+pairStakeCents+tripleStakeCents,returnCents=singleReturnCents+pairReturnCents+tripleReturnCents;
  return {specialZodiac,hitZodiacs,tripleHit,pairBets,singleStakeCents,pairStakeCents,tripleStakeCents,singleReturnCents,pairReturnCents,tripleReturnCents,stakeCents,returnCents,profitCents:returnCents-stakeCents};
}
export function settleDraw(row:SettlementInput,rules:SettlementRules=DEFAULT_SETTLEMENT_RULES):DrawSettlement{validateSettlementRules(rules);return settleValidated(row,rules);}
export function settleBacktest<T extends SettlementInput>(input:T[],rules:SettlementRules=DEFAULT_SETTLEMENT_RULES){
 validateSettlementRules(rules);
 const chronological=[...input].filter(row=>row.time.slice(0,10)>='2026-01-01').sort((a,b)=>a.time.localeCompare(b.time)||a.issue.localeCompare(b.issue));
 if(new Set(chronological.map(row=>row.issue)).size!==chronological.length)throw new Error('结算包含重复期号');
 let cumulativeProfitCents=0;
 const rows=chronological.map(row=>{const s=settleValidated(row,rules);cumulativeProfitCents+=s.profitCents;return {...row,...s,cumulativeProfitCents};});
 const sum=(key:'singleStakeCents'|'pairStakeCents'|'tripleStakeCents'|'singleReturnCents'|'pairReturnCents'|'tripleReturnCents')=>rows.reduce((n,row)=>n+row[key],0);
 const singleStakeCents=sum('singleStakeCents'),pairStakeCents=sum('pairStakeCents'),tripleStakeCents=sum('tripleStakeCents');
 const singleReturnCents=sum('singleReturnCents'),pairReturnCents=sum('pairReturnCents'),tripleReturnCents=sum('tripleReturnCents');
 const stakeCents=singleStakeCents+pairStakeCents+tripleStakeCents,returnCents=singleReturnCents+pairReturnCents+tripleReturnCents;
 const summary={draws:rows.length,from:chronological[0]?.time.slice(0,10)??'',to:chronological.at(-1)?.time.slice(0,10)??'',
 singleStakeCents,pairStakeCents,tripleStakeCents,singleReturnCents,pairReturnCents,tripleReturnCents,
 singleProfitCents:singleReturnCents-singleStakeCents,pairProfitCents:pairReturnCents-pairStakeCents,tripleProfitCents:tripleReturnCents-tripleStakeCents,
 stakeCents,returnCents,profitCents:returnCents-stakeCents,roi:stakeCents?(returnCents-stakeCents)/stakeCents:0,
 pairHits:rows.reduce((n,row)=>n+row.pairBets.filter(p=>p.hit).length,0),tripleHits:rules.tripleEnabled?rows.filter(row=>row.tripleHit).length:0};
 return {rules:restoreSettlementRules(rules),summary,rows:rows.reverse()};
}
export type SettledPerformance=SettlementInput&DrawSettlement&{cumulativeProfitCents:number};
