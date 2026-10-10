"""Build context for Team only; never ship dotenv, uploads, profiles or test data."""
import argparse
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[3]
APP = ROOT / 'apps/frontend'
ROOT_APP_FILES = {'layout.tsx', 'providers.tsx', 'error.tsx', 'global-error.tsx', 'loading.tsx', 'not-found.tsx'}


def included(path):
    rel = path.relative_to(APP)
    if any(p in {'node_modules', '.next', '.git', 'uploads', '__tests__'} for p in rel.parts):
        return False
    if path.name.startswith('.env') or path.suffix in {'.tsbuildinfo', '.log'}:
        return False
    if rel.parts[0] == 'src':
        if len(rel.parts) > 1 and rel.parts[1] == 'app':
            route = rel.parts[2:]
            return (len(route) == 1 and route[0] in ROOT_APP_FILES) or route[0] == 'zalo-team' or route[:2] == ('api', 'zalo-team')
        return not ('.test.' in path.name or '.spec.' in path.name)
    if rel.parts[0] == 'public':
        return True
    return str(rel) in {'package.json', 'next.config.js', 'next-env.d.ts', 'tsconfig.json', 'postcss.config.js', 'tailwind.config.ts', 'tailwind.config.js'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    files = [ROOT / p for p in ['package.json', 'package-lock.json', 'apps/backend/package.json', 'tooling/zalo-team/service/frontend.Dockerfile']]
    files += [p for p in (ROOT / 'packages/shared').rglob('*') if p.is_file() and 'node_modules' not in p.parts]
    files += [p for p in APP.rglob('*') if p.is_file() and included(p)]
    with tarfile.open(args.output, 'w:gz') as archive:
        for path in sorted(set(files)):
            archive.add(path, arcname=path.relative_to(ROOT).as_posix(), recursive=False)
    print(f'Packaged {len(files)} source files; {args.output.stat().st_size} bytes')


if __name__ == '__main__':
    main()
