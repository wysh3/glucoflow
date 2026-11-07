import {Badge} from '@glucoflow/ui';

// PDF MVP: deliberately static illustrative counts, never a live staffing assessment.
const units = [
  {name:'Emergency', shift:'Evening shift', waiting:6, oldest:48, next:'Nursing / collection', receipt:2, review:3, handover:1},
  {name:'Diabetes ward', shift:'Evening shift', waiting:4, oldest:32, next:'Laboratory', receipt:3, review:1, handover:0},
  {name:'ICU', shift:'Evening shift', waiting:3, oldest:25, next:'Receiving care team', receipt:0, review:1, handover:2},
];

export function SupervisorPreview() {
 return <section aria-label="Illustrative unit workload" className="space-y-5">
  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">Where handoffs are waiting</h3><Badge>Static synthetic example</Badge></div>
  <p className="text-sm text-ink-soft">Illustrative evening-shift counts. This view is separate from your workspace and does not measure staffing capacity or individual performance.</p>
  <div className="grid grid-cols-3 gap-3 text-sm">
   <div><span className="block text-xs text-ink-soft">Unresolved handoffs</span><strong className="text-2xl">13</strong></div>
   <div><span className="block text-xs text-ink-soft">Units</span><strong className="text-2xl">3</strong></div>
   <div><span className="block text-xs text-ink-soft">Longest wait</span><strong className="text-2xl">48 <span className="text-sm font-normal">min</span></strong></div>
  </div>
  <div className="divide-y divide-line">
   {units.map(unit=><article key={unit.name} className="grid gap-3 py-4 sm:grid-cols-[1fr_1fr]">
    <div><h4 className="font-semibold">{unit.name}</h4><p className="text-xs text-ink-soft">{unit.shift} · {unit.waiting} waiting · oldest {unit.oldest} min</p>
     <svg className="mt-2 h-5 w-36" viewBox="0 0 140 20" role="img" aria-label={`${unit.receipt} lab receipts, ${unit.review} result reviews, ${unit.handover} handovers waiting`}>
      {Array.from({length:unit.waiting},(_,index)=><circle key={index} cx={10+index*22} cy={10} r={6} fill={index<unit.receipt?'#477d76':index<unit.receipt+unit.review?'#8c8a80':'#c19c75'}/>)}
     </svg>
    </div>
    <div className="text-sm"><p><span className="text-ink-soft">Next responsible team</span><br/>{unit.next}</p><p className="mt-1 text-xs text-ink-soft">{unit.receipt} receipt · {unit.review} review · {unit.handover} handover</p></div>
   </article>)}
  </div>
  <p className="text-xs text-ink-soft">Counts are illustrative, not a measure of clinical urgency. Supervisors review ownership and confirm any reassignment through the approved workflow.</p>
 </section>;
}
