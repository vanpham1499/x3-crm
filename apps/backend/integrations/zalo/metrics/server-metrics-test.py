import importlib.util
import pathlib
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('metrics', pathlib.Path(__file__).with_name('server-metrics.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class MetricsTest(unittest.TestCase):
    def test_storage_excludes_volumes_from_docker_and_reconciles_total(self):
        with patch.object(m, 'command', return_value='100 path'), patch.object(m.Path, 'is_file', return_value=False), patch.object(m.shutil, 'disk_usage', return_value=SimpleNamespace(used=1000)):
            items = m.storage()['items']
            self.assertEqual(items['docker'], 0)
            self.assertEqual(items['migration'], 0)
            self.assertEqual(items['system'], 600)
            self.assertEqual(sum(items.values()), 1000)

    def test_storage_scan_failure_is_unknown_not_zero(self):
        with patch.object(m, 'command', side_effect=OSError()), patch.object(m.Path, 'is_file', return_value=False):
            items = m.storage()['items']
            self.assertIsNone(items['docker'])
            self.assertIsNone(items['system'])

    def test_cpu_delta(self):
        self.assertEqual(m.cpu_percent((100, 50), (200, 75)), 75)
        self.assertIsNone(m.cpu_percent((100, 50), (100, 50)))

    def test_memory_available_excludes_reclaimable_cache(self):
        with patch.object(m.Path, 'read_text', return_value='MemTotal: 1000 kB\nMemAvailable: 600 kB\nSwapTotal: 100 kB\nSwapFree: 80 kB\n'):
            ram = m.memory()
            self.assertEqual(ram['used'], 400 * 1024)
            self.assertEqual(ram['percent'], 40)

    def test_units(self):
        self.assertEqual(m.size('1.5GiB'), 1610612736)
        self.assertEqual(m.size('23MB'), 23000000)
        with self.assertRaises(ValueError):
            m.size('unknown')

    def test_service_allowlist_and_stopped(self):
        with patch.object(m, 'command', return_value='{"Names":"unrelated","State":"running"}\n{"Names":"x3-zalo-team-service-backup-1","State":"exited"}'):
            rows = m.services()
            self.assertEqual(len(rows), 6)
            backup = next(r for r in rows if r['name'] == 'Sao lưu')
            self.assertEqual(backup['state'], 'exited')
            self.assertNotIn('memoryUsed', backup)

    def test_drive_workers_are_aggregated_without_unrelated_containers(self):
        inventory = '\n'.join('{"Names":"x3-zalo-team-service-drive-'+str(i)+'","State":"running"}' for i in (1, 2))
        stats = '\n'.join('{"Name":"x3-zalo-team-service-drive-'+str(i)+'","MemUsage":"40MiB / 256MiB","CPUPerc":"2%"}' for i in (1, 2))
        with patch.object(m, 'command', side_effect=[inventory, stats]):
            drive = m.services()[-1]
            self.assertEqual(drive['name'], 'Chuyển tệp Drive (2/2)')
            self.assertEqual(drive['memoryUsed'], 80*1024**2)
            self.assertEqual(drive['cpuPercent'], 4)


if __name__ == '__main__':
    unittest.main()
