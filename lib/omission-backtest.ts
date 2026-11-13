import {summarizeOmissionPerformance,summarizeSevenNumberPerformance} from './omission-performance.ts';
import type {Draw} from './model';
import {createOmissionTracker,type OmissionScope} from './omissions.ts';
import {scoreOmissionStrategy} from './omission-strategy.ts';

export type OmissionBet={issue:string;time:string;trainingThroughIssue:string;trainingThroughTime:string;numbers:number[];scores:number[];ranking?:number[];regularNumbers?:number[];specialNumber:number};
export const OMISSION_TOP10_RULES={stakePerNumber:10,multiplier:47} as const;

export function settleOmissionTop10(input:OmissionBet[]){
  const chronological=[...input].sort((a,b)=>a.time.localeCompare(b.time));
  if(new Set(chronological.map(row=>row.issue)).size!==chronological.length)throw new Error('遗漏回测包含重复期号');
  let stakeCents=0,returnCents=0,hits=0;
  const rows=chronological.map(row=>{
    if(row.numbers.length!==10||new Set(row.numbers).size!==10||row.numbers.some(n=>!Number.isInteger(n)||n<1||n>49))throw new Error('每期必须有10个不同的有效号码');
    if(!Number.isInteger(row.specialNumber)||row.specialNumber<1||row.specialNumber>49)throw new Error('特码号码无效');
    if(row.ranking&&(row.ranking.length!==49||new Set(row.ranking).size!==49||row.ranking.some(n=>!Number.isInteger(n)||n<1||n>49)||row.numbers.some((n,i)=>n!==row.ranking![i])))throw new Error('完整排序必须包含49个号码且前十一致');
    if(row.regularNumbers&&(row.regularNumbers.length!==6||new Set(row.regularNumbers).size!==6||row.regularNumbers.some(n=>!Number.isInteger(n)||n<1||n>49||n===row.specialNumber)))throw new Error('平码记录无效');
    if(row.trainingThroughTime.slice(0,10)>=row.time.slice(0,10))throw new Error('回测预测输入包含当期或未来记录');
    const unit=OMISSION_TOP10_RULES.stakePerNumber;
    const hit=row.numbers.includes(row.specialNumber),stake=unit*100*10,returned=hit?unit*100*OMISSION_TOP10_RULES.multiplier:0;
    stakeCents+=stake;returnCents+=returned;hits+=Number(hit);
    const actualNumbers=[...(row.regularNumbers??[]),row.specialNumber],allHitNumbers=row.numbers.filter(n=>actualNumbers.includes(n));
    return {...row,allHitCount:allHitNumbers.length,allHitNumbers,allNumberRanks:row.ranking&&row.regularNumbers?actualNumbers.map(n=>row.ranking!.indexOf(n)+1):[],specialRank:row.ranking?row.ranking.indexOf(row.specialNumber)+1:null,hit,stakePerNumber:unit,stakeCents:stake,returnCents:returned,profitCents:returned-stake,cumulativeProfitCents:returnCents-stakeCents};
  });
  return {allPerformance:summarizeSevenNumberPerformance(rows.filter(r=>r.regularNumbers)),performance:summarizeOmissionPerformance(rows),rules:OMISSION_TOP10_RULES,summary:{draws:rows.length,betDraws:rows.length,from:rows[0]?.time.slice(0,10)??'',to:rows.at(-1)?.time.slice(0,10)??'',stakeCents,returnCents,profitCents:returnCents-stakeCents,hits,hitRate:rows.length?hits/rows.length:0,roi:stakeCents?(returnCents-stakeCents)/stakeCents:0},rows:rows.reverse()};
}

export function backtestOmissionTop10(rows:Draw[],offsetForDate:(date:string)=>number,scope:OmissionScope='special'){
  const tracker=createOmissionTracker(scope),bets:OmissionBet[]=[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i],date=row.time.slice(0,10);
    if(i>0&&date>='2026-01-01'){
      const prediction=scoreOmissionStrategy(tracker.snapshot(),date,offsetForDate(date),scope);
      // Persist forecast before reading the outcome for settlement.
      const ranking=prediction.ranking.map(candidate=>candidate.number);
      const numbers=prediction.candidates.map(candidate=>candidate.number),scores=prediction.candidates.map(candidate=>candidate.score);
      bets.push({issue:row.issue,time:row.time,trainingThroughIssue:prediction.trainingThroughIssue,trainingThroughTime:prediction.trainingThroughTime,numbers,scores,ranking,regularNumbers:row.numbers.slice(0,6),specialNumber:row.numbers[6]});
    }
    tracker.observe(row);
  }
  return settleOmissionTop10(bets);
}
export type OmissionBacktest=ReturnType<typeof backtestOmissionTop10>;
