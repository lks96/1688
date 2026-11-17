import {summarizeOmissionPerformance,summarizeSevenNumberPerformance} from './omission-performance.ts';
import type {Draw} from './model';
import {createOmissionTracker,type OmissionScope} from './omissions.ts';
import {scoreOmissionStrategy} from './omission-strategy.ts';

export type OmissionBet={issue:string;time:string;trainingThroughIssue:string;trainingThroughTime:string;numbers:number[];scores:number[];ranking?:number[];frequencyRanks?:number[];regularNumbers?:number[];specialNumber:number};
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
  const tracker=createOmissionTracker(scope),bets:OmissionBet[]=[],rankCounts=Array(49).fill(0) as number[];
  for(let i=0;i<rows.length;i++){
    const row=rows[i],date=row.time.slice(0,10);
    if(i>0&&date>='2026-01-01'){
      const prediction=scoreOmissionStrategy(tracker.snapshot(),date,offsetForDate(date),scope);
      // Persist forecast before reading the outcome for settlement.
      const ranking=prediction.ranking.map(candidate=>candidate.number);
      const frequencyRanks=rankCounts.map((count,index)=>({rank:index+1,count})).sort((a,b)=>b.count-a.count||a.rank-b.rank).slice(0,10).map(item=>item.rank);
      const numbers=prediction.candidates.map(candidate=>candidate.number),scores=prediction.candidates.map(candidate=>candidate.score);
      bets.push({issue:row.issue,time:row.time,trainingThroughIssue:prediction.trainingThroughIssue,trainingThroughTime:prediction.trainingThroughTime,numbers,scores,ranking,frequencyRanks,regularNumbers:row.numbers.slice(0,6),specialNumber:row.numbers[6]});
      const observedNumbers=scope==='all'?row.numbers:[row.numbers[6]];
      for(const number of observedNumbers){const rank=ranking.indexOf(number);if(rank>=0)rankCounts[rank]++;}
    }
    tracker.observe(row);
  }
  return settleOmissionTop10(bets);
}
export type OmissionBacktest=ReturnType<typeof backtestOmissionTop10>;

