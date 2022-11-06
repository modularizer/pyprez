#!/usr/bin/env python
"""
github pages can only serve one branch and takes a few minutes to update, this will help identify which version
of code we are on
"""
import datetime
import subprocess
import sys
from dateutil import tz

# datetime string which can be interpreted by js builtin Date
fmt = "%a %b %d %Y %H:%M:%S GMT %z (%Z)"

if __name__ == "__main__":
    # git the commit message
    msg = sys.argv[1] if len(sys.argv) > 1 else "no message"

    # we will only write first line of commit message to js file
    msg0 = msg.splitlines()[0]

    # get the current time in a format which can be interpreted by js builtin Date
    dts = datetime.datetime.now(tz=tz.gettz()).strftime(fmt)

    # get the branch we are committing to and the hash of the previous commit
    branch = subprocess.check_output("git rev-parse --abbrev-ref HEAD", shell=True).decode().splitlines()[0]
    prev_commit_hash = subprocess.check_output("git log -1", shell=True).decode().splitlines()[0]

    # read the original file
    with open('pyprez.js') as f:
        lines = f.readlines()

    # set info the header lines we want to replace lineno: (assert_startswith, replace_middle, assert_endswith)
    header_details = {
        0: ('/*', dts, '*/\n'),
        1: ("\n", None ,"\n"),
        2: ("if (!window.pyprezUpdateDate){\n", None, "if (!window.pyprezUpdateDate){\n"),
        3: ('/*', None, None),
        4: (None, None, '*/\n'),
        5: ('    var pyprezUpdateDate = new Date("', dts, '");\n'),
        6: ('    var pyprezCommitMessage = "', msg0, '";\n'),
        7: ('    var pyprezPrevCommit = "', f'{branch}:{prev_commit_hash}', '";\n'),
        8: ('}', None, '}\n'),
        9: ("\n", None, "\n"),
    }
    for lineno, (assert_startswith, replace_middle, assert_endswith) in header_details.items():
        # read the header line in question
        line = lines[lineno]

        # make sure the header line is what is expected
        # to make sure this script errors out instead of incorrectly modifying js
        if assert_startswith is not None:
            assert line.startswith(assert_startswith), f"header line {lineno} start text has changed"
        if assert_endswith is not None:
            assert line.endswith(assert_endswith), f"header line {lineno} end text has changed"

        # replace middle of header line
        if replace_middle is not None:
            lines[lineno] = assert_startswith + replace_middle + assert_endswith

    # save changes
    s = "".join(lines)
    with open('pyprez.js', 'w') as f:
        f.write(s)

    # update minified js
    subprocess.call("uglifyjs pyprez.js > pyprez.min.js", shell=True)

    # commit
    subprocess.call(f"git add pyprez.js pyprez.min.js", shell=True)
    subprocess.call(f'git commit -m "{msg}"', shell=True)
