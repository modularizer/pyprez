/*
Pyodide is undeniably cool, and useful in niche cases. Pyscript is easy to use, but is bulky, slow, not especially
easy to develop on, and is not really necessary seeing as 95+% of its utility comes from Pyodide. With Pyprez,
99.9+% of utility comes from Pyodide. We're not claiming to do anything better, its just a simple script to get you
started with exploring Pyodide's capabilities.

This js file will import pyodide and codemirror dependencies for you, so all you need to do is import this
<script src="https://modularizer.github.io/pyprez/pyprez.js" mode="editor">
    import numpy as np
    print("testing")
    np.random.rand(5)
</script>
*/
/* ___________________________________________ INTERPRET SCRIPT TAG _________________________________________________ */
// first manipulate the contents of the script tag

// first hide the innerHTML of the <script> tag
document.currentScript.display = "none";

// if the user is using the script tag as a code block, add a real code block to the document
if (document.currentScript.innerHTML){
    // add a github link
    let a = document.createElement("a");
    a.href="https://modularizer.github.io/pyprez"
    a.innerHTML = `<img src="https://github.com/favicon.ico" height="15px"/>`
    document.body.append(a);

    // add a real pyprez custom-element
    let mode = document.currentScript.getAttribute("mode")
    mode = mode?mode:"editor";
    let el = document.createElement("pyprez-" + mode);
    el.innerHTML = document.currentScript.innerHTML;
    document.body.append(el);

    // remove script content
    document.currentScript.innerHTML = ""
}
/* ___________________________________________ LOAD DEPENDENCIES ____________________________________________________ */
var dependenciesEnabled = true;
if (location.hash.includes("skipdep") || location.search.includes("skipdep") || document.currentScript.hasAttribute("skipdep")){
    dependenciesEnabled = false;
}

// list dependencies
let criticalJsDependencies = [["https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js", ()=>window.loadPyodide]]
let jsDependencies = [
["https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.32.0/codemirror.min.js", ()=>window.CodeMirror],
["https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.32.0/mode/python/python.min.js",
()=>{
    if (!window.CodeMirror){return false}
    if (!window.CodeMirror.modes){return false}
    if (!window.CodeMirror.modes.python){return false}
    return true
}]
]
let cssDependencies = [["https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.32.0/codemirror.min.css", ()=>false]]
// TODO: import custom codemirror themes and allow selecting theme

// tool to add css to document
let addStyle = s=> {
    let style = document.createElement("style");
    style.innerHTML = s;
    document.head.appendChild(style);
}

// tools to import js dependencies
function importScript(url, complete=()=>false){
    let el = document.createElement("script");
    el.src = url;
    return new Promise((resolve, reject)=>{
        if (!complete()){
            document.addEventListener('DOMContentLoaded', ()=>{
                document.body.appendChild(el)
                el.addEventListener("load", ()=>resolve(url))
            })
        }else{
            resolve(url)
        }
    })
}

// function to get the text of css dependencies
let get = src => fetch(src).then(r=>r.text())

// add our custom style
addStyle(".CodeMirror { border: 1px solid #eee !important; height: auto !important; }")

function loadDependencies(){
    return new Promise((resolve, reject)=>{
        if (!dependenciesEnabled){
            resolve();
            return
        }

        let numCriticalComplete = 0;
        let numComplete = 0;
        let resolved = 0;
        let res = ()=>{
            if (!resolved){
                resolve();
            }
        }
        let finished = (url)=>{
            console.warn(url)
            numComplete +=1;
            if (criticalJsDependencies.includes(url)){
                numCriticalComplete += 1;
                if (numCriticalComplete == (criticalJsDependencies.length)){
                    setTimeout(res, 2000);
                }
            }
            if (numComplete === (criticalJsDependencies.length + jsDependencies.length + cssDependencies.length)){
                setTimeout(res, 1000)
            }
        }
        criticalJsDependencies.map(([src, complete])=>importScript(src, complete).then(finished))
        jsDependencies.map(([src, complete])=>importScript(src, complete).then(finished))
        cssDependencies.map(([src, complete]) => get(src).then(addStyle).then(()=>finished(src)))
    })
}

var loaded = loadDependencies();

