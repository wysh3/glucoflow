export type DemoAccount={key:string;label:string;description:string;email:string;password:string};
declare const __GLUCOFLOW_DEMO_ACCOUNTS__: DemoAccount[];
export const demoAccounts:DemoAccount[]=typeof __GLUCOFLOW_DEMO_ACCOUNTS__==='undefined'?[]:__GLUCOFLOW_DEMO_ACCOUNTS__;
export const demoEnabled=demoAccounts.length>0;
