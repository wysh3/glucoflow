import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * One Vite build serves the browser and is bundled into the Android application.
 * The API base URL is public configuration, never a secret.
 */
export default defineConfig(({command}) => {
  const labels:Record<string,[string,string]>={
    clinician:['Doctor','Explore progression, prescriptions and source reports.'],
    clinic:['Clinic team','Upload records, review extraction and publish approved facts.'],
    reviewer:['Reviewer','Check extracted entries against their original reports.'],
    patient:['Patient','Add reports, home readings, symptoms and visit notes.'],
    'other-clinic':['Second clinic','Explore a separate clinic to check access separation.'],
    'other-patient':['Second patient','Explore an independent patient account.'],
  };
  const local=resolve('../../.local/demo-credentials.json');
  const raw=process.env.VITE_DEMO_ACCOUNTS_JSON || (command==='serve'&&existsSync(local)?readFileSync(local,'utf8'):'');
  const source=raw?JSON.parse(raw).accounts??JSON.parse(raw):{};
  const accounts=Object.entries(labels).flatMap(([key,[label,description]])=>{
    const account=source[key];return account?.email?.endsWith('@glucoflow.demo')&&account.password?[{key,label,description,email:account.email,password:account.password}]:[];
  });
  return {
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  define: {
    __GLUCOFLOW_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __GLUCOFLOW_DEMO_ACCOUNTS__: JSON.stringify(accounts),
  },
};
});