/* ___________________________________________ CONFIGURE DEBUG ______________________________________________________ */
var PYPREZ_DEBUG = true // whether to log to console.debug or not
function pyprezDebug(){
    if (PYPREZ_DEBUG){
        console.debug(...arguments)
    }
}
if (PYPREZ_DEBUG){ // if debugging, start some timers
    console.time("pyprez-import load") // time how long it takes the pyprez environment to load (relative to when this script is run)
    console.time("pyodide load") // time how long it takes the pyodide object to load(relative to when this script is run)
}

/* _______________________________________ LOAD AND EXTEND PYODIDE FUNCTIONALITY ____________________________________ */
class PyPrez{
    /*class which loads pyoidide and provides utility to allow user to load packages and run code as soon as possible
    examples:
        var pyprez = new Pyprez();

        // use pyodide as soon as it loads
        let promiseToFour = pyprez.then(pyodide => {
                console.log("pyodide has loaded");
                return pyodide.runPython("2+2")
            });

        // load dependencies and run some code as soon as it loads
        let promiseToRandom = pyprez.loadAndRunAsync(`
                import numpy as np
                np.random.rand(5)
            `);

        //reroute stdout to a new javascript function
        pyprez.stdout = alert;
        pyprez.loadAndRunAsync(`print("testing if this alerts on window")`);
    */
    constructor(config={}){
        // bind the class methods to this instance
        this.load = this.load.bind(this);
        this.loadAndRunAsync = this.loadAndRunAsync.bind(this);

        // create a deferred promise that will be resolved later with the pyodide object
        this.promise = new Promise((resolve, reject)=>{this._resolvePromise = resolve; this._rejectPromise = reject;})

        // load pyodide and resolve the promise
        this._loadPyodide(config);
    }
    
    // set the functions that will handle stdout, stderr from the python interpreter
    stdout = console.log
    stderr = console.error

    // utility methods used to load requirements and run code asynchronously as soon as pyodide is loaded
    load(code, requirements="detect"){
        /*load required packages as soon as pyodide is loaded*/
        return this.then(pyodide =>{
            let requirementsLoaded;
            if (requirements === "detect"){
                if (code){
                    pyprezDebug("auto loading packages detected in code")
                    pyprezDebug(code)
                    requirementsLoaded = pyodide.loadPackagesFromImports(code)
                }
            }else{
                pyprezDebug("loading", requirements)
                requirementsLoaded = pyodide.loadPackage(requirements);
            }
            return requirementsLoaded
        })
    }
    loadAndRunAsync(code, requirements="detect"){
        /* run a python script asynchronously as soon as pyodide is loaded and all required packages are imported*/
        return this.then(pyodide =>{
            if (code){
                return this.load(code, requirements)
                    .then(r => this._runPythonAsync(pyodide, code))
                    .catch(e => this._runPythonAsync(pyodide, code))
            }
        })
    }
    _runPythonAsync(pyodide, code){
        if (code){
            pyprezDebug("running code asynchronously:")
            pyprezDebug(code)
            return pyodide.runPythonAsync(code)
        }
    }

    // allow pyprez object to act a bit like a the promise to the pyodide object
    then(successCb, errorCb){return this.promise.then(successCb, errorCb)}
    catch(errorCb){return this.promise.catch(errorCB)}

    _loadPyodide(config={}){
        /*load pyodide object once pyodide*/
        loaded.then((()=>{
            // setup the special config options to load pyodide with
            let defaultConfig = {
                stdout: (t=>{this.stdout(t)}).bind(this),
                stderr: (t=>{this.stderr(t)}).bind(this),
            }
            config = Object.assign(defaultConfig, config)

            // load pyodide then resolve or reject this.promise
            loadPyodide(config).then(this._resolvePromise).catch(this._rejectPromise);
        }).bind(this))


        this.then(this._onload.bind(this));
        return this._pyodidePromise
    }
    _onload(pyodide){
        /*set the window variable and the class attribute of pyodide as soon as pyodide is loaded*/
        if (PYPREZ_DEBUG){
            console.timeEnd("pyodide load");
        }
        window.pyodide = pyodide;
        this.pyodide = pyodide;
    }
}
var pyprez = new PyPrez();

