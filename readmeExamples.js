// add examples that normal github markdown blocks

let el = document.createElement("pyjamas-script")
el.id = "testScript"
el.innerHTML = `
    from js import document
    import datetime

    el = document.getElementById("testScript")
    el.style.display = "block"
    el.innerText = str(datetime.datetime.now().isoformat())
`
document.getElementById("scriptContainer").append(el)



let editors = {
	tryitContainer0: `
import js # provides interface to WebAPIs such as document, window, alert, etc

import time # import Python builitins

import numpy as np # import packages from standard library

print("this will show up in the Developer Console because 'stdout' has been piped to 'console.log' via 'pyjamas.stdout = console.log'")

x = np.random.rand(5)
js.alert(x.tolist())

x
`,
	editorContainer: `
import numpy as np
np.random.rand(5)
`
}

for (let [id, code] of Object.entries(editors)){
    let el = document.createElement("pyjamas-editor")
    el.innerHTML = code
    document.getElementById(id).append(el);
}

let jsEditors = {
	jseditor0:
"pyjamas.loadAndRunAsync(`\n"+
"	from js import alert\n"+
"	alert('pyodide object has loaded and is available at window.pyodide')\n"+
"`)",
	thencatch:
"pyjamas.then(pyodide => pyodide.runPythonAsync(`\n"+
"	from js import alert\n"+
"	alert('pyodide object has loaded and is available at window.pyodide')\n"+
"`))",
	loadandrunasync:
"pyjamas.loadAndRunAsync(`\n"+
"	from js import alert\n"+
"	alert('pyodide object has loaded and is available at window.pyodide')\n"+
"`)",
	stdoutstderr:
'function appendText(m, color="#000"){\n'+
'	let el = document.createElement("div")\n'+
"	el.innerText = m\n"+
"	el.style.color = color\n"+
"	document.body.append(el)\n"+
"}\n"+
"pyjamas.stdout = appendText\n"+
"pyjamas.stderr = m => appendText(m, "red")\n"+
"\n"+
"pyjamas.loadAndRunAsync(`\n"+
"for i in range(10):\n"+
"	print(10)\n"+
"raise Exception("testing stderr")\n"+
"`)"
}

for (let [id, code] of Object.entries(jsEditors)){
    let el = document.createElement("pyjamas-editor")
    el.innerHTML = code
    el.setAttribute("language", "javascript")
    document.getElementById(id).append(el);
}