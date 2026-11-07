"""Verify and expand the bundled runtime source. No network access or third-party imports."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent


def unpack(destination=None, check_only=False):
    vendor = ROOT / 'vendor'
    manifest = json.loads((vendor / 'manifest.json').read_text())
    archive = vendor / manifest['archive']
    with archive.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != manifest['sha256']:
        raise ValueError('Bundled runtime source checksum mismatch; extraction refused.')
    if check_only:
        return manifest
    destination = Path(destination) if destination else vendor
    target = destination / 'hermes-agent'
    if target.exists():
        raise FileExistsError(f'{target} already exists. Preserve local changes; choose --destination with an empty directory.')
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, 'r:gz') as bundle:
        # The data filter rejects escaping links, special files and unsafe paths.
        # Require the expected top-level directory as an additional packaging guard.
        if any(member.name != 'hermes-agent' and not member.name.startswith('hermes-agent/') for member in bundle.getmembers()):
            raise ValueError('Unexpected archive root.')
        bundle.extractall(destination, filter='data')
    (target / 'SOURCE_COMMIT').write_text(manifest['commit'] + '\n', encoding='ascii')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path)
    parser.add_argument('--check-only', action='store_true')
    args = parser.parse_args()
    result = unpack(args.destination, args.check_only)
    print(f"Verified Gluco runtime foundation {result['version']} ({result['commit']}).")
