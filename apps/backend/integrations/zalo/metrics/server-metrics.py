#!/usr/bin/env python3
"""Host-only collector. Publishes numeric snapshots; no Docker socket in API containers."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

ROOT = Path('/opt/x3-zalo-team')
OUTPUT = ROOT / 'metrics/server.json'
SERVICES = {
    'x3-zalo-team-web-connector-1': 'Zalo Web',
    'x3-zalo-team-service-api-1': 'API Zalo',
    'x3-zalo-team-service-api-http-1': 'HTTP',
    'x3-zalo-team-service-sync-1': 'Đồng bộ',
    'x3-zalo-team-service-backup-1': 'Sao lưu',
    'x3-zalo-team-service-database-1': 'Database',
}


def command(args, timeout=12):
    return subprocess.check_output(args, timeout=timeout, text=True, stderr=subprocess.DEVNULL)


def cpu_ticks():
    values = [int(v) for v in Path('/proc/stat').read_text().splitlines()[0].split()[1:9]]
    return sum(values), values[3] + values[4]


def cpu_percent(previous, current):
    elapsed = current[0] - previous[0]
    return round(max(0, min(100, 100 * (1 - (current[1] - previous[1]) / elapsed))), 1) if elapsed > 0 else None


def memory():
    fields = {k: int(v.split()[0]) * 1024 for k, v in
              (line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())}
    total, available = fields['MemTotal'], fields['MemAvailable']
    return {'total': total, 'available': available, 'used': total - available,
            'percent': round((total - available) / total * 100, 1),
            'swapTotal': fields['SwapTotal'], 'swapUsed': fields['SwapTotal'] - fields['SwapFree']}


def size(value):
    match = re.fullmatch(r'([\d.]+)\s*(B|kB|MB|GB|TB|KiB|MiB|GiB|TiB)', value.strip())
    if not match:
        raise ValueError('Invalid Docker size')
    units = {'B': 1, 'kB': 1000, 'MB': 1000**2, 'GB': 1000**3, 'TB': 1000**4,
             'KiB': 1024, 'MiB': 1024**2, 'GiB': 1024**3, 'TiB': 1024**4}
    return round(float(match[1]) * units[match[2]])


def services():
    states = {}
    drive_workers = []
    for line in command(['docker', 'ps', '-a', '--format', '{{json .}}']).splitlines():
        row = json.loads(line)
        if re.fullmatch(r'x3-zalo-team-service-drive-\d+', row['Names']):
            drive_workers.append(row['Names'])
        if row['Names'] in SERVICES or row['Names'] in drive_workers:
            states[row['Names']] = row['State']
    running = [name for name in [*SERVICES, *drive_workers] if states.get(name) == 'running']
    stats = {}
    if running:
        for line in command(['docker', 'stats', '--no-stream', '--format', '{{json .}}', *running]).splitlines():
            row = json.loads(line)
            used, limit = map(size, row['MemUsage'].split('/'))
            stats[row['Name']] = {'memoryUsed': used, 'memoryLimit': limit,
                                  'cpuPercent': float(row['CPUPerc'].rstrip('%'))}
    result = [{'name': title, 'state': states.get(name, 'missing'), **stats.get(name, {})}
              for name, title in SERVICES.items()]
    if drive_workers:
        active = sum(states.get(name) == 'running' for name in drive_workers)
        result.append({'name': f'Chuyển tệp Drive ({active}/{len(drive_workers)})',
                       'state': 'running' if active == len(drive_workers) else 'stopped',
                       **{key: sum(stats.get(name, {}).get(key, 0) for name in drive_workers)
                          for key in ('memoryUsed', 'memoryLimit', 'cpuPercent')}})
    return result


def storage():
    # Actual disk allocation, not logical asset bytes. Bounded scan every five minutes.
    paths = [('archive', ROOT / 'data/archive'), ('backups', ROOT / 'data/backups'),
             ('database', Path('/var/lib/docker/volumes/x3-zalo-team-service_database/_data')),
             ('profiles', Path('/var/lib/docker/volumes/x3-zalo-team-web_web_profiles/_data')),
             ('containerd', Path('/var/lib/containerd')),
             ('dockerEngine', Path('/var/lib/docker'))]
    items = {}
    for key, path in paths:
        try:
            items[key] = int(command(['du', '-sx', '-B1', str(path)], timeout=25).split()[0])
        except (OSError, ValueError, subprocess.SubprocessError):
            items[key] = None
    runtime = [items.pop('containerd'), items.pop('dockerEngine'), items['database'], items['profiles']]
    items['docker'] = max(0, runtime[0] + runtime[1] - runtime[2] - runtime[3]) if all(v is not None for v in runtime) else None
    artifacts = [ROOT / name for name in ('storage.tar', 'profiles.tar', 'database.jsonl', 'code.tar', 'metrics-code.tar')]
    items['migration'] = sum(p.stat().st_blocks * 512 for p in artifacts if p.is_file())
    items['system'] = max(0, shutil.disk_usage(ROOT).used - sum(items.values())) if all(v is not None for v in items.values()) else None
    return {'sampledAt': int(time.time()), 'items': items}


def collect():
    OUTPUT.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
    history = []
    try:
        saved = json.loads(OUTPUT.read_text())
        history = saved.get('history', []) if saved.get('historySchema') == 2 else []
    except (OSError, ValueError):
        pass
    previous = cpu_ticks()
    time.sleep(1)
    disk_data = None
    while True:
        started = time.monotonic()
        now = int(time.time())
        current = cpu_ticks()
        cpu = cpu_percent(previous, current)
        previous = current
        ram = memory()
        disk = shutil.disk_usage(ROOT)
        used = disk.used
        disk_info = {'total': disk.total, 'available': disk.free, 'used': used,
                     'reserved': max(0, disk.total - disk.free - disk.used),
                     'percent': round(used / disk.total * 100, 1)}
        available = True
        try:
            service_data = services()
        except (OSError, ValueError, KeyError, subprocess.SubprocessError):
            available, service_data = False, []
        if disk_data is None or now - disk_data['sampledAt'] >= 300:
            disk_data = storage()
        sample = {'at': now, 'cpu': cpu, 'ram': ram['percent'], 'disk': disk_info['percent']}
        history = [h for h in history if now - 86400 <= h['at'] <= now][-2879:] + [sample]
        data = {'version': 1, 'historySchema': 2, 'sampledAt': now,
                'host': {'name': 'VPS Zalo', 'address': '14.225.198.183', 'cores': os.cpu_count(),
                         'cpuPercent': cpu, 'load': list(os.getloadavg()),
                         'uptime': int(float(Path('/proc/uptime').read_text().split()[0])),
                         'memory': ram, 'disk': disk_info},
                'services': service_data, 'servicesAvailable': available,
                'storage': disk_data, 'history': history}
        temporary = OUTPUT.with_suffix('.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        temporary.chmod(0o644)
        temporary.replace(OUTPUT)
        time.sleep(max(1, 30 - (time.monotonic() - started)))


if __name__ == '__main__':
    collect()
