import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
from tempfile import TemporaryDirectory
import unittest

spec = importlib.util.spec_from_file_location('unpack_source', Path(__file__).resolve().parents[1] / 'unpack_source.py')
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


class SourceBundleTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.original = bundle.ROOT
        bundle.ROOT = self.root
        (self.root / 'vendor').mkdir()

    def tearDown(self):
        bundle.ROOT = self.original
        self.temp.cleanup()

    def source(self, path='hermes-agent/run_agent.py'):
        archive = self.root / 'vendor' / 'source.tar.gz'
        with tarfile.open(archive, 'w:gz') as target:
            info = tarfile.TarInfo(path)
            info.size = 4
            target.addfile(info, io.BytesIO(b'pass'))
        manifest = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'commit': 'example'}
        (archive.parent / 'manifest.json').write_text(json.dumps(manifest))
        return archive

    def test_expands_verified_local_source_and_marks_provenance(self):
        self.source()
        bundle.unpack()
        self.assertEqual((self.root / 'vendor/hermes-agent/run_agent.py').read_text(), 'pass')
        self.assertEqual((self.root / 'vendor/hermes-agent/SOURCE_COMMIT').read_text(), 'example\n')

    def test_refuses_changed_source_before_extraction(self):
        self.source().write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            bundle.unpack()
        self.assertFalse((self.root / 'vendor/hermes-agent').exists())

    def test_refuses_unexpected_archive_root(self):
        self.source('../outside.py')
        with self.assertRaisesRegex(ValueError, 'archive root'):
            bundle.unpack()
        self.assertFalse((self.root / 'outside.py').exists())

    def test_preserves_existing_local_changes(self):
        self.source()
        target = self.root / 'vendor/hermes-agent'
        target.mkdir()
        (target / 'run_agent.py').write_text('local edits')
        with self.assertRaises(FileExistsError):
            bundle.unpack()
        self.assertEqual((target / 'run_agent.py').read_text(), 'local edits')
