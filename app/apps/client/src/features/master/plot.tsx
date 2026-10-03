import * as React from 'react';
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,Legend,ReferenceLine} from 'recharts';
import {MASTER_SCENARIO} from '@glucoflow/domain';
export function MasterChart():React.ReactElement{
 return <><div className="mb-2 flex justify-between text-[11px] text-ink-soft"><span>HbA1c (%)</span><span>Blood glucose (mg/dL)</span></div><div className="h-[340px] sm:h-[380px]" aria-label="Five supplied annual observations. HbA1c left axis 5 to 10 percent. Glucose right axis 70 to 250 mg/dL.">
  <ResponsiveContainer width="100%" height="100%"><LineChart data={MASTER_SCENARIO} margin={{top:20,right:8,bottom:20,left:8}}>
   <CartesianGrid vertical={false} stroke="#e2e7ed" strokeDasharray="3 4"/>
   <XAxis dataKey="period" interval={0} fontSize={11} tickMargin={12}/>
   <YAxis yAxisId="a1c" domain={[5,10]} ticks={[5,6.25,7.5,8.75,10]} width={43} tickFormatter={v=>`${v}%`} fontSize={10}/>
   <YAxis yAxisId="glucose" orientation="right" domain={[70,250]} ticks={[70,115,160,205,250]} width={38} fontSize={10}/>
   <Tooltip content={({active,payload,label})=>active&&payload?.length?<div className="rounded-xl border border-line bg-surface p-3 text-xs shadow-sm"><p className="mb-2 font-semibold">{label}</p>{payload.map(p=><p key={String(p.dataKey)} style={{color:p.color}}>{p.name}: {p.value}{p.dataKey==='hba1c'?' %':' mg/dL'}</p>)}</div>:null}/>
   <ReferenceLine yAxisId="a1c" x="2023" stroke="#85949e" strokeDasharray="4 4" label={{value:"12 Jun 2023",position:"insideTop",fontSize:9}}/>
   <ReferenceLine yAxisId="a1c" x="2024" stroke="#85949e" strokeDasharray="4 4" label={{value:"12 Jun 2024",position:"insideTop",fontSize:9}}/>
   <Legend wrapperStyle={{fontSize:11,paddingTop:12}}/>
   <Line yAxisId="a1c" name="HbA1c (%)" type="linear" dataKey="hba1c" stroke="#cc2453" strokeWidth={2.5} dot={{r:4}} isAnimationActive={false}/>
   <Line yAxisId="glucose" name="Fasting (mg/dL)" type="linear" dataKey="fasting" stroke="#cf800b" strokeWidth={2.5} dot={{r:4}} isAnimationActive={false}/>
   <Line yAxisId="glucose" name="Post-prandial (mg/dL)" type="linear" dataKey="postmeal" stroke="#137a76" strokeWidth={2.5} dot={{r:4}} isAnimationActive={false}/>
  </LineChart></ResponsiveContainer>
 </div><p className="mt-2 text-[11px] text-ink-soft">Event lines identify the corresponding year. Exact medication dates appear in the ledger; biomarker dates were supplied only as years/Q2.</p></>;
}
