# Pyjamas
Welcome to **Pyjamas!**
  
 **Pyjamas** is a minimal script to help you get started playing around with [**Pyodide**](#pyodide), which allows you to run front-end Python and easily interact between Python, javascript and HTML.  In fact, >99% of the functionaly of **Pyjamas** comes directly from pyodide object, which is made available at `window.pyodide`.

Pyjamas is inspired [**Pyscript**](#pyscript), a project backed by Anaconda which provided a useful interface for pyodide also but introduced a [list of drawbacks](#pyscript-drawbacks) in the process.

Similarly to PyScripts [`<py-env>`](https://anaconda.cloud/api/files/803653a5-9b1e-41d4-a9ee-76c64b8d6cb4), [`<py-script>`](https://anaconda.cloud/api/files/c57a6ef0-dbb7-43da-acd9-94a781ef2673) and [`<py-repl>`](https://pyscript.net/examples/repl.html) tags, 
Pyjamas provides the following tags:

 - [`<pyjamas-env>`](#pyjamas-env)
 - [`<pyjamas-script>`](#pyjamas-script)
 - [`<pyjamas-editor>`](#pyjamas-editor)
 - [`<pyjamas-repl>`](#pyjamas-repl)

## Try It
<script  src="https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js"></script> 
       <script defer src="https://codemirror.net/mode/python/python.js"></script>  
        <link rel="stylesheet" href = "https://codemirror.net/lib/codemirror.css"/> 
        <script src="https://codemirror.net/lib/codemirror.js"></script> 
        <style> .CodeMirror { border: 1px solid #eee; height: auto; } </style>  
        <script src="./pyjamas.js"></script>
        <pyjamas-script>
            from js import document
            from datetime import datetime
            document.getElementByID("date").innerHTML = datetime.now().isoformat()
        </pyjamas-script>
        <div id="date"></div>
        <pyjamas-editor>
            import js # provides interface to WebAPIs such as document, window, alert, etc
            
            import time # import Python builitins
            
            import numpy as np # import packages from standard library
            
            print("this will show up in the Developer Console because `stdout` has been piped to `console.log` via `pyjamas.stdout = console.log`")
            
            js.document.body.style["background-color"] = "green"
            time.sleep(1)
            js.document.body.style["background-color"] = ""
            
            x = np.random.rand(5)
            
            x
        </pyjamas-editor>
        <pyjamas-repl></pyjamas-repl>

## The Code
```html
<!DOCTYPE html>
<html lang="en">
    <head>  
        <!-- import Pyodide-->
        <script  src="https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js"></script> 
        
        <!-- import CodeMirror to make pyjamas-editor prettier (not necessary-->
        <script defer src="https://codemirror.net/mode/python/python.js"></script>  
        <link rel="stylesheet" href = "https://codemirror.net/lib/codemirror.css"/> 
        <script src="https://codemirror.net/lib/codemirror.js"></script> 
        <style> .CodeMirror { border: 1px solid #eee; height: auto; } </style>  
    
        <!-- import Pyjamas -->
        <script src="./pyjamas.js"></script>
    </head>
    <body>
        <pyjamas-script>
            from js import document
            from datetime import datetime
            document.getElementByID("date").innerHTML = datetime.now().isoformat()
        </pyjamas-script>
        <div id="date"></div>
        <pyjamas-editor>
            import js # provides interface to WebAPIs such as document, window, alert, etc
            
            import time # import Python builitins
            
            import numpy as np # import packages from standard library
            
            print("this will show up in the Developer Console because `stdout` has been piped to `console.log` via `pyjamas.stdout = console.log`")
            
            js.document.body.style["background-color"] = "green"
            time.sleep(1)
            js.document.body.style["background-color"] = ""
            
            x = np.random.rand(5)
            
            x
        </pyjamas-editor>
        <pyjamas-repl></pyjamas-repl>
    </body>
</html>
```



## Import
Pyjamas is dependant on **Pyodide**. 
**CodeMirror** is also used for styling the editor, but is not necessary.
```html
<head>  
	<!-- import Pyodide-->
	<script  src="https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js"></script> 
	
	<!-- import CodeMirror to make pyjamas-editor prettier (not necessary-->
	<script defer src="https://codemirror.net/mode/python/python.js"></script>  
	<link rel="stylesheet" href = "https://codemirror.net/lib/codemirror.css"/> 
	<script src="https://codemirror.net/lib/codemirror.js"></script> 
	<style> .CodeMirror { border: 1px solid #eee; height: auto; } </style>  

	<!-- import Pyjamas -->
	<script src="./pyjamas.js"></script>
</head>
 ```
 
## Pyjamas-Env
The `<pyjamas-env>` tag allows you to load libraries using [pyodide.loadPackage](https://pyodide.org/en/stable/usage/api/js-api.html#pyodide.loadPackage) function. Accepted inputs are either innerHTML or a `src` attribute linking to a file like a `requirements.txt`. 

The package names are selected from the text using the [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) `/\s*-?\s*(.*?)\s*[==[0-9|.]*]?\s*[,|;|\n]/g`

**note**: *the `==version` syntax used by `pip freeze` is ignored by the RegExp above, so specifying versions will not cause an error, but will not actually load that particular version, because this is not supported by pyodide*

#### examples

 ```html
 <pyjamas-env>
	- numpy
	- datetime
</pyjamas-env>
```
```html
 <pyjamas-env src="./requirements.txt"></pyjamas-env>
 ```
 
 ## Pyjamas-Script
 The `<pyjamas-script>` tag allows you to run Python code using [`pyodide.loadPackageFromImports`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=loadpac#pyodide.loadPackagesFromImports) followed by [`pyodide.runPythonAsync`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=runpythona#pyodide.runPythonAsync). Accepted inputs are either innerHTML or a `src` attribute linking to a python file.

#### examples
 ```html
 <pyjamas-script src="./my-script.py"></pyjamas-script>
```
```html
 <pyjamas-script id="testScript">
	 from js import document
	 import datetime
	 
	 el = document.getElementById("testScript")
	 el.style.display = "block"
	 el.innerText = str(datetime.datetime.now().isoformat())
</pyjamas-script>
```
<pyjamas-script id="testScript" style="display:none">
  from js import document
  import datetime
	 
  el = document.getElementById("testScript")
  el.style.display = "block"
  el.innerText = str(datetime.datetime.now().isoformat())
</pyjamas-script>

## Pyjamas-Editor
 The `<pyjamas-editor>` tag is similar to the  `<pyjamas-script>` tag, except instead of executing as soon as possible when the page is loaded, the tag provides a [CodeMirror](https://codemirror.net/6/) text editor element and does not execute until the gutter start button has been pressed. Then, the editor runs the code, streaming STDOUT and STDERR to the console, and the displays the result as a string in the editor. Additionally, the element can be reset and the code can be modified and rerun.
 
 #### examples
 ```html
 <pyjamas-editor>
	 import numpy as np
	np.random.rand(5)
</pyjamas-editor>
```
<pyjamas-editor>
    import numpy as np
	np.random.rand(5)
</pyjamas-editor>

## Pyjamas-Repl
 The `<pyjamas-repl>` tag provides a minimal terminal emulator to play around with `pyodide`. It does the very basics and nothing more (no special color strings, no plots, etc.). It can be styled, but that is about it.
 
 [Pyodide's own console](https://pyodide.org/en/stable/console.html)  has much more support.

#### examples
```html
<pyjamas-repl></pyjamas-repl>
```
```html
<pyjamas-repl rows="10" cols="80" style="background-color:dark green; color:#fff"></pyjamas-repl>
```
<pyjamas-repl rows="10" cols="80" style="background-color:dark green; color:#fff"></pyjamas-repl>


## Pyodide
[**Pyodide**](https://pyodide.org/en/stable/) is a super cool project which runs a [**CPython interpreter**](https://en.wikipedia.org/wiki/CPython) in the browser using [**WebAssembly**](https://webassembly.org/) and provides access to [**WebAPIs**](https://developer.mozilla.org/en-US/docs/Web/API) ( such as `window`, `document`, etc. ) and all of you **javascript** objects, functions, etc. from **Python** and vice-versa. **Pyodide** provides `~99.9%` of the utility of **Pyjamas**.

**Pyodide** is a great foundation  with cool features, [**great documentation**](https://pyodide.org/en/stable/) and lots of potential use cases mostly related to:

 - offloading computations to browsers to reduce server resources
 - speeding up slow client-side computations (especially ones which can be [vectorized](https://www.intel.com/content/www/us/en/developer/articles/technical/vectorization-a-key-tool-to-improve-performance-on-modern-cpus.html)) 
 - distributing research and data analysis documents (this was the goal of the now-deprecated [Iodide Project](https://github.com/iodide-project/iodide) from which Pyodide originated)
 - allowing Python developers to dabble in web development a bit easier

Pyodide's main drawback is load time, with initial load time often taking ~2-6 seconds.
  
  ## PyScript
**Pyjamas** is heavily inspired by [**PyScript**](https://pyscript.net/), a project recently endorsed by [Anaconda](https://anaconda.cloud/pyscript-python-in-the-browser) (May 2022), which is built on top of Pyodide and attempts to make Pyodide easier to use by providing [custom HTML tags](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_custom_elements) such as `py-env`, `py-script` and `py-repl` and by allowing users to easily displayplots and graphs using [matplotlib](https://matplotlib.org/3.5.0/gallery/index.html) and other similar popular Python Libraries.

### PyScript drawbacks
Unfortunately, [**PyScript**](https://pyscript.net/) has more drawbacks than features:
 - very slow load times (10-30s)
 - poor documentation
 -  poorly maintained: As of 5/14/2022, the [Hello World example](https://pyscript.net/examples/hello_world.html) for PyScript does not even work
 - the `pyodide` object which Pyscript is based off of is not easily provided to the user as a `window` variable, `loadPyodide()` does not allow reloading of the `pyodide` object, and no documented interface to `pyodide` is provided, meaning the user loses out on most of pyodide's javascript API and versatility


Pyscript seems to be so focused on making web development "accessible" to Python developers, that they ended up removing most of the Pyodide functionality developers are looking for and instead made a **slow, bulky, buggy, front-end version of a [Jupyter notebook](https://jupyter.org/).**


 
 