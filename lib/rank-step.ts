import {backtestFrequentRankNumbers,type OmissionBet,type RankStepCount} from './omission-backtest.ts';
import {median} from './omission-performance.ts';
import type {OmissionScope} from './omissions.ts';
export function summarizePresence(hits:boolean[]){
 let currentAbsent=0,currentPresent=0,maxAbsent=0,maxPresent=0,last=-1;const gaps:number[]=[];
 for(let i=0;i<hits.length;i++){
  if(hits[i]){if(last>=0)gaps.push(i-last-1);last=i;currentAbsent=0;currentPresent++;maxPresent=Math.max(maxPresent,currentPresent);}
  else{currentAbsent++;currentPresent=0;maxAbsent=Math.max(maxAbsent,currentAbsent);}
 }
 return {periods:hits.length,currentAbsent,maxAbsent,maxPresent,averageGap:gaps.length?gaps.reduce((s,v)=>s+v,0)/gaps.length:null,medianGap:median(gaps),completedIntervals:gaps.length};
}
export function rankStepLedger(rows:OmissionBet[],scope:OmissionScope,count:RankStepCount=10,warmup=100){
 const ledger=backtestFrequentRankNumbers(rows,'miss-streak-step',warmup,count);
 const presence=summarizePresence([...ledger.rows].reverse().map(r=>scope==='all'?r.allSignalHit:r.signalHit));
 return {...ledger,presence};
}
