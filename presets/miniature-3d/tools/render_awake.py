#!/usr/bin/env python3
"""Runs the final render and asks Windows not to go to sleep while it runs.

The request holds for this process only and ends with it; no setting changes. A long render has no resume,
so a sleeping computer would cost the whole run.

python tools/render_awake.py <log file> <result file> render . --output renders/film.mp4 --audio audio/master.wav --codec x264 --workers 2
"""
import ctypes
import shutil
import subprocess
import sys
import time

ES_CONTINUOUS = 0x80000000
ES_SYSTEM_REQUIRED = 0x00000001

log_path, result_path, args = sys.argv[1], sys.argv[2], sys.argv[3:]
ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
start = time.time()
with open(log_path, 'w', encoding='utf8') as log, open(result_path, 'w', encoding='utf8') as result:
    code = subprocess.call([shutil.which('superint-video')] + args, stdout=result, stderr=log)
ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
print('Render finished: code %d after %.1f minutes' % (code, (time.time() - start) / 60))
print(open(result_path, encoding='utf8').read()[:1500])
sys.exit(code)
