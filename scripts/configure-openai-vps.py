"""Set the backend OpenAI key on the VPS without putting it in the repository."""

import getpass
import shlex
import subprocess


remote_code = r'''
import pathlib
import sys

path = pathlib.Path('/opt/campainha-digital/backend/.env')
key = sys.stdin.readline().strip().replace(r'\_', '_')
if not key.startswith('sk-'):
    raise SystemExit('Invalid key format')
lines = path.read_text().splitlines() if path.exists() else []
lines = [line for line in lines if not line.startswith('OPENAI_API_KEY=') and not line.startswith('OPENAI_MODEL=')]
lines.extend(['OPENAI_API_KEY=' + key, 'OPENAI_MODEL=gpt-6-luna'])
path.write_text('\n'.join(lines) + '\n')
path.chmod(0o600)
print('OpenAI key configured on VPS')
'''

key = getpass.getpass('Chave OpenAI para a VPS: ').strip()
if not key.startswith('sk-'):
    raise SystemExit('Chave inválida')

result = subprocess.run(
    ['ssh', '-o', 'BatchMode=yes', 'vps', 'python3 -c ' + shlex.quote(remote_code)],
    input=key + '\n', text=True, capture_output=True, check=False,
)
key = ''
if result.returncode:
    raise SystemExit(result.stderr.strip() or result.stdout.strip() or 'Falha ao configurar a VPS')
print(result.stdout.strip())
