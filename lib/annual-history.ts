import {chinaNow,type RawDraw} from './model.ts';
import {prepareLongHistory,replayLongHistory,type YearHistory,type LongHistoryResult} from './long-history.ts';
import {backtestFrequentRankNumbers,type FrequentRankBetPlan,type RankStepCount} from './omission-backtest.ts';
import type {OmissionScope} from './omissions.ts';
export const ANNUAL_BET_WARMUP=99; // First draw initializes omissions; the next 99 complete the 100-draw warmup.
export type AnnualYear={year:string;draws:number;from:string|null;to:string|null;scopes:LongHistoryResult['scopes'];forecasts:LongHistoryResult['forecasts']|null};
export function replayAnnualHistory(input:YearHistory,cutoff=chinaNow()){
 const {rows,audit}=prepareLongHistory(input,cutoff);
 const activeYear=cutoff.slice(0,4),lastYear=Number(activeYear);
 const years:AnnualYear[]=Array.from({length:lastYear-2020},(_,i)=>String(2021+i)).map(year=>{
  const own=rows.filter(r=>r.time.startsWith(year));
  if(own.length<2)return {year,draws:own.length,from:own[0]?.time??null,to:own.at(-1)?.time??null,scopes:{special:[],all:[]},forecasts:null};
  const raw:RawDraw[]=own.map(r=>({expect:r.issue,openTime:r.time,openCode:r.numbers.join(','),zodiac:r.animals.join(',')}));
  // A fresh replay creates a separate omission tracker and frequency table for this year.
  const replay=replayLongHistory({[year]:raw},cutoff);
  const forecastYear=replay.forecasts.special.forecastFor.slice(0,4);
  return {year,draws:own.length,from:own[0].time,to:own.at(-1)!.time,scopes:replay.scopes,forecasts:forecastYear===year?replay.forecasts:null};
 });
 return {years,audit,activeYear,cutoff};
}
export function annualPlanComparison(years:AnnualYear[],scope:OmissionScope,plan:FrequentRankBetPlan,count:RankStepCount=10){
 const annual=years.map(y=>({year:y.year,historyDraws:y.draws,...backtestFrequentRankNumbers(y.scopes[scope],plan,ANNUAL_BET_WARMUP,count).summary}));
 const stakeCents=annual.reduce((n,y)=>n+y.stakeCents,0),returnCents=annual.reduce((n,y)=>n+y.returnCents,0);
 const max=annual.reduce<typeof annual[number]|null>((best,y)=>y.maxStakeCents>0&&(!best||y.maxStakeCents>best.maxStakeCents)?y:best,null);
 return {scope,plan,count,annual,stakeCents,returnCents,profitCents:returnCents-stakeCents,roi:stakeCents?(returnCents-stakeCents)/stakeCents:0,
  betDraws:annual.reduce((n,y)=>n+y.betDraws,0),maxStakeCents:max?.maxStakeCents??0,maxStakeIssue:max?.maxStakeIssue??null};
}
export type AnnualHistoryResult=ReturnType<typeof replayAnnualHistory>;
