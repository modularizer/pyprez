# Welcome to **Pyjamas!**
  
 **Pyjamas** is a minimal script to help you get started playing around with [**Pyodide**](#pyodide), which allows you to run **front-end Python** through **WebAssembly** and easily interact between Python, javascript and HTML.  In fact, >99% of the functionaly of **Pyjamas** comes directly from pyodide object, which is made available at `window.pyodide`.

Pyjamas is inspired [**Pyscript**](#pyscript), a project backed by Anaconda which provided a useful interface for pyodide also but introduced a [list of drawbacks](#pyscript-drawbacks) in the process.

Similarly to PyScript's [`<py-env>`](https://anaconda.cloud/api/files/803653a5-9b1e-41d4-a9ee-76c64b8d6cb4), [`<py-script>`](https://anaconda.cloud/api/files/c57a6ef0-dbb7-43da-acd9-94a781ef2673) and [`<py-repl>`](https://pyscript.net/examples/repl.html) tags, 


QuickLinks:
- [Try It @ https://modularizer.github.io/pyjamas/](https://modularizer.github.io/pyjamas/#try-it)
- [The Code](#the-code)
- [Pyjamas Tags](#pyjamas-tags):
 	- [`<pyjamas-editor>`](#pyjamas-editor)
 	- [`<pyjamas-repl>`](#pyjamas-repl)
 	- [`<pyjamas-env>`](#pyjamas-env)
 	- [`<pyjamas-script>`](#pyjamas-script)
 - [Pyjamas API](#pyjamas-api)
 	- [`pyjamas.then/catch`](#thencatch)
 	- [`pyjamas.loadAndRunAsync`](#loadandrunasync)
 	- [`pyjamas.stdout/stderr`](#stdoutstderr)
 - [About Pyodide](#pyodide)
 - [About PyScript](#pyscript)


## Try It
[View in GitHub Pages](https://modularizer.github.io/pyjamas/)
<div id="tryitContainer0"></div>
<pyjamas-repl rows="8" cols="80"></pyjamas-repl>

## The Code
Pyjamas' only dependency is [**Pyodide**](#pyodide). 
[CodeMirror](https://codemirror.net/6/) is also used for styling the editor, but is not entirely necessary and all features will still function if it is not included.

```html
<head>  
	<!-- import Pyodide-->
	<script  src="https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js"></script> 
	
	<!-- import Pyjamas -->
	<script src="https://modularizer.github.io/pyjamas//pyjamas.js"></script>
	
	<!-- import CodeMirror to make pyjamas-editor prettier (not necessary-->
	<script defer src="https://codemirror.net/mode/python/python.js"></script>  
	<link rel="stylesheet" href = "https://codemirror.net/lib/codemirror.css"/> 
	<script src="https://codemirror.net/lib/codemirror.js"></script> 
	<style> .CodeMirror { border: 1px solid #eee; height: auto; } </style>  
</head>
<body>
	<pyjamas-editor>
	    import js # provides interface to WebAPIs such as document, window, alert, etc

	    import time # import Python builitins

	    import numpy as np # import packages from standard library

	    print("this will show up in the Developer Console because `stdout` has been piped to `console.log` via `pyjamas.stdout = console.log`")

	    x = np.random.rand(5)
	    js.alert(x.tolist())

	    x
	</pyjamas-editor>
	<pyjamas-repl rows="8" cols="80"></pyjamas-repl>
</body>
```

# Pyjamas Tags
## Pyjamas-Editor
 The `<pyjamas-editor>` tag is similar to the  `<pyjamas-script>` tag, except instead of executing as soon as possible when the page is loaded, the tag provides a [CodeMirror](https://codemirror.net/6/) text editor element and does not execute until the gutter start button has been pressed. Then, the editor runs the code, streaming STDOUT and STDERR to the console, and the displays the result as a string in the editor. Additionally, the element can be reset and the code can be modified and rerun.
 
 By default, the `<pyjamas-editor>` tag evaulates Python in pyodide's CPython interpreter, but if the `language` attribute is set to "javascript" or if the src
 address ends with `.js`, the editor will run the code in javascript instead.
 
 #### examples
 ```html
 <pyjamas-editor>
	 import numpy as np
	np.random.rand(5)
</pyjamas-editor>
```
<div id="editorContainer"></div>

```html
pyjamas.loadAndRunAsync(`
	from js import alert
	alert('pyodide object has loaded and is available at window.pyodide')
`)
```
<div id="jseditor0"></div>


## Pyjamas-Repl
 The `<pyjamas-repl>` tag provides a minimal terminal emulator to play around with `pyodide`. It does the very basics and nothing more (no special color strings, no plots, etc.). It can be styled, but that is about it.
 
 [Pyodide's own console](https://pyodide.org/en/stable/console.html)  has much more support.

#### examples
```html
<pyjamas-repl></pyjamas-repl>
```
```html
<pyjamas-repl rows="10" cols="80"></pyjamas-repl>
```
<pyjamas-repl rows="10" cols="80"></pyjamas-repl>

 
## Pyjamas-Env
The `<pyjamas-env>` tag allows you to load libraries using [pyodide.loadPackage](https://pyodide.org/en/stable/usage/api/js-api.html#pyodide.loadPackage) function. Accepted inputs are either innerHTML or a `src` attribute linking to a file like a `requirements.txt`. This tag is not totally necessary because the `pyjamas.loadAndRunAsync` function handles loading package dependencies via [`pyodide.loadPackageFromImports`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=loadpac#pyodide.loadPackagesFromImports).

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
 The `<pyjamas-script>` tag allows you to run Python code using `pyjamas.loadAndRunAsync`, which uses [`pyodide.loadPackageFromImports`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=loadpac#pyodide.loadPackagesFromImports) followed by [`pyodide.runPythonAsync`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=runpythona#pyodide.runPythonAsync). Accepted inputs are either innerHTML or a `src` attribute linking to a python file.

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
<div id="scriptContainer"></div>

# Pyjamas API
## then/catch
When `pyjamas.js` loads, the `pyjamas` object (available at `window.pyjamas`) creates a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) at `pyjamas.promise`, which then resolves with the `pyodide` object when [`loadPyodide`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=loadPyodide#globalThis.loadPyodide) finishes loading the `pyodide` object.

`pyjamas.then` and `pyjamas.catch` are simply shortcuts to `pyjamas.promise.then` and `pyjamas.promise.catch`. Therefore, `pyjamas.then` can be use be sure that pyodide has finished loading, then use it as soon as possible.

#### example
```html
pyjamas.then(pyodide => pyodide.runPythonAsync(`
	from js import alert
	alert("pyodide object has loaded and is available at window.pyodide")
`))
```
<div id="thencatch"></div>

## loadAndRunAsync
The `pyjamas.loadAndRunAsync` function is an asynchronous utility function which immediately returns a PRomise to the result of some Python code, which gets
evaluated as soon as possible. It works by doing does three things:
- waits for pyodide to finish loading by using [`pyjamas.then`](#then/catch)
- loads any packages the code snippet requires, by using [`pyodide.loadPackagesFromImports`](#https://pyodide.org/en/stable/usage/api/js-api.html?highlight=loadpackagesfromimports#pyodide.loadPackagesFromImports)
- runs python in pyodide's [CPython interpreter](https://en.wikipedia.org/wiki/CPython) using [WebAssembly](https://webassembly.org/) via [`pyodide.runPythonAsync`](https://pyodide.org/en/stable/usage/api/js-api.html?highlight=runPythonAsync#pyodide.runPythonAsync)

#### example
```html
pyjamas.loadAndRunAsync(`
	from js import alert
	alert("pyodide object has loaded and is available at window.pyodide")
`)
```
<div id="loadandrunasync"></div>

## stdout/stderr
Pyjamas automatically set up `stdout` to be handled by `console.log` and `stderr` to be handled by `console.err` by setting configuration options in `loadPyodide`.
However, `pyjamas.stdout` and `pyjamas.stderr` functions can be set to whatever handler you want.

### example
```html
function appendText(m, color="#000"){
	let el = document.createElement("div")
	el.innerText = m
	el.style.color = color
	document.body.append(el)
}
pyjamas.stdout = appendText
pyjamas.stderr = m => appendText(m, "red")

pyjamas.loadAndRunAsync(`
for i in range(10):
	print(10)
raise Exception("testing stderr")
`)
```
<div id="stdoutstderr"></div>


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


 <details style="display:none">
	<summary>Scripts which make GitHub Pages page interactive</summary>
	<script  src="https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js"></script> 
	<script defer src="https://codemirror.net/mode/python/python.js"></script>  
	<link rel="stylesheet" href = "https://codemirror.net/lib/codemirror.css"/> 
	<script src="https://codemirror.net/lib/codemirror.js"></script> 
	<style> .CodeMirror { border: 1px solid #eee; height: auto; } </style>  
	<script src="https://modularizer.github.io/pyjamas/pyjamas.js"></script>
	<script src="https://modularizer.github.io/pyjamas/readmeExamples.js"></script>
</details>
 
