#!/usr/bin/env python3
"""Runs the final render and keeps the computer from going to sleep while it runs.

Windows is asked through SetThreadExecutionState, a Mac through `caffeinate -i`. Either request
holds for this process only and ends with it; no setting changes. A long render has no resume,
so a sleeping computer would cost the whole run.

python tools/render_awake.py <log file> <result file> render . --output renders/film.mp4 --audio audio/master.wav --codec x264 --workers 2

`superint-video` is taken from the search path, or from SUPERINT_VIDEO when that names it.
"""
import os
import shutil
import subprocess
import sys
import time

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001

log_path, result_path, args = sys.argv[1], sys.argv[2], sys.argv[3:]
program = os.environ.get('SUPERINT_VIDEO') or shutil.which('superint-video')
if not program:
    sys.exit('superint-video was not found: put it on the search path or set SUPERINT_VIDEO to its path')
command = [program] + args
windows = sys.platform == 'win32'
if windows:
    import ctypes
    ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
elif sys.platform == 'darwin' and shutil.which('caffeinate'):
    command = ['caffeinate', '-i'] + command
start = time.time()
with open(log_path, 'w', encoding='utf8') as log, open(result_path, 'w', encoding='utf8') as result:
    code = subprocess.call(command, stdout=result, stderr=log)
if windows:
    ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
print('Render finished: code %d after %.1f minutes' % (code, (time.time() - start) / 60))
print(open(result_path, encoding='utf8').read()[:1500])
sys.exit(code)
