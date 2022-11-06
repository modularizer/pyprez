from markdown2 import Markdown

import os
os.chdir('..')

with open("README.md") as f:
    mdt = f.read()

markdown = Markdown()
mdh = markdown.convert(mdt)
h = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <title>PyPrez</title>
    <link rel="icon" type="image/x-icon" href="../favicon.ico">
</head>
<body>
    <div style="margin-left:8%;margin-right:8%;margin-top:3%;padding:5%;background-color:rgb(253, 253, 253);">
    {mdh}
    </div>
</body>
</html>
"""
with open("../README.html", 'w') as f:
    f.write(h)