/* ___________________________________________________ ENV ___________________________________________________ */
class PyPrezImport extends HTMLElement{
    /*
    custom element with the <pyprez-import></pyprez-import> tag which is used to load required packages into pyodide

    examples:
        <pyprez-import>
            numpy
            matplotlib
        </pyprez-import>
        <pyprez-import>
            -scipy
            -asyncio
        </pyprez-import>
        <pyprez-import src="requirements.txt"></pyprez-import>
    */
    constructor(){
        super();
        this.classList.add("pyprez");
        this.style.display = "none";
        let requirements = [...this.innerText.matchAll(this.re)].map(v=>v[1]);
        if (requirements.length){
            pyprezDebug("importing requirements ", requirements, " from <pyprez-import/>", this)
            pyprez.then(pyo=>pyo.loadPackage(requirements)).then(()=>{
                if (PYPREZ_DEBUG){
                    console.timeEnd("pyprez-import load")
                }});
        }
    }
    re = /\s*-?\s*(.*?)\s*[==[0-9|.]*]?\s*[,|;|\n]/g
}
window.addEventListener("load", ()=>{
    customElements.define("pyprez-import", PyPrezImport);
})

/* ___________________________________________________ SCRIPT ___________________________________________________ */
class PyprezScript extends HTMLElement{
    /*
    custom element which loads required packages and runs a block of python code in the pyodide interpreter

    example:
        <pyprez-script>
            import numpy as np
            np.random.rand(5)
        </pyprez-script>
        <pyprez-script src="my-script.py"></pyprez-script>
    */
    constructor(){
        super();
        this.classList.add("pyprez");
        this.style.display = "none";
        this.run = this.run.bind(this);
        if (this.hasAttribute("src") && this.getAttribute("src")){
            pyprezDebug("fetching script for pyprez-script src", this.getAttribute("src"))
            fetch(this.getAttribute("src")).then(r=>r.text()).then(this.run)
        }else{
            this.run(this.innerHTML);
        }
    }
    run(code){
        pyprezDebug("running code from <pyprez-script>", code, this)
        this.innerHTML = code;
        this.promise = pyprez.loadAndRunAsync(code).then(v=>this.value=v?v.toString():"")
        return this.promise
    }
}
window.addEventListener("load", ()=>{
    customElements.define("pyprez-script", PyprezScript);
})

