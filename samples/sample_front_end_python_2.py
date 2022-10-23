"""
the <pyprez-editor> tag can take an attribute src='./path_to_some_python_file_served_online.py' and it will display the
content for you to edit and run.

the <pyprez-script> tag can similarly take a src attribute, but it will execute the python script as soon as it loads
instead of putting it into a code demo text box.

this is a sample script that can be imported to test the <pyprez-editor> and <pyprez-script> tags.

"""

import numpy as np

for i in range(5):
    print(np.random.rand(5))  # this should print to the developer console with console.log
    # unless the stdout has already been rerouted by using javascript, e.g. pyprez.stdout=alert
