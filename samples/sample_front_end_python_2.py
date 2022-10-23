from js import document, alert
import datetime

import numpy as np


print("this message should print to the console")

el = document.getElementById("target")  # this may look like javascript, but it is actually python
el.innerHTML = f'''
<h3>&ltpyprez-script&gt example</h3><br/>
Successfully execute python script  in the browser(<a href="https://github.com/modularizer/pyprez/samples/sample_front_end_python_2.py">https://github.com/modularizer/pyprez/samples/sample_front_end_python_2.py<a/>)<br/>
Python has access to the document and window variables and functions.<br/><br/><br/>

The current datetime is <b>{datetime.datetime.now()}</b><br/>
{np.random.random(3)=}
'''
document.body.append(el)