/* ___________________________________________________ EDITOR ___________________________________________________ */
class PyprezEditor extends HTMLElement{
    /*
    custom element which allows editing a block of python code, then when you are ready, pressing run to
    load required packages and run the block of python code in the pyodide interpreter and see the result

    example:
        <pyprez-editor>
            import numpy as np
            np.random.rand(5)
        </pyprez-editor>
        <pyprez-editor src="my-script.py"></pyprez-editor>
    */
    constructor(){
        super();
        this.classList.add("pyprez");
        this.loadEl = this.loadEl.bind(this);
        this.loadEditor = this.loadEditor.bind(this);
        this.language = "python"
        if (this.hasAttribute("language") && this.getAttribute("language")){
            this.language = this.getAttribute("language").toLowerCase()
        }
        if (!this.hasAttribute("stdout")){
            this.setAttribute("stdout", "true")
        }
        let aliases = {
            "py": "python",
            "js": "javascript"
        }
        if (aliases[this.language]){
            this.language = aliases[this.language]
        }

        if (this.hasAttribute("src") && this.getAttribute("src")){
            let src = this.getAttribute("src")
            pyprezDebug("fetching script for pyprez-editor src", src)
            if (src.endsWith('.js')){
                this.language = "javascript"
            }
            fetch(src).then(r=>r.text()).then(code =>{
                this.innerHTML = code;
                this.loadEl();
            })
        }else{
            this.loadEl();
        }
        this.addEventListener("keydown", this.keypressed.bind(this))
    }
    keypressed(e){
        if (e.shiftKey){
            if (e.key == "Enter"){this.run(); e.preventDefault();}
            else if (e.key == "Backspace"){this.reset(); e.preventDefault();}
        }
    }
    loadEl(){
        let lines = this.innerHTML.replaceAll("\t","    ").split("\n")
        let indent = " ".repeat(Math.min(...lines.filter(v=>v).map(v=>v.match(/\s*/)[0].length)));
        let code = lines.map(v=>v.startsWith(indent)?v.replace(indent, ""):v).join("\n")
        this.initialCode = code;
        console.log("initial code", this.initialCode)
        this.innerHTML = `<pre>${code}</pre>`
        this.loadEditor();
    }
    loadEditor(){
        this._loadEditor();
        if (!window.CodeMirror){
            let imports = Array.from(document.getElementsByTagName("script")).filter(el => el.src.endsWith("codemirror.js"))
            if (imports.length){
                imports[0].addEventListener("load", this._loadCodeMirror.bind(this))
            }
        }else{
            this._loadCodeMirror();
        }
    }
    _loadEditor(){
        this.innerHTML = `
        <div style="color:green">➤</div>
        <textarea style="height:auto;width:auto;">${this.initialCode}</textarea>
        `
        this.start = this.children[0]
        this.textarea = this.children[1]
        this.textarea.style.height = this.textarea.scrollHeight +"px"

        console.log("initial code", this.initialCode.split("\n").map(v=>v.length).reduce((a,b)=>a>b?a:b))
        let longestLine = this.initialCode.split("\n").map(v=>v.length).reduce((a,b)=>a>b?a:b)
        let fontSize = 1 * window.getComputedStyle(this.textarea).fontSize.slice(0,-2)
        let w = Math.ceil(longestLine * fontSize * 0.7)
        console.log(longestLine, fontSize, w + "px")
        this.textarea.style.width = w  + "px"
        console.log(this.textarea.style.width, this.textarea)

        this.loadPackages();
        this.start.addEventListener("click", this.startClicked.bind(this))
        if (window.CodeMirror){
        }
    }
    _loadCodeMirror(){
        this.editor = CodeMirror.fromTextArea(this.textarea, {
            lineNumbers: true,
            mode: this.language,
            viewportMargin: Infinity,
            gutters: ["Codemirror-linenumbers", "start"],
        });
        this.editor.on("keydown", this.loadPackages.bind(this));
        this.editor.doc.setGutterMarker(0, "start", this.start);
    }
    get code(){
        return this.editor?this.editor.getValue():this.textarea.value
    }
    set code(v){
        if (this.editor){
            this.editor.setValue(v);
            this.editor.doc.setGutterMarker(0, "start", this.start);
        }else{
            this.textarea.value = v;
        }
    }
    numImports = 0;
    loadPackages(){
        let code = this.code;
        let n = code.match(/import/g);
        if (n && n.length !== this.numImports){
            this.numImports = n.length;
            pyprez.load(this.code);
        }
    }
    executed = false
    startClicked(){
        if (!this.executed){
            this.run();
        }else{
            this.reload();
        }
    }
    run(){
        if (this.code && !this.executed){
            this.executed = this.code;
            let code = this.code;
            let promise;
            if (this.language == "python"){
                this.code += "____________________________________\n";
                if (this.getAttribute("stdout") === "true"){
                    this.attachStd();
                }

                promise = pyprez.loadAndRunAsync(code);
                promise.then(r=>{
                    this.code += "\n>>> " + (r?r.toString():"");
                    this.start.style.color = "red";
                    this.start.innerHTML = "↻";
                    if (this.getAttribute("stdout") === "true"){
                        this.detachStd();
                    }
                    return r
                })
            }else if (this.language == "javascript"){
                let r = eval(code)
                this.code += "\n>>> " + JSON.stringify(r, null, 2);
                this.start.style.color = "red";
                this.start.innerHTML = "↻";
                return r
            }
        }

    }
    appendLine(v){
        this.code += "\n" + v
    }
    attachStd(){
        this.oldstdout = pyprez.stdout
        this.oldstderr = pyprez.stderr
        pyprez.stdout = this.appendLine.bind(this)
        pyprez.stderr = this.appendLine.bind(this)
    }
    detachStd(r){
        pyprez.stdout = this.oldstdout
        pyprez.stderr = this.oldstderr
        return r
    }
    reload(){
        this.start.innerHTML = "➤";
        this.start.style.color = "green";
        this.code = this.executed;
        this.executed = false;
    }
}
window.addEventListener("load", ()=>{
    customElements.define("pyprez-editor", PyprezEditor);
})

