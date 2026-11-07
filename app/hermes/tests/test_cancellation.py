"""Real child-process lifecycle tests, with no external provider calls."""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore, Event, Lock, Timer
from collections import deque
from time import monotonic
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import ClientDisconnected, Provider, Service, run_isolated


class CancellationTests(unittest.TestCase):
    def test_pre_cancelled_turn_does_not_spawn(self):
        with patch('server.subprocess.Popen') as popen:
            with self.assertRaises(ClientDisconnected):
                run_isolated(['unused'], cwd='.', env={}, payload='{}', deadline=2,
                             cancelled=lambda: True)
            popen.assert_not_called()

    def test_cancelled_child_is_reaped_promptly(self):
        with TemporaryDirectory() as home:
            marker = Path(home, 'pid')
            stopped = Event()
            timer = Timer(0.3, stopped.set)
            timer.start()
            started = monotonic()
            children = []
            spawn = subprocess.Popen
            def capture(*args, **kwargs):
                child = spawn(*args, **kwargs)
                children.append(child)
                return child
            try:
                with patch('server.subprocess.Popen', side_effect=capture), self.assertRaises(ClientDisconnected):
                    run_isolated([sys.executable, '-c',
                                  "import os,time;open('pid','w').write(str(os.getpid()));time.sleep(10)"],
                                 cwd=home, env={}, payload='{}', deadline=5, cancelled=stopped.is_set)
            finally:
                timer.cancel()
            self.assertLess(monotonic() - started, 2)
            self.assertEqual(len(children), 1)
            self.assertIsNotNone(children[0].poll())
            # Cancellation may win before the child writes its marker under emulation.
            with self.assertRaises(ProcessLookupError):
                os.kill(children[0].pid, 0)

    def test_deadline_reaps_child(self):
        with TemporaryDirectory() as home:
            children = []
            spawn = subprocess.Popen
            def capture(*args, **kwargs):
                child = spawn(*args, **kwargs)
                children.append(child)
                return child
            with patch('server.subprocess.Popen', side_effect=capture), self.assertRaises(subprocess.TimeoutExpired):
                run_isolated([sys.executable, '-c',
                              "import os,time;open('pid','w').write(str(os.getpid()));time.sleep(10)"],
                             cwd=home, env={}, payload='{}', deadline=0.25)
            with self.assertRaises(ProcessLookupError):
                os.kill(children[0].pid, 0)

    def test_wait_drains_output_larger_than_pipe(self):
        output = run_isolated([sys.executable, '-c', "print('x'*131072)"],
                              cwd='.', env={}, payload='{}', deadline=2)
        self.assertEqual(len(output.strip()), 131072)

    def test_zero_hourly_cap_does_not_accumulate_or_reject_calls(self):
        service = Service.__new__(Service)
        service.hourly_cap = 0
        service.reservations = deque()
        service.lock = Lock()
        for _ in range(1001):
            self.assertTrue(service.reserve(3))
        self.assertEqual(len(service.reservations), 0)

    def test_cancel_releases_admission_but_retains_reserved_call_budget(self):
        service = Service.__new__(Service)
        service.token = 'local-synthetic-test-token'
        service.ready = True
        service.provider = Provider('http://127.0.0.1/v1', 'synthetic-model', 'synthetic-key')
        service.active = BoundedSemaphore(1)
        service.hourly_cap = 60
        service.reservations = deque()
        service.lock = Lock()
        with patch('server.run_isolated', side_effect=ClientDisconnected):
            status, _, _ = service.run({'operation': 'chat'})
        self.assertEqual(status, 499)
        self.assertTrue(service.active.acquire(blocking=False))
        self.assertEqual(sum(count for _, count in service.reservations), 3)


if __name__ == '__main__':
    unittest.main()
