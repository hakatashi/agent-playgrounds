"""Restore the executable from a saved code-test stderr dump.

Usage: python3 decode.py stderr_A.txt A.out
"""
import base64, sys

text = open(sys.argv[1]).read()
b64 = text.split('-- base64 of /proc/self/exe\n', 1)[1].split('=====DIAG-END=====', 1)[0]
data = base64.b64decode(''.join(b64.split()))
open(sys.argv[2], 'wb').write(data)
print(f'wrote {len(data)} bytes to {sys.argv[2]}')