export type FrequentRankBetPlan='alternate-fixed'|'miss-streak-step'|'every-period-fixed';
export const FREQUENT_RANK_WARMUP_PERIODS=100;
export const RANK_STEP_MODES=[{count:4,missThreshold:6,label:'前4码'},{count:6,missThreshold:4,label:'前6码'},{count:10,missThreshold:3,label:'前10码'}] as const;
export type RankStepCount=typeof RANK_STEP_MODES[number]['count'];
function frequentRankUnit(plan:FrequentRankBetPlan,index:number,missStreak:number,pause=false,missThreshold=3){
 return plan==='every-period-fixed'?OMISSION_TOP10_RULES.stakePerNumber
  :plan==='alternate-fixed'?(pause?0:OMISSION_TOP10_RULES.stakePerNumber)
  :index===0||missStreak===0||missStreak>=missThreshold?OMISSION_TOP10_RULES.stakePerNumber*Math.max(1,missStreak-missThreshold+1):0;
}
export function backtestFrequentRankNumbers(input:OmissionBet[],plan:FrequentRankBetPlan='alternate-fixed',warmupPeriods=FREQUENT_RANK_WARMUP_PERIODS,candidateCount:RankStepCount=10){
 const mode=RANK_STEP_MODES.find(m=>m.count===candidateCount);if(!mode)throw new Error('号码档位无效');
 if(!Number.isInteger(warmupPeriods)||warmupPeriods<0)throw new Error('数据积累期数无效');
 const chronological=[...input].sort((a,b)=>a.time.localeCompare(b.time)||a.issue.localeCompare(b.issue));
 // Dynamic ranks have already observed these periods; only the betting ledger starts here.
 const bettingPeriods=chronological.slice(warmupPeriods);
 let missStreak=0,stakeCents=0,returnCents=0,hits=0,betDraws=0,betCount=0,cumulativeProfitCents=0,consecutiveBets=0,pause=false;
 const rows=bettingPeriods.map((row,index)=>{
  if(!row.ranking||row.ranking.length!==49)throw new Error(`${row.issue}期缺少49码完整评分排序`);
  const frequencyRanks=row.frequencyRanks;
  const selectedRanks=frequencyRanks?.slice(0,candidateCount);
  if(!frequencyRanks||frequencyRanks.length!==10||!selectedRanks||selectedRanks.length!==candidateCount||new Set(selectedRanks).size!==candidateCount||selectedRanks.some(rank=>!Number.isInteger(rank)||rank<1||rank>49))throw new Error(`${row.issue}期缺少动态频率名次`);
  const signalHit=selectedRanks.some(rank=>row.ranking![rank-1]===row.specialNumber);
  const stakePerNumber=frequentRankUnit(plan,index,missStreak,pause,mode.missThreshold);
  if(plan==='alternate-fixed'){
   if(stakePerNumber>0){consecutiveBets++;pause=signalHit||consecutiveBets>=2;}
   else{pause=false;consecutiveBets=0;}
  }
  const candidates=selectedRanks.map(rank=>{
   const number=row.ranking![rank-1],hit=number===row.specialNumber,bought=stakePerNumber>0;
   return {rank,number,stakeCents:bought?stakePerNumber*100:0,bought,hit:bought&&hit};
  });
  const allSignalHit=candidates.some(candidate=>[...(row.regularNumbers??[]),row.specialNumber].includes(candidate.number));
  missStreak=signalHit?0:missStreak+1;
  const purchased=candidates.filter(candidate=>candidate.bought),hitCandidates=purchased.filter(candidate=>candidate.hit);
  const rowStakeCents=purchased.reduce((sum,candidate)=>sum+candidate.stakeCents,0),rowReturnCents=hitCandidates.reduce((sum,candidate)=>sum+candidate.stakeCents*OMISSION_TOP10_RULES.multiplier,0),rowProfitCents=rowReturnCents-rowStakeCents;
  stakeCents+=rowStakeCents;returnCents+=rowReturnCents;hits+=Number(hitCandidates.length>0);betDraws+=Number(purchased.length>0);betCount+=purchased.length;cumulativeProfitCents+=rowProfitCents;
  return {...row,candidates,bought:purchased.length>0,signalHit,allSignalHit,hitNumbers:hitCandidates.map(candidate=>candidate.number),hit:hitCandidates.length>0,stakeCents:rowStakeCents,returnCents:rowReturnCents,profitCents:rowProfitCents,cumulativeProfitCents};
 });
 const maximumStake=rows.reduce<typeof rows[number]|null>((best,row)=>row.stakeCents>0&&(!best||row.stakeCents>best.stakeCents)?row:best,null);
 const summary={draws:rows.length,warmupDraws:Math.min(chronological.length,warmupPeriods),totalDraws:chronological.length,betDraws,betCount,hits,stakeCents,returnCents,maxStakeCents:maximumStake?.stakeCents??0,maxStakeIssue:maximumStake?.issue??null,maxStakeTime:maximumStake?.time??null,profitCents:returnCents-stakeCents,roi:stakeCents?(returnCents-stakeCents)/stakeCents:0,from:rows[0]?.time.slice(0,10)??'',to:rows.at(-1)?.time.slice(0,10)??''};
 const ready=chronological.length>=warmupPeriods;
 const nextUnit=ready?frequentRankUnit(plan,rows.length,missStreak,pause,mode.missThreshold):0;
 const next={ready,bought:nextUnit>0,stakePerNumberCents:nextUnit*100,stakeCents:nextUnit*100*candidateCount,missStreak,warmupRemaining:Math.max(0,warmupPeriods-chronological.length)};
 return {plan,candidateCount,missThreshold:mode.missThreshold,summary,next,rows:rows.reverse()};
}
