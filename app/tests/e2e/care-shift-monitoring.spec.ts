import { expect, test, type Page } from '@playwright/test';
import type { CareWorkspace } from '@glucoflow/contracts';
import { demoCredentials } from './helpers';

const api=process.env.CARE_E2E_API??'http://127.0.0.1:8787';
async function command(page:Page, action:()=>Promise<unknown>) {
 const pending=page.waitForResponse(response=>response.url().endsWith('/commands')&&response.request().method()==='POST');
 await action();const response=await pending;expect(response.status()).toBe(200);
 return response.json() as Promise<CareWorkspace>;
}
test('real API shift scope requires approval, can pause/edit/reapprove/stop, and opens evidence',async({page})=>{
 const credentials=demoCredentials().accounts.clinic!;
 const signed=await page.request.post(`${api}/api/v1/auth/local-sign-in`,{data:{email:credentials.email,password:credentials.password}});
 expect(signed.status()).toBe(200);
 const {accessToken}=await signed.json();
 const headers={authorization:`Bearer ${accessToken}`};
 const me=await(await page.request.get(`${api}/api/v1/me`,{headers})).json();
 const created=await page.request.post(`${api}/api/v1/care/workspaces`,{headers,data:{}});
 expect(created.status()).toBe(201);let workspace=await created.json() as CareWorkspace;
 if(api!=='http://127.0.0.1:8787')await page.route('http://127.0.0.1:8787/**',async route=>{
  const response=await route.fetch({url:route.request().url().replace('http://127.0.0.1:8787',api)});await route.fulfill({response});
 });
 await page.addInitScript(({token,actorId,workspaceId})=>{
  localStorage.setItem('sutra.access-token',token);sessionStorage.setItem(`glucoflow.care.workspace.${actorId}`,workspaceId);
 },{token:accessToken,actorId:me.actor.userId,workspaceId:workspace.id});
 await page.goto('/clinic/care');
 await expect(page.getByRole('heading',{name:'Doctor care desk'})).toBeVisible();
 await page.getByLabel('Message Gluco',{exact:true}).fill('Monitor validated results awaiting acknowledgement for my assigned patients until the end of this shift.');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Shift monitoring',exact:true});await expect(dialog).toBeVisible();
 await dialog.getByRole('checkbox',{name:/Sara Khan/}).check();
 await dialog.getByRole('checkbox',{name:'Dr Mira Rao · Doctor',exact:true}).check();
 const draft=await command(page,()=>dialog.getByRole('button',{name:'Review scope',exact:true}).click());
 expect(draft.shiftMonitoring?.[0]?.status).toBe('awaiting_approval');
 await expect(dialog.getByText('Review this exact scope.',{exact:false})).toBeVisible();
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Approve monitoring',exact:true}).click());
 expect(workspace.shiftMonitoring?.[0]?.status).toBe('monitoring');
 await expect(dialog.getByText('Last check',{exact:false}).first()).toBeVisible();
 await dialog.getByRole('button',{name:/LIS · Result validated/}).click();
 const evidence=page.getByRole('dialog',{name:'Source event',exact:true});await expect(evidence).toBeVisible();
 await expect(evidence).toContainText('LIS');await evidence.getByRole('button',{name:'Close',exact:true}).click();
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Pause',exact:true}).click());expect(workspace.shiftMonitoring?.[0]?.status).toBe('paused');
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Approve resume',exact:true}).click());expect(workspace.shiftMonitoring?.[0]?.status).toBe('monitoring');
 await dialog.getByRole('button',{name:'Edit scope',exact:true}).click();
 await dialog.getByRole('checkbox',{name:/Dev Mehta/}).check();
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Review scope',exact:true}).click());
 expect(workspace.shiftMonitoring?.[0]?.version).toBe(2);expect(workspace.shiftMonitoring?.[0]?.status).toBe('awaiting_approval');expect(workspace.shiftMonitoring?.[0]?.approvedAt).toBeUndefined();
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Approve monitoring',exact:true}).click());expect(workspace.shiftMonitoring?.[0]?.status).toBe('monitoring');
 workspace=await command(page,()=>dialog.getByRole('button',{name:'Stop monitoring',exact:true}).click());expect(workspace.shiftMonitoring?.[0]?.status).toBe('stopped');
 await expect(dialog.getByRole('button',{name:'Approve monitoring',exact:true})).toHaveCount(0);
 await page.screenshot({path:`reports/completion-evidence/shift-monitoring-${test.info().project.name}.png`,fullPage:true});
 expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
});
