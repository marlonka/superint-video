#!/usr/bin/env python3
"""Sets the subframes per film frame for the clip `film`: 32 to develop, 64 to judge a look and to render.

Run from the project folder: python tools/set_samples.py 64
"""
import json
import sys

path = 'video.json'
video = json.load(open(path, encoding='utf8'))
for clip in video['clips']:
    if clip['id'] == 'film':
        clip['props']['samples'] = int(sys.argv[1])
json.dump(video, open(path, 'w', encoding='utf8', newline=''), ensure_ascii=False, indent=2)
print('samples', sys.argv[1])
