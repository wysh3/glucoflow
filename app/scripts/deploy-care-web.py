#!/usr/bin/env python3
"""Build a static care client using the existing hosted demo configuration."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / '.local'
PRIVATE_ENV_NAMES = {'GUIDE_API_KEY', 'EXTRACTION_API_KEY', 'MODEL_API_KEY', 'HERMES_SERVICE_TOKEN', 'SARVAM_API_KEY'}


def private_values(hosted):
    values = {hosted[key] for key in ('serviceKey', 'databasePassword', 'ownerUrl', 'apiUrl', 'workerUrl', 'scalerUrl')}
    values.update(os.environ.get(name, '') for name in PRIVATE_ENV_NAMES)
    files = (ROOT / '.env', LOCAL / 'worker-production.env', LOCAL / 'care-hermes.env')
    for path in files:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            key, _, value = line.partition('=')
            if key.strip() in PRIVATE_ENV_NAMES:
                values.add(value.strip().strip('"').strip("'"))
    return [value.encode() for value in values if value]


def vercel_config():
    source = json.loads((ROOT / 'vercel.json').read_text())
    routes = [
        {
            'src': header['source'],
            'headers': {item['key']: item['value'] for item in header['headers']},
            'continue': True,
        }
        for header in source['headers']
    ]
    routes.append({'handle': 'filesystem'})
    routes.extend({'src': rule['source'], 'dest': rule['destination']} for rule in source['rewrites'])
    return {'version': 3, 'routes': routes}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--deploy', action='store_true', help='Publish the verified build to production')
    args = parser.parse_args()

    hosted = json.loads((LOCAL / 'azure-deployment-secrets.json').read_text())
    accounts = json.loads((LOCAL / 'hosted-demo-credentials.json').read_text())
    synthetic_accounts = {
        role: account for role, account in accounts.get('accounts', accounts).items()
        if role in {'clinician', 'clinic', 'reviewer', 'patient', 'other-clinic', 'other-patient'}
        and isinstance(account, dict) and account.get('email', '').endswith('@glucoflow.demo')
    }
    if not {'clinic', 'patient'} <= synthetic_accounts.keys():
        raise SystemExit('Hosted synthetic clinic and patient demo accounts are required.')
    project_link = ROOT / '.vercel' / 'project.json'
    project = json.loads(project_link.read_text())
    if project.get('projectName') != 'glucoflow':
        raise SystemExit('Expected the existing Vercel project link for glucoflow.')

    environment = {
        key: value for key, value in os.environ.items()
        if not key.startswith('VITE_') and key not in PRIVATE_ENV_NAMES
    }
    environment.update(
        VITE_API_BASE_URL=hosted['apiUrlPublic'],
        VITE_SUPABASE_URL=hosted['supabaseUrl'],
        VITE_SUPABASE_PUBLISHABLE_KEY=hosted['publishableKey'],
        VITE_DEMO_LABEL='Synthetic demo',
        VITE_DEMO_ACCOUNTS_JSON=json.dumps(synthetic_accounts),
    )

    with TemporaryDirectory(prefix='care-web-', dir=LOCAL) as temp:
        staging = Path(temp)
        output = staging / '.vercel' / 'output'
        static = output / 'static'
        output.mkdir(parents=True)
        subprocess.run(
            ['pnpm', '--filter', '@glucoflow/client', 'build', '--outDir', str(static)],
            cwd=ROOT, env=environment, check=True,
        )
        if not (static / 'index.html').is_file():
            raise SystemExit('Vite did not produce the expected static client output.')
        needles = private_values(hosted)
        for artifact in static.rglob('*'):
            if artifact.is_file():
                data = artifact.read_bytes()
                if any(value in data for value in needles):
                    raise SystemExit('Privileged configuration detected in the client artifact.')
        print('Built and scanned the static client for known privileged values.', flush=True)
        if args.deploy:
            shutil.copyfile(project_link, output.parent / 'project.json')
            (output / 'config.json').write_text(json.dumps(vercel_config()))
            subprocess.run(
                ['vercel', 'deploy', '--prebuilt', '--prod', '--yes', '--scope', 'wyshs-projects'],
                cwd=staging, check=True,
            )


if __name__ == '__main__':
    main()
