#!/usr/bin/env python3
"""rtk - terminal output filter for AI context optimization
사용: 디렉토리 목록을 stdin으로 받아 폴더/확장자별로 압축 요약한다.
예) Get-ChildItem -Recurse -Name | python rtk.py
"""
import sys, re
from collections import defaultdict

lines = sys.stdin.read().splitlines()

# Group files by directory
dirs = defaultdict(list)
current_dir = None

for line in lines:
    line = line.strip()
    if not line:
        continue
    if line.endswith(':'):
        current_dir = line[:-1]
    elif current_dir:
        dirs[current_dir].append(line)

if dirs:
    total_files = sum(len(v) for v in dirs.values())
    print(f"[rtk] {len(dirs)} directories, {total_files} files total")
    print()
    for d, files in sorted(dirs.items()):
        exts = defaultdict(int)
        for f in files:
            ext = f.rsplit('.', 1)[-1] if '.' in f else 'no-ext'
            exts[ext] += 1
        ext_summary = ', '.join(f"{v} .{k}" for k, v in sorted(exts.items()))
        print(f"  {d}/  ({ext_summary})")
else:
    # Fallback: just print unique lines, deduplicated
    seen = set()
    for line in lines:
        if line not in seen:
            seen.add(line)
            print(line)
