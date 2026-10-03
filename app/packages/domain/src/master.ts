/** Supplied synthetic scenario. Year/Q2 precision stays literal, never invented dates. */
export const MASTER_SCENARIO=[
 {period:'2022',year:2022,hba1c:7.2,fasting:132,postmeal:175,egfr:75},
 {period:'2023',year:2023,hba1c:7.3,fasting:140,postmeal:188,egfr:70},
 {period:'2024',year:2024,hba1c:7,fasting:118,postmeal:165,egfr:64},
 {period:'2025',year:2025,hba1c:7.6,fasting:135,postmeal:195,egfr:58},
 {period:'2026 Q2',year:2026,hba1c:8,fasting:142,postmeal:210,egfr:55},
] as const;
export const MEDICATION_PHASES=[
 {phase:'Baseline stabilization',period:'2022 – Q1 2023',date:null,medication:'Metformin 500 mg BID',detail:'Oral agent recorded in the supplied history.'},
 {phase:'Basal escalation & hormone injection',period:'Q2 2023 – Q1 2024',date:'2023-06-12',medication:'Metformin 1000 mg daily; Insulin Glargine 10 units subcutaneously at bedtime',detail:'Source describes an increase. 500 mg BID already totals 1000 mg/day; reconcile the prescription.'},
 {phase:'Mealtime titration & safety tracking',period:'Q2 2024 – 2025',date:'2024-06-12',medication:'Insulin Lispro 4 units pre-prandial; Glimepiride 2 mg',detail:'Shaking, dizziness and sweating reported in the supplied scenario. No numerical low reading was supplied.'},
 {phase:'Current long-term management',period:'2026 Q1 – Q2',date:null,medication:'Metformin 1000 mg + Basal Glargine 14 units nightly + Mealtime Lispro 4 units TID',detail:'Supplied regimen log. Continued use and missing stop dates require physician confirmation.'},
] as const;
export function glucoseFlag(value:number|null):boolean{return value!==null&&value<70;}
export function annualDecline(before:number,after:number,years:number):number|null{return years>0?(before-after)/years:null;}
export function screeningState(lastDate:string|null,interval:number,today:string):string{
 if(!lastDate)return 'No recorded date';
 const days=(Date.parse(today+'T00:00:00Z')-Date.parse(lastDate+'T00:00:00Z'))/86400000;
 return days>=interval?'Pending review':'Recorded';
}
