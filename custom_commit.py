#!/usr/bin/env python
import datetime
import subprocess
import sys

from dateutil import tz

fmt = "%a %b %d %Y %H:%M:%S GMT %z (%Z)"

if __name__ == "__main__":
    msg = sys.argv[1] if len(sys.argv) > 1 else "no message"
    dts = datetime.datetime.now(tz=tz.gettz()).strftime(fmt)
    branch = subprocess.check_output("git rev-parse --abbrev-ref HEAD", shell=True).decode().splitlines()[0]
    prev_commit_hash = subprocess.check_output("git log -1", shell=True).decode().splitlines()[0]
    with open('pyprez.js') as f:
        lines = f.readlines()
    lines[3] = f'    var pyprezUpdateDate = new Date("{dts}");\n'
    lines[4] = f'    var pyprezCommitMessage="{msg}";\n'
    lines[5] = f'    var pyprezPrevCommit="{branch}:{prev_commit_hash}"\n'
    s = "".join(lines)
    with open('pyprez.js', 'w') as f:
        f.write(s)
    subprocess.call("uglifyjs pyprez.js > pyprez.min.js", shell=True)
    subprocess.call(f"git add pyprez.js pyprez.min.js", shell=True)
    subprocess.call(f'git commit -m "{msg}"', shell=True)