/* ___________________________________________________ Console ___________________________________________________ */
class PyPrezConsole extends HTMLElement{
    /*
    simple and customizable Python REPL terminal emulator

    examples:
        <pyprez-console></pyprez-console>
        <pyprez-console style="background-color:yellow;color:black"></pyprez-console>
    */
    constructor(){
        super();
        this.classList.add("pyprez");
        this.attachStd = this.attachStd.bind(this)
        this.detachStd = this.detachStd.bind(this)
        this.id = 'console' + Math.floor(10000*Math.random())
        let cols = this.hasAttribute("cols")?this.getAttribute("cols"):120
        let rows = this.hasAttribute("rows")?this.getAttribute("rows"):20
        let bg = this.style["background-color"]?this.style["background-color"]:"#000"
        let c = this.style["color"]?this.style["color"]:"#fff"


        this.language = "python"
        if (this.hasAttribute("language") && this.getAttribute("language")){
            this.language = this.getAttribute("language").toLowerCase()
        }
        let aliases = {
            "py": "python",
            "js": "javascript"
        }
        if (aliases[this.language]){
            this.language = aliases[this.language]
        }

        this.innerHTML = `<textarea cols="${cols}" rows="${rows}" style="background-color:${bg};color:${c};height:100%;"></textarea>`
        this.textarea = this.children[0]
        this.printResult = this.printResult.bind(this);
        this.eval = this.eval.bind(this);

        if (this.language === "python"){
            pyprez.loadAndRunAsync(`
                import sys
                s = f"""Python{sys.version}
                Type "help", "copyright", "credits" or "license" for more information."""
                s
            `).then(v=>{this.text = v + "\n>>> "})
        }else if (this.language === "javascript"){
            this.text += "Simple Javascript Console\n>>> "
        }

        this.textarea.addEventListener("keydown", this.keydown.bind(this))
    }
    startup(){
        let code = `
            import sys
            s = f"""Python{sys.version}
            Type "help", "copyright", "credits" or "license" for more information."""
            s
        `
        pyprez.loadAndRunAsync(code).then(this.print)
    }
    get text(){return this.textarea.value}
    set text(v){this.textarea.value = v}
    appendLine(v){
        this.text += "\n" + v
    }
    print(v){
        this.text += v;
        this.appendLine(">>> ");
    }
    printResult(r){
        let res;
        if (this.language === "python"){
            res = r?r.toString():""
        }else{
             res = JSON.stringigy(r, null, 2)
        }
        if (!this.text.endsWith("\n")){this.text += "\n"}
        this.print("[Out] " + res)
        return res
    }
    attachStd(){
        this.oldstdout = pyprez.stdout
        this.oldstderr = pyprez.stderr
        pyprez.stdout = this.appendLine.bind(this)
        pyprez.stderr = this.appendLine.bind(this)
    }
    detachStd(r){
        pyprez.stdout = this.oldstdout
        pyprez.stderr = this.oldstderr
        return r
    }
    eval(code){
        if (this.language === "python"){
            this.attachStd()
            let r = pyprez.loadAndRunAsync(code)
            .then(this.detachStd, this.detachStd)
            .then(this.printResult)
            return r
        }else if (this.language === "javascript"){
            let r = eval(code)
            return this.printResult(r)
        }

    }
    keydown(e){
      let k = e.key;
      if (k === "Tab"){this.text += "    "; e.preventDefault();}
      if (k === "Enter"){
        if (e.shiftKey || this.text.trim().endsWith(":")){
            this.text += "\n... "
            e.preventDefault();
        }else{
            this.run();
            e.preventDefault();
        }
      }
      if (k === "Backspace" && (this.text.endsWith(">>> ") || this.text.endsWith("... "))){
        e.preventDefault();
      }
    }
    run(){
        let code = this.text.split(">>> ").pop().trim().replaceAll("...", "")
        if (!code){
            this.text += "\n>>> "
        }
        return this.eval(code)
    }
}
window.addEventListener("load", ()=>{
    customElements.define("pyprez-console", PyPrezConsole);
})

