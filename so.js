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

document.addEventListener("DOMContentLoaded", () => {
    if (location.href !== "https://github.com/modularizer/pyprez"){
        let stackEditor = document.createElement("div");
        document.body.appendChild(stackEditor);
        console.log(document.body.outerHTML);
        let demoCode = document.scripts[document.scripts.length - 1].innerText.trim();
        stackEditor.outerHTML = `<pyprez-editor runonload="true" theme="darcula">${demoCode}</pyprez-editor>`;
    }
});

// allow importing this script multiple times without raising an error
if (!window.pyprezInitStarted){ // if this script has not already run
var pyprezInitStarted = true;// save this window variable to signal that this script has run

/* ___________________________________________ LOAD DEPENDENCIES ____________________________________________________ */
// allow disabling dependency import if desired (people may want to do their own imports for clarity, speed, or to
//  use another version of pyodide or codemirror
let dependenciesEnabled = true;
if (location.hash.includes("skipdep") || location.search.includes("skipdep") || document.currentScript.hasAttribute("skipdep")){
    dependenciesEnabled = false;
}

// list dependencies
let cmVersion = "6.65.7"
let cmBase = "https://cdnjs.cloudflare.com/ajax/libs/codemirror/" + cmVersion + "/"
let jsDependencies = {
    codemirrorPython: {
        src: cmBase + "mode/python/python.min.js",
        check: false
    },
    codemirror: {
        src: cmBase + "codemirror.min.js",
        check: ()=>{
            if (!window.CodeMirror){return false}
            if (!window.CodeMirror.modes){return false}
            if (!window.CodeMirror.modes.python){return false}
            return true
        },
    },
    pyodide: {
        src: "https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js",
        check: ()=>window.loadPyodide
    },
}
let cssDependencies = [cmBase + "codemirror.min.css"]

// tool to add css to document
let addStyle = s=> {
    let style = document.createElement("style");
    style.innerHTML = s;
    document.head.appendChild(style);
}

// tools to import js dependencies
function importScript(url, ){
    console.log("attempting to import ", url)
    let el = document.createElement("script");
    el.src = url;
    return new Promise((resolve, reject)=>{
        document.addEventListener('DOMContentLoaded', ()=>{
            document.body.appendChild(el)
            el.addEventListener("load", ()=>resolve(url))
        })
    })
}

// function to get the text of css dependencies
let get = src => fetch(src).then(r=>r.text())

// function to load an external .css document into the page
let importStyle = (url)=>{
    console.log("importing", url)
    return get(src).then(addStyle)
}

// recursively load dependency tree
function _loadDependencies(tree, res){
    for (let [k, v] of Object.entries(tree)){
       if (!v.check || !v.check()){
            importScript(v.src).then(()=>{
                if (v.then !== undefined){
                    _loadDependencies(v.then, res)
                }else{
                    res(k);
                }
            })
       }else{
            if (v.then !== undefined){
                _loadDependencies(v.then, res)
            }else{
                res(k);
            }
       }
    }
}

// recursively load dependency tree
function loadDependencies(){
    return new Promise((resolve, reject)=>{
        // if not enabled don't bother trying to load dependencies
        if (!dependenciesEnabled){
            resolve();
            return
        }

        let res = (k)=>{
            console.log("loaded dependency: ", k)
            if (k == "pyodide"){
                addStyle(".CodeMirror { border: 1px solid #eee; height: auto; width: auto;}")
                setTimeout(resolve, 1000)
            }
        }

        // try to load css dependencies but don't wait on them
        cssDependencies.map(src => get(src).then(addStyle).then(()=>res(src)))

        _loadDependencies(jsDependencies, res)
    })
}

var loaded = loadDependencies(); // promise which resolves 1 second after pyodide is loaded
var loadedCMStyles = ["default"];

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

        this._loadPyodide = this._loadPyodide.bind(this)
        // load pyodide and resolve the promise
        this._loadPyodide(config);
    }
    elementList = [];
    elements = {};

    addElement(el){
        this.elements[this.elementList.length] = el;
        this.elementList.push(el);
        if (el.id){
            this.elements[el.id] = el;
        }
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
            return pyodide.runPythonAsync(code).catch(this.stderr)
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


/* ___________________________________________________ EDITOR ___________________________________________________ */
class PyPrezEditor extends HTMLElement{
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
//        alert("loading" + this.innerHTML)
//        console.log("this=", this)
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
            "js": "javascript",
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
        this.addEventListener("keydown", this.keypressed.bind(this));
        pyprez.addElement(this);
        if (this.hasAttribute("theme")){
            this.theme = this.getAttribute("theme")
        }
        console.warn(this.hasAttribute("runonload"), this.getAttribute("runonload"))
        if (this.hasAttribute("runonload") & (this.getAttribute("runonload")==="true")){
            this.run();
        }
    }
    keypressed(e){
        if (e.shiftKey){
            if (e.key == "Enter"){this.run(); e.preventDefault();}
            else if (e.key == "Backspace"){this.reset(); e.preventDefault();}
        }
    }
    dblclicked(e){
        console.log("double clicked")
        this.run();
    }
    loadEl(){
        let code="";
        if (this.innerHTML){
            let lines = this.innerHTML.replaceAll("\t","    ").split("\n")
            let indent = " ".repeat(Math.min(...lines.filter(v=>v).map(v=>v.match(/\s*/)[0].length)));
            code = lines.map(v=>v.startsWith(indent)?v.replace(indent, ""):v).join("\n")
        }
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
    // ➤ is &#10148;
        this.innerHTML = `
        <div style="color:green">&#10148;</div>
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

        console.log("attaching dblclick", this.editor.display.lineDiv)
        this.editor.display.lineDiv.addEventListener("dblclick", this.dblclicked.bind(this))
    }
    get code(){
        return this.editor?this.editor.getValue():this.textarea.value
    }
    set code(v){
        if (this.mode == "html"){
            v = v.replaceAll("<", "&lt").replaceAll(">", "gt")
        }
        if (this.editor){
            this.editor.setValue(v);
            this.editor.doc.setGutterMarker(0, "start", this.start);
        }else{
            this.textarea.value = v;
        }
    }
    get theme(){return this.editor.options.theme}
    set theme(v){
        if (loadedCMStyles.includes(v)){this.editor.setOption("theme", v)}
        else{
            let src = cmBase + "theme/" + v + ".min.css"
            get(src).then(addStyle).then((()=>{this.editor.setOption("theme", v)}).bind(this))
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
        if (this.code){
            let sep = "\n____________________\nLoading...\n"
            this.executed = this.code.split(sep)[0];
            this.start.style.color = "yellow"
            this.code = this.executed;
            let code = this.executed;
            let promise;
            if (this.language == "python"){
                this.code += sep;
                if (this.getAttribute("stdout") === "true"){
                    this.attachStd();
                }

                promise = pyprez.loadAndRunAsync(code);
                promise.then(r=>{
                    this.code += "\n>>> " + (r?r.toString():"") + "\n\n# (Double-Click to Re-Run)";
                    this.start.style.color = "red";
//                    this.start.innerHTML = "↻";
                    this.start.innerHTML = "&#8635";
                    if (this.getAttribute("stdout") === "true"){
                        this.detachStd();
                    }
                    return r
                })
            }else if (this.language == "javascript"){
                let r = eval(code)
                this.code += "\n>>> " + JSON.stringify(r, null, 2);
                this.start.style.color = "red";
//                this.start.innerHTML = "↻";
                this.start.innerHTML = "&#8635";
                return r
            }else if (this.language == "html"){
                if (!this.htmlResponse){
                    this.htmlResponse = document.createElement("div");
                    this.after(this.htmlResponse)
                }
                this.htmlResponse.innerHTML = this.code.replaceAll("&lt","<").replaceAll("&gt", ">");
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
//        this.start.innerHTML = "➤";
        this.start.innerHTML = "&#10148";
        this.start.style.color = "green";
        this.code = this.executed;
        this.executed = false;
    }
}
window.addEventListener("load", ()=>{
customElements.define("pyprez-editor", PyPrezEditor);
})

}