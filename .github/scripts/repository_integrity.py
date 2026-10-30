"""Read tracked files as data; never import repository code or install dependencies."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
PROTECTED = [".github/workflows/repository-integrity.yml",".gitignore",".vscode/settings.json","package.json"]
MANIFEST = ROOT / '.github/repository-integrity.json'


def indicators(path, data):
    findings = []
    if path in ('public/fonts/fa-solid.lkf', 'public/fonts/fa-solid-500.woff2'):
        findings.append('known disguised executable path')
    suffix = Path(path).suffix.lower()
    if suffix in ('.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.lkf'):
        if re.search(rb"global\s*\[\s*['\"]!['\"]\s*\]\s*=", data):
            findings.append('known obfuscated loader marker')
        if re.search(rb'node\s+(?:\./)?api\.js\s*&&', data):
            findings.append('injected package execution hook')
    if path.endswith('.vscode/tasks.json'):
        if re.search(rb'folderOpen|node[^\r\n]*public/fonts/', data):
            findings.append('automatic or disguised editor task requires security review')
    if path.endswith('.vscode/settings.json'):
        if re.search(rb'"task\.allowAutomaticTasks"\s*:\s*true', data):
            findings.append('automatic workspace tasks enabled')
    if path == '.gitignore':
        if any(line.strip() in (b'branch_structure.json', b'temp_auto_push.bat',
                                b'temp_interactive_push.bat', b'.gitignore')
               for line in data.splitlines()):
            findings.append('known concealment entry')
    return findings


def main():
    failures = []
    try:
        manifest = json.loads(MANIFEST.read_bytes())
        if not isinstance(manifest, dict) or set(manifest) != set(PROTECTED):
            raise ValueError('protected-file inventory changed')
        for relative in PROTECTED:
            target = ROOT / relative
            digest = manifest[relative]
            if target.is_symlink() or not target.is_file():
                failures.append(f'{relative}: missing or not a regular file')
            elif not isinstance(digest, str) or hashlib.sha256(target.read_bytes()).hexdigest() != digest:
                failures.append(f'{relative}: bytes differ from reviewed baseline')
        paths = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).split(b'\0')
        for raw in filter(None, paths):
            relative = raw.decode('utf-8')
            target = ROOT / relative
            if target.is_symlink():
                continue
            data = target.read_bytes()
            failures.extend(f'{relative}: {reason}' for reason in indicators(relative, data))
    except (OSError, ValueError, TypeError, subprocess.CalledProcessError) as error:
        failures.append(f'integrity check cannot complete: {error}')
    if failures:
        print('Repository integrity FAILED. Do not run changed tooling.')
        for failure in failures:
            print(f'- {failure}')
        print('Review full diffs before intentionally updating the baseline.')
        return 1
    print('Repository integrity passed (bounded regression check, not a malware certification).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
