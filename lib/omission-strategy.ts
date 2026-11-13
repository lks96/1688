import type {OmissionStatistics,OmissionItem,OmissionScope} from './omissions';
type StrategyInput=Pick<OmissionStatistics,'to'|'latestIssue'>&{scopes:Partial<Record<OmissionScope,{id:string;label:string;items:Pick<OmissionItem,'key'|'label'|'numbers'|'current'|'censored'>[]}[]>>};

const animals=[...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const dimensionIds=['head','tail','zodiac','parity','size-parity','number'];
const compare=(a:{score:number},b:{score:number})=>Math.round(b.score*1e10)-Math.round(a.score*1e10);

// This is a deterministic overdue-first selection policy, not an estimate of
// draw probabilities. Equal weights are fixed independently of future results.
export function scoreOmissionStrategy(statistics:StrategyInput,targetDate:string,targetOffset:number,scope:OmissionScope='special'){
  if(statistics.to.slice(0,10)>=targetDate)throw new Error('遗漏策略只能使用目标日期之前的开奖');
  if(!Number.isInteger(targetOffset)||targetOffset<0||targetOffset>11)throw new Error('生肖映射无效');
  const dimensions=dimensionIds.map(id=>{
    const category=statistics.scopes[scope]?.find(group=>group.id===id);
    if(!category)throw new Error('缺少遗漏统计维度');
    return {...category,maximum:Math.max(...category.items.map(item=>item.current))};
  });
  const ranking=Array.from({length:49},(_,i)=>{
    const number=i+1,zodiac=animals[(targetOffset-number+121)%12];
    const factors=dimensions.map(dimension=>{
      // Use the known target date's zodiac mapping, including lunar New Year.
      const item=dimension.items.find(item=>dimension.id==='zodiac'?item.key===zodiac:item.numbers.includes(number));
      if(!item)throw new Error('遗漏分类没有覆盖此号码');
      const contribution=dimension.maximum===0?0:100/dimensions.length*item.current/dimension.maximum;
      return {id:dimension.id,dimension:dimension.label,label:item.label,omission:item.current,censored:item.censored,contribution};
    });
    return {number,zodiac,score:factors.reduce((sum,factor)=>sum+factor.contribution,0),factors};
  }).sort((a,b)=>compare(a,b)||a.number-b.number);
  const zodiacRanking=animals.map(zodiac=>{
    const pool=ranking.filter(item=>item.zodiac===zodiac);
    // Mean, not sum: five mapped numbers must not automatically win over four.
    return {zodiac,score:pool.reduce((sum,item)=>sum+item.score,0)/pool.length,numbers:pool.map(item=>item.number).sort((a,b)=>a-b)};
  }).sort((a,b)=>compare(a,b)||animals.indexOf(a.zodiac)-animals.indexOf(b.zodiac));
  return {version:'omission-multidimension-v2',forecastFor:targetDate,trainingThroughIssue:statistics.latestIssue,trainingThroughTime:statistics.to,
    source:scope,scoreKind:'strategy_score_not_probability' as const,dimensionCount:dimensions.length,
    ranking,candidates:ranking.slice(0,10),zodiacRanking,zodiacCandidates:zodiacRanking.slice(0,3)};
}
export type OmissionStrategy=ReturnType<typeof scoreOmissionStrategy>;
