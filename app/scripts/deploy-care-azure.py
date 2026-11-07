#!/usr/bin/env python3
"""Update the existing synthetic demo API or worker with a private Hermes sidecar."""

import argparse
import json
from pathlib import Path
import re
import secrets
import subprocess
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

APP = 'glucoflow-service'
WORKER = 'glucoflow-worker'
GROUP = 'glucoflow-demo'
REGISTRY = 'glucoflowwysh2026.azurecr.io'
ARM = 'https://management.azure.com'
VERSION = '2025-07-01'
TOKEN_SECRET = 'hermes-service-token'
SARVAM_SECRET = 'sarvam-api-key'
SPEECH_LIMITS = {'SARVAM_STT_MAX_SECONDS': '60', 'SARVAM_TTS_MAX_CHARACTERS': '1000'}


class ReleaseError(Exception):
    pass


def az_tsv(*args):
    result = subprocess.run(
        ['az', *args, '--only-show-errors', '-o', 'tsv'],
        capture_output=True, text=True, check=False, timeout=30,
    )
    if result.returncode or not result.stdout.strip():
        raise ReleaseError(f'Azure CLI could not complete {args[0]} {args[1]}.')
    return result.stdout.strip()


class AppResource:
    def __init__(self, name=APP):
        subscription = az_tsv('account', 'show', '--query', 'id')
        if not re.fullmatch(r'[a-fA-F0-9-]{36}', subscription):
            raise ReleaseError('Azure CLI did not return a subscription ID.')
        self.name = name
        self.url = f'{ARM}/subscriptions/{subscription}/resourceGroups/{GROUP}/providers/Microsoft.App/containerApps/{name}'
        self.access_token = az_tsv('account', 'get-access-token', '--resource', ARM + '/', '--query', 'accessToken')

    def request(self, method='GET', subpath='', body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(
            f'{self.url}{subpath}?api-version={VERSION}', data=data, method=method,
            headers={'Authorization': f'Bearer {self.access_token}', 'Content-Type': 'application/json'},
        )
        try:
            with urlopen(request, timeout=30) as response:
                content = response.read()
                return json.loads(content) if content else {}
        except HTTPError as error:
            try:
                code = json.load(error).get('error', {}).get('code', '')
            except ValueError:
                code = ''
            detail = f' {code}' if re.fullmatch(r'[A-Za-z0-9_]+', code) else ''
            raise ReleaseError(f'Azure {method} request failed (HTTP {error.code}{detail}).') from None
        except (URLError, TimeoutError):
            raise ReleaseError(f'Azure {method} request failed to connect.') from None


def env_vars(values, references):
    return [
        *({'name': name, 'value': value} for name, value in values.items()),
        *({'name': name, 'secretRef': reference} for name, reference in references.items()),
    ]


def validate_app(properties):
    configuration = properties['configuration']
    if properties.get('workloadProfileName') != 'Consumption' or configuration.get('activeRevisionsMode') != 'Single':
        raise ReleaseError('Expected the existing Single-revision Consumption app.')
    if not any(registry['server'] == REGISTRY and registry.get('identity') for registry in configuration['registries']):
        raise ReleaseError('Existing managed-identity registry access is missing.')
    return configuration


def hermes_sidecar(image, model_secret, model_url, model_name):
    if not model_secret or not model_url.startswith('https://') or not model_name:
        raise ReleaseError('The existing model configuration is incomplete.')
    return {
        'name': 'hermes',
        'image': image,
        'resources': {'cpu': 1.0, 'memory': '2Gi'},
        'env': env_vars({
            'PORT': '8642',
            'HERMES_BIND_HOST': '0.0.0.0',
            'MODEL_BASE_URL': model_url,
            'MODEL_NAME': model_name,
            'HERMES_MAX_PROVIDER_CALLS_PER_HOUR': '60',
            'HERMES_MAX_CONCURRENT': '1',
        }, {'MODEL_API_KEY': model_secret, 'HERMES_SERVICE_TOKEN': TOKEN_SECRET}),
        'probes': [
            {
                'type': kind, 'httpGet': {'path': '/health', 'port': 8642},
                'initialDelaySeconds': 5, 'periodSeconds': 10, 'timeoutSeconds': 3,
                'failureThreshold': 6,
            }
            for kind in ('Startup', 'Readiness', 'Liveness')
        ],
    }


def sarvam_key():
    env_file = Path(__file__).resolve().parents[1] / '.env'
    try:
        if env_file.stat().st_mode & 0o077:
            raise ReleaseError('Set app/.env permissions to 0600 before adding the Sarvam secret.')
        lines = env_file.read_text().splitlines()
    except (OSError, UnicodeError):
        raise ReleaseError('The private app/.env file could not be read.') from None
    values = []
    for line in lines:
        name, separator, value = line.partition('=')
        if separator and name.strip() == 'SARVAM_API_KEY':
            values.append(value.strip())
    if len(values) != 1:
        raise ReleaseError('Expected one SARVAM_API_KEY entry in the private app/.env file.')
    value = values[0]
    if len(value) >= 2 and value[0] in {'"', "'"} and value[-1] == value[0]:
        value = value[1:-1]
    if not re.fullmatch(r'[^\s\x00-\x1f\x7f]{1,512}', value):
        raise ReleaseError('The Sarvam secret is missing or invalid.')
    return value


def revision_patch(app, configuration, template, model_secret, speech=False):
    patch = {'template': template}

    secret_names = {secret['name'] for secret in configuration['secrets']}
    if model_secret not in secret_names:
        raise ReleaseError('The existing model secret reference is missing.')
    additions = {}
    if TOKEN_SECRET not in secret_names:
        additions[TOKEN_SECRET] = secrets.token_urlsafe(36)
    if speech and SARVAM_SECRET not in secret_names:
        additions[SARVAM_SECRET] = sarvam_key()
    if additions:
        stored = app.request('POST', '/listSecrets')['value']
        if {secret['name'] for secret in stored} != secret_names or any(
            not (secret.get('value') or secret.get('keyVaultUrl')) for secret in stored
        ):
            raise ReleaseError('Azure did not return all existing secrets for safe preservation.')
        patch['configuration'] = {'secrets': [
            *stored, *({'name': name, 'value': value} for name, value in additions.items()),
        ]}

    return patch


def care_revision(app, current, api_image, hermes_image, hermes_extraction=False, speech=False):
    properties = current['properties']
    configuration = validate_app(properties)
    ingress = configuration.get('ingress') or {}
    if ingress.get('targetPort') != 8787 or ingress.get('additionalPortMappings'):
        raise ReleaseError('Expected the existing API-only ingress on port 8787.')

    template = properties['template']
    containers = {container['name']: container for container in template['containers']}
    if 'api' not in containers or containers.keys() - {'api', 'hermes'}:
        raise ReleaseError('Unexpected container in the current API revision.')
    api = containers['api']
    existing_env = {entry['name']: entry for entry in api['env']}
    previous_sidecar_env = {entry['name']: entry for entry in containers.get('hermes', {}).get('env', [])}
    model_secret = previous_sidecar_env.get('MODEL_API_KEY', existing_env.get('GUIDE_API_KEY', {})).get('secretRef')
    model_url = previous_sidecar_env.get('MODEL_BASE_URL', existing_env.get('GUIDE_BASE_URL', {})).get('value', '')
    model_name = previous_sidecar_env.get('MODEL_NAME', existing_env.get('EXTRACTION_MODEL', {})).get('value', '')
    values = {'HERMES_URL': 'http://127.0.0.1:8642'}
    references = {'HERMES_SERVICE_TOKEN': TOKEN_SECRET}
    replaced = {'HERMES_URL', 'HERMES_SERVICE_TOKEN'}
    if hermes_extraction:
        values['EXTRACTION_PROVIDER'] = 'hermes'
        replaced.update({'EXTRACTION_PROVIDER', 'GUIDE_API_KEY'})
    if speech:
        values.update(SPEECH_LIMITS)
        references['SARVAM_API_KEY'] = SARVAM_SECRET
        replaced.update({*SPEECH_LIMITS, 'SARVAM_API_KEY'})
    api['image'] = api_image
    api['env'] = [
        *(entry for entry in existing_env.values() if entry['name'] not in replaced),
        *env_vars(values, references),
    ]
    template['containers'] = [api, hermes_sidecar(hermes_image, model_secret, model_url, model_name)]
    # Keep the interactive API warm: entry configuration has a bounded timeout.
    template['scale'].update(minReplicas=1, maxReplicas=1)
    return revision_patch(app, configuration, template, model_secret, speech)


def worker_revision(app, current, worker_image, hermes_image, document_call_cap=None):
    properties = current['properties']
    configuration = validate_app(properties)
    if configuration.get('ingress') is not None:
        raise ReleaseError('Expected the worker app to have no ingress.')
    template = properties['template']
    scale = template['scale']
    if (scale.get('minReplicas') not in (0, 1) or scale.get('maxReplicas') != 1
            or not any((rule.get('custom') or {}).get('type') == 'postgresql' for rule in scale.get('rules', []))):
        raise ReleaseError('Expected the existing PostgreSQL scaler and at most one replica.')

    # Care reconciliation has work independent of the document queue scaler.
    # Keep one replica alive so a closed browser cannot stop pending monitors.
    scale['minReplicas'] = 1
    containers = {container['name']: container for container in template['containers']}
    if 'worker' not in containers or containers.keys() - {'worker', 'hermes'}:
        raise ReleaseError('Unexpected container in the current worker revision.')
    worker = containers['worker']
    existing_env = {entry['name']: entry for entry in worker['env']}
    previous_sidecar_env = {entry['name']: entry for entry in containers.get('hermes', {}).get('env', [])}
    model_secret = previous_sidecar_env.get('MODEL_API_KEY', existing_env.get('EXTRACTION_API_KEY', {})).get('secretRef')
    model_url = previous_sidecar_env.get('MODEL_BASE_URL', existing_env.get('EXTRACTION_BASE_URL', {})).get('value', '')
    model_name = existing_env.get('EXTRACTION_MODEL', {}).get('value', '')
    values = {'EXTRACTION_PROVIDER': 'hermes', 'HERMES_URL': 'http://127.0.0.1:8642'}
    if document_call_cap is not None:
        values['MAX_DOCUMENT_MODEL_CALLS'] = str(document_call_cap)
    replaced = {*values, 'HERMES_SERVICE_TOKEN', 'EXTRACTION_BASE_URL', 'EXTRACTION_API_KEY'}
    worker['image'] = worker_image
    worker['env'] = [
        *(entry for entry in existing_env.values() if entry['name'] not in replaced),
        *env_vars(values, {'HERMES_SERVICE_TOKEN': TOKEN_SECRET}),
    ]
    template['containers'] = [worker, hermes_sidecar(hermes_image, model_secret, model_url, model_name)]
    return revision_patch(app, configuration, template, model_secret)


def ready_revision(app, expected):
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        properties = app.request()['properties']
        if properties['latestReadyRevisionName'] == expected:
            return
        if properties['provisioningState'] in {'Failed', 'Canceled'}:
            raise ReleaseError(f'Azure provisioning failed for {expected}.')
        time.sleep(5)
    raise ReleaseError(f'Azure did not mark {expected} ready within four minutes.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest='action', required=True)
    inspect = actions.add_parser('inspect', help='Read the active revision without changing it')
    inspect.add_argument('--component', choices=['api', 'worker'], default='api')
    deploy = actions.add_parser('deploy', help='Create a care revision from immutable ACR images')
    deploy.add_argument('--api-image', required=True)
    deploy.add_argument('--hermes-image', required=True)
    deploy.add_argument('--suffix', required=True)
    deploy.add_argument('--hermes-extraction', action='store_true', help='Advertise an already verified Hermes worker')
    deploy.add_argument('--sarvam-speech', action='store_true',
                        help='Set API-only Sarvam speech credentials and bounded deployment quotas')
    worker = actions.add_parser('deploy-worker', help='Create a private document worker revision')
    worker.add_argument('--worker-image', required=True)
    worker.add_argument('--hermes-image', required=True)
    worker.add_argument('--suffix', required=True)
    worker.add_argument('--document-call-cap', type=int, choices=(2, 10),
                        help='Set two calls for staged upload proof or ten for the supported production page range')
    rollback = actions.add_parser('rollback', help='Copy a known prior revision to a new revision')
    rollback.add_argument('--component', choices=['api', 'worker'], default='api')
    rollback.add_argument('--revision', required=True)
    rollback.add_argument('--suffix', required=True)
    args = parser.parse_args()

    if args.action != 'inspect' and not re.fullmatch(r'[a-z][a-z0-9-]{0,29}', args.suffix):
        parser.error('Provide a new lowercase revision suffix of up to 30 characters.')
    is_worker = args.action == 'deploy-worker' or getattr(args, 'component', None) == 'worker'
    if args.action in {'deploy', 'deploy-worker'}:
        primary = (args.worker_image, 'glucoflow-worker') if is_worker else (args.api_image, 'glucoflow-api')
        for image, repository in (primary, (args.hermes_image, 'glucoflow-hermes')):
            prefix = re.escape(f'{REGISTRY}/{repository}@sha256:')
            if not re.fullmatch(prefix + r'[a-f0-9]{64}', image):
                parser.error(f'Provide an immutable {repository} digest from {REGISTRY}.')

    app = AppResource(WORKER if is_worker else APP)
    current = app.request()
    previous = current['properties']['latestReadyRevisionName']
    print(f'Previous ready revision: {previous}', flush=True)
    if args.action == 'inspect':
        return

    if args.action == 'rollback':
        if not re.fullmatch(re.escape(app.name) + r'--[a-z0-9-]+', args.revision):
            parser.error(f'Provide a prior revision of {app.name}.')
        template = app.request(subpath=f'/revisions/{args.revision}')['properties']['template']
        if not is_worker:
            api = next(container for container in template['containers'] if container['name'] == 'api')
            api['env'] = [
                *(entry for entry in api['env'] if entry['name'] != 'RESULT_ESCALATION_DISABLED'),
                {'name': 'RESULT_ESCALATION_DISABLED', 'value': 'true'},
            ]
        patch = {'template': template}
    elif args.action == 'deploy-worker':
        patch = worker_revision(app, current, args.worker_image, args.hermes_image, args.document_call_cap)
    else:
        patch = care_revision(app, current, args.api_image, args.hermes_image, args.hermes_extraction, args.sarvam_speech)

    patch['template']['revisionSuffix'] = args.suffix
    expected = f'{app.name}--{args.suffix}'
    app.request('PATCH', body={'properties': patch})
    print(f'Submitted revision: {expected}', flush=True)
    ready_revision(app, expected)
    print(f'Azure marked {expected} ready.')


if __name__ == '__main__':
    try:
        main()
    except ReleaseError as error:
        raise SystemExit(str(error)) from None
    except (KeyError, StopIteration, TypeError, ValueError, subprocess.TimeoutExpired):
        raise SystemExit('Unexpected Azure response or CLI timeout.') from None
