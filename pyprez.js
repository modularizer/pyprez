/*Wed Oct 26 2022 20:13:40 GMT -0700 (Pacific Daylight Time)*/

if (!window.pyprezUpdateDate){
/* github pages can only serve one branch and takes a few minutes to update, this will help identify which version
of code we are on */
    var pyprezUpdateDate = new Date("Wed Oct 26 2022 20:13:40 GMT -0700 (Pacific Daylight Time)");
    var pyprezCommitMessage = "fix auto-run";
    var pyprezPrevCommit = "development:commit 95aa71b79ad465971748d40ac9b921a81453393f";
}

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

if (!window.pyprezInitStarted){// allow importing this script multiple times without raising an error
    console.log("loaded pyprez.js from", location.href);

    /* ___________________________________________ CONSTANTS _________________________________________________ */
    var pyprezInitStarted = true;// signal to duplicate imports not to try again
    var preferredPyPrezImportSrc = "https://modularizer.github.io/pyprez/pyprz.min.js";
    var githublinkImage = '<a href="https://modularizer.github.io/pyprez"><img src="https://github.com/favicon.ico" height="15px"/></a>';

    var stackMode = false;
    var pyprezScript = document.currentScript; // get the HTML <script> element running this code

    /* ___________________________________________ CONFIG _________________________________________________ */
    // set default configuration settings

    //first separate config defaults by type to make validation easier
    let boolConfig = {
        help: true,
        useWorker: false,
        convert: true,
        includeGithubLink: true,
        showThemeSelect: true,
        showNamespaceSelect: false,
        patch: true,
    }
    let strConfig = {
        patchSrc: "https://modularizer.github.io/pyprez/patches.py",
        codemirrorCDN: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/",
        pyodideCDN: "https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js",
        consolePrompt: ">>> ",
        consoleOut: "[Out] ",
        consoleEscape: "...",
    }

    // construct default config
    var pyprezConfig = {
        ...boolConfig ,
        ...strConfig,
    }

    // if there are globally defined config values in window, use those as default config
    for (let k of Object.keys(pyprezConfig)){
        if (window[k] !== undefined){
            pyprezConfig[k] = window[k]
        }
    }

    // if any config values are defined as attributes by the script doing the import, make that override defaults
    for (let k of Object.keys(pyprezConfig)){
        if (pyprezScript.hasAttribute(k)){
            let v = pyprezScript.getAttribute(k).toLowerCase();
            if (Object.keys(boolConfig).includes(k)){
                if (["true", "1", ""].includes(v)){
                    pyprezConfig[k] = true
                }else if (["false", "0"].includes(v)){
                    pyprezConfig[k] = false
                }else{
                    console.error(`Invalid value '${v}' for attribute '${k}'. Value must be "true", "false", "1", "0", or ""`)
                }
            }else{
                pyprezConfig[k] = v
            }
        }
    }

    Object.assign(window, pyprezConfig);
    /* ___________________________________________ DEFERRED PROMISE _________________________________________________ */
    class DeferredPromise{
        /* this is an object which creates a promise in a different spot from where it will be resolve. It allows you
        to say wait on athe completion of a task that you have not yet started. The interface is similar to
        that of a promise (supports `then`, `catch` and if you wish you can access the true promise with
        the `promise` attribute.*/
        constructor(){
            this.promise = new Promise((resolve, reject)=>{
                this.resolve = resolve.bind()
                this.reject = reject.bind()
            })
            this.then = this.promise.then.bind(this.promise)
            this.catch = this.promise.catch.bind(this.promise)
        }
    }


    window.DeferredPromise = DeferredPromise;
    /* ________________________________________ DEFINE STATE VARIABLES ______________________________________________ */
    // define steps of the load that different tasks may depend on
    var domContentLoaded = new DeferredPromise();
    var pyodideImported = new DeferredPromise();
    var codemirrorImported = new DeferredPromise();
    var workerReady = new DeferredPromise();
    var pyodidePromise = new DeferredPromise("pyodidePromise");
    var micropipPromise = new DeferredPromise("micropipPromise");
    var patches = new DeferredPromise();
    if (patch){
        patches = get(patchSrc);
    }

    var loadedCodeMirrorStyles = ["default"];

    /* ___________________________________________ INTERPRET SCRIPT TAG _________________________________________________ */
    // check if document is ready to go
    if (document.readyState === "complete" || document.readyState === "loaded") {
         // document is already ready to go
         domContentLoaded.resolve()
    }else{
        // document is not ready, resolve deferred promise when it is
        document.addEventListener('DOMContentLoaded', domContentLoaded.resolve)
    }

    // if the user is using the script tag as a code block, add a real code block to the document
    function pyprezConvert(){
        if (pyprezScript.innerHTML){
            if (convert){
                let script = pyprezScript;

                // read script innerHTML then remove it
                let ih = script.innerHTML;
                script.innerHTML = "";

                // make a real pyprez custom-element with the same attributes
                let mode = "editor"
                if (script.hasAttribute("mode")){
                    mode = script.getAttribute("mode")
                }
                let el = document.createElement("pyprez-" + mode);
                el.innerHTML = ih;
                for (let k of script.getAttributeNames()){
                    if (!["src"].includes(k)){
                        el.setAttribute(k, script.getAttribute(k))
                    }
                }

                // add to container and insert into document after script element
                let div = document.createElement("div");
                div.append(el);
                script.after(div);
            }
        }else{
            domContentLoaded.then(()=>{
                console.log("DOMContentLoaded")
                // try to identify if this script is running in a stack overflow demo (or other similar environment)
                // if it is we will make a pyprez-editor which runs the code in the last script element
                let isFirstScript = pyprezScript === document.scripts[0]
                let numBodyEls = document.body.children.length
                let singleBodyChild = numBodyEls === 1 && (document.body.children[0].tagName === "SCRIPT")
                let twoDirectBodyChildren = (numBodyEls === 2) && (pyprezScript.parentElement === document.body)
                let solo = isFirstScript && (twoDirectBodyChildren || singleBodyChild)
                let convertScript = pyprezScript.hasAttribute("convert")?pyprezScript.getAttribute("convert")==="true":convert

                if (solo && convertScript){
                    window.stackMode = true;
                    // use special attribute defaults in stack overflow
                    let mode = pyprezScript.hasAttribute("mode")?pyprezScript.getAttribute("mode"):"editor"
                    let specialAttributes = {
                        runonload: "true",
                        theme: "darcula",
                        githublink: "true"
                    }

                    let a = ""
                    for (let [k, defaultValue] of Object.entries(specialAttributes)){
                        let v = pyprezScript.hasAttribute(k)?pyprezScript.getAttribute(k):defaultValue;
                        a += ` ${k}="${v}"`
                    }

                    // get the code from the last script in the code demo
                    let lastScript = document.scripts[document.scripts.length - 1]
                    let demoCode = lastScript.innerHTML.trim()

                    // add an element to hold the pyprez-editor
                    let stackEditor = document.createElement("div");
                    document.body.appendChild(stackEditor);

                    // convert added element into pyprez-editor
                    stackEditor.innerHTML = `
                        <pyprez-${mode} ${a}>${demoCode}</pyprez-${mode}>
                    `;
                }
            })
        }
    }

    pyprezConvert();
    /* _______________________________ SETUP TO LOAD DEPENDENCIES ____________________________________________________ */
    // allow disabling dependency import if desired (people may want to do their own imports for clarity, speed, or to
    // tool to add css to document
    function addStyle(s){
        let style = document.createElement("style");
        style.innerHTML = s;
        document.head.appendChild(style);
    }

    // tools to import js dependencies
    function importScript(url){
        let el = document.createElement("script");
        el.src = url;
        return new Promise((resolve, reject)=>{
            domContentLoaded.then(()=>{
                console.log("attempting to import ", url)
                document.body.appendChild(el)
                el.addEventListener("load", ()=>resolve(url))
            })
        })
    }

    // function to get the text of css dependencies
    function get(src){return fetch(src).then(r=>r.text())}

    // function to load an external .css document into the page
    function importStyle(url){
        console.log("importing", url)
        return get(url).then(addStyle)
    }

    // make functions to import dependencies
    function importPyodide(){
        if (pyodideCDN && !useWorker && window.importPyodide && !window.pyodide){
            importScript(pyodideCDN).then(()=>{pyodideImported.resolve(true)})
        }
    }
    function importCodeMirror(){
        if (codemirrorCDN && !window.CodeMirror){
            importScript(codemirrorCDN + "codemirror.min.js").then(()=>{
                importScript(codemirrorCDN + "mode/python/python.min.js").then(()=>{
                    importStyle(codemirrorCDN + "codemirror.min.css").then(()=>{
                        addStyle('.CodeMirror { border: 1px solid #eee !important; height: auto !important;}');
                        codemirrorImported.resolve(CodeMirror)
                    })
                })
            })
        }
    }

    /* _______________________________ ACTUALLY LOAD DEPENDENCIES ____________________________________________________ */
    importPyodide();
    importCodeMirror();

    /* _______________________________________ LOAD AND EXTEND PYODIDE FUNCTIONALITY ____________________________________ */
    class PyodideWorker extends Worker{
        constructor(src){
            super(src);
            this.parent = window;
            // bind methods to scope, may be unnecessary
            this.getMethod = this.getMethod.bind(this);
            this.postResponse = this.postResponse.bind(this);
            this.postError = this.postError.bind(this);
            this.postRequest = this.postRequest.bind(this);
            this.postCall = this.postCall.bind(this);
            this.receiveResponse = this.receiveResponse.bind(this);
            this.receiveCallRequest = this.receiveCallRequest.bind(this);
            this.receiveRequest = this.receiveRequest.bind(this);
            this.stdout = this.stdout.bind(this);
            this.stderr = this.stderr.bind(this);
            this.worker = this;
            this.proxy = new Proxy(this, {
                get(target, prop, receiver) {
                    if (target[prop] !== undefined){return target[prop]}
                    function callMethod(){
                        return target.postRequest(prop, Array.from(arguments))
                    }
                    return callMethod
                }
            });
            return this.proxy
        }

        loadPackagesFromImports(){}
        _id = 0
        get id(){
            let id = this._id
            this._id = (id + 1) % Number.MAX_SAFE_INTEGER;
            return id
        }

        pendingRequests = {}
        receivemessage(event){
            let data = event.data
            let type = data.type
            if (type === "response"){this.receiveResponse(data)}
            else if (type === "call"){this.receiveCallRequest(data)}
            else if (type === "request"){this.receiveRequest(data)}
            else{this.postError(data, "unrecognized type")}
        }
        getMethod(methodName, scopes){
            if (!scopes){scopes = [this.parent, this]}
            for (let scope of scopes){
                if (scope[methodName]){return scope[methodName]}
                else if (methodName.includes(".")){
                    let methodNames = methodName.split(".")
                    for (let mn of methodNames){
                        scope = scope[mn]
                        if (!scope){return scope}
                    }
                    return scope
                }
            }
        }

        postResponse(data, results, error=null){
            data.type = "response";
            data.results = results;
            data.error = error;
            this.postMessage(data)
        }
        postError(data, error){this.postResponse(data, null, error)}
        postRequest(method, args, type="request"){
            let id = this.id;
            let data = {id, type, method, args, results: null, error: null}
            this.pendingRequests[id] = [new DeferredPromise(), data];
            this.postMessage(data)
            return this.pendingRequests[id][0]
        }
        postCall(method, args){this.postRequest(method, args, "call")}

        receiveResponse(data){
            if ( this.pendingRequests[data.id] === undefined){
                console.error(data.id, data);
                return
            }
            let [deferredPromise, sentData] = this.pendingRequests[data.id];
            delete this.pendingRequests[data.id];
            if (data.results){deferredPromise.resolve(data.results)}
            else{ deferredPromise.reject(data.error)}
        }
        receiveCallRequest(data){
            let f = this.getMethod(data.method);
            if (f){ return f(...data.args)}
            else{this.postError(data, "method not found")}
        }
        receiveRequest(data){
            try{
                let results = this.receiveCallRequest(data);
                if (results.then){
                    results
                    .then(r=>this.postResponse(data, r))
                    .catch(e=>this.postError(data, e))
                }
                else{this.postResponse(data, results)}
            }
            catch(error){this.postError(data, error)}
        }
        stdout(...args){
            console.log(args)
        }
        stderr(...args){
            console.log(args)
        }
        stdin(){return ""}
    }

    function loadPyodideInterface(config){
        if (useWorker){
            window.pyodide = new PyodideWorker('./webworker.js');
            pyodide.worker.onmessage = pyodide.worker.receivemessage
            if (config.stdin){pyodide.stdin = config.stdin;}
            if (config.stdout){pyodide.stdout = config.stdout;}
            if (config.stderr){pyodide.stderr = config.stderr;}
            pyodideImported.resolve(true)
            workerReady.then(()=>{
                pyodide.runPythonAsync("2+2").then(r=>{
                    if (r == 4){
                        window.pyodide = pyodide;
                        window.pyodidePromise.resolve(true);
                    }
                })
            })
        }else{
            pyodideImported.then(()=>{
                loadPyodide(config).then(pyodide =>{
                    pyodide.runPythonAsync(`
                        from js import prompt
                        __builtins__.input = prompt
                        2+2
                    `).then(()=>{
                        if (patch){
                            patches.then(code =>{
                                console.warn("applying python patches", code)
                                pyodide.runPythonAsync(code).then(()=>{
                                    console.log("patched")
                                    window.pyodide = pyodide;
                                    pyodidePromise.resolve(true);
                                    pyodide.loadPackage("micropip").then(micropip =>{
                                        window.micropip = pyodide.pyimport("micropip");
                                        micropipPromise.resolve(true);
                                    })
                                })
                            })
                        }else{
                            window.pyodide = pyodide;
                            pyodidePromise.resolve(true);
                            pyodide.loadPackage("micropip").then(micropip =>{
                                        window.micropip = pyodide.pyimport("micropip");
                                        micropipPromise.resolve(true);
                                    })
                        }

                    })


                })
            })
        }
        return pyodidePromise
    }

    /* _______________________________________ scopeEval ____________________________________ */
    function scopeEval(script) {
      return Function(( "with(this) { " + script + "}"))();
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
        constructor(config={}, load=true){
            // bind the class methods to this instance
            this._stdout = this._stdout.bind(this);
            this._stderr = this._stderr.bind(this);
            this._stdin = this._stdin.bind(this);
            this.load = this.load.bind(this);
            this.loadPyodideInterface = this.loadPyodideInterface.bind(this);
            this.load = this.load.bind(this);
            this._runPythonAsync = this._runPythonAsync.bind(this);
            this.loadAndRunAsync = this.loadAndRunAsync.bind(this);
            this.recordNamespaceName = this.recordNamespaceName.bind(this);
            this.register = this.register.bind(this);

            // load pyodide or pyodide worker proxy
            Object.assign(this, config);
            this.config = {
                stdout: this._stdout,
                stderr: this._stderr,
                stdin: this._stdin
            };

            if (load){
                this.loadPyodideInterface();
            }
        }
        loadPyodideInterface(){
            loadPyodideInterface(this.config).then(()=>{
                this.getNamespace("global")
            })
        }
        pending = []

        // allow pyprez object to act a bit like a the promise to the pyodide object
        then(successCb, errorCb){
            return pyodidePromise.then(successCb, errorCb)
        }
        catch(errorCb){return pyodidePromise.catch(errorCB)}

        // set the functions that will handle stdout, stderr from the python interpreter
        stdout = console.log
        stderr = console.error
        stdin = ()=>""

        // set parent functions which will call wrap and call stdout, stderr, stdin from the python interpreter
        _stdout(...args){return this.stdout(...args)}
        _stderr(...args){return this.stderr(...args)}
        _stdin(...args){return this.stdin(...args)}

        // store elements
        elements = {};
        editors = {};
        consoles = {};
        scripts = {};
        imports = {};
        overflows = {};

        register(el){
            let mode = el.tagName.toLowerCase().split("-").pop();
            let m = this[mode + "s"]
            this.elements[Object.keys(this.elements).length] = el;
            m[Object.keys(m).length] = el;
            if (el.id){
                this.elements[el.id] = el;
                m[el.id] = el;
            }
        }

        _runPythonAsync(code, namespace){
            /* internal function which runs the code */
            if (code){
                console.debug("running code asynchronously:")
                console.debug(code)
                this.recordNamespaceName(namespace)
                if (useWorker){
                    return pyodide.runPythonAsyncInNamespace(code, namespace).catch(this.stderr)
                }else{
                    return pyodide.runPythonAsync(code, {globals: this.getNamespace(namespace)}).catch(this.stderr)
                }

            }
        }

        jsNamespaces = {}
        getJSNamespace(name){
            if (this.jsNamespaces[name] === undefined){
                let scope = {}
                Object.assign(scope, window, {console, })
                this.jsNamespaces[name] = [scope, scopeEval.bind(scope)]
            }
            return this.jsNamespaces[name]
        }
        namespaceEval(code, name){
            let [scope, scopedEval] = this.getJSNamespace(name);
            return scopedEval(code)
        }


        namespaces = {}
        namespaceNames = ['global']
        recordNamespaceName(name){
            if (!this.namespaceNames.includes(name)){
                this.namespaceNames = this.namespaceNames.concat([name])
            }
        }
        getNamespace(name){
            pyodidePromise.then((()=>{
                if (this.namespaces[name] === undefined){
                    if (!useWorker){
                        this.namespaces[name] = pyodide.globals.get("dict")();
                    }
                }

                return this.namespaces[name]
            }).bind(this))
        }

        // utility methods used to load requirements and run code asynchronously as soon as pyodide is loaded
        load(code, requirements="detect"){
            /*load required packages as soon as pyodide is loaded*/
            return this.then(() =>{
                let requirementsLoaded;
                if (requirements === "detect"){
                    if (code){
                        console.debug("auto loading packages detected in code")
                        requirementsLoaded = window.pyodide.loadPackagesFromImports(code)
                    }
                }else{
                    console.debug("loading", requirements)
                    requirementsLoaded = window.pyodide.loadPackage(requirements);
                }
                return requirementsLoaded
            })
        }
        loadAndRunAsync(code, namespace="global", requirements="detect"){
            /* run a python script asynchronously as soon as pyodide is loaded and all required packages are imported*/
            let p = this.then((() =>{
                if (code){
                    return this.load(code, requirements)
                        .then((r => this._runPythonAsync(code, namespace)).bind(this))
                        .catch((e => this._runPythonAsync(code, namespace)).bind(this))
                }
            }).bind(this))
            return p
        }
    }
    var pyprez = new PyPrez(load=true);

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
            this.classList.add("pyprez");

            // bind functions
            this.loadEl = this.loadEl.bind(this);
            this.loadEditor = this.loadEditor.bind(this);
            this.keypressed = this.keypressed.bind(this);
            this.run = this.run.bind(this);
            this.copyRunnable = this.copyRunnable.bind(this);
            this.getRunnable = this.getRunnable.bind(this);

            // set language to python(default), javascript, or html
            let language = this.hasAttribute("language")?this.getAttribute("language").toLowerCase():"python"
            let aliases = {
                "python": "python",
                "javascript": "javascript",
                "html": "html",
                "py": "python",
                "js": "javascript",
            }
            this.language = aliases[language]

            // default is to print stdout into editor
            if (!this.hasAttribute("stdout")){this.setAttribute("stdout", "true")}

            // allow loading code from an external source
            if (this.hasAttribute("src") && this.getAttribute("src") && (this.getAttribute("src") !== pyprezScript.src)){
                let src = this.getAttribute("src")
                console.debug("fetching script for pyprez-editor src", src)
                if (src.endsWith('.js')){
                    this.language = "javascript"
                }else if (src.endsWith('.py')){
                    this.language = "python"
                }else if (src.endsWith('.html')){
                    this.language = "html"
                }
                fetch(src).then(r=>r.text()).then(code =>{
                    this.innerHTML = code;
                    this.loadEl();
                })
            }else{
                this.loadEl();
            }
            this.namespace = this.hasAttribute("namespace")?this.getAttribute("namespace"):"global"
            pyprez.recordNamespaceName(this.namespace)

            // add listeners
            this.addEventListener("keydown", this.keypressed.bind(this));
            this.addEventListener("dblclick", this.dblclicked.bind(this))

            // register
            pyprez.register(this);

            // runonload if told to
            if (this.hasAttribute("runonload") & (this.getAttribute("runonload")==="true")){
                this.run();
            }
        }
        /* ________________________ LOAD _____________________________*/
        unindent(code, minIndent=0){
            // read innerHTML and remove extra leading spaces
            let firstFound=false;
            let lines = code.replaceAll("\t","    ").split("\n").filter((v,i)=>{
                if (firstFound){return true}
                firstFound = v.trim().length > 0;
                return firstFound
            }); // replace tabs with spaces
            let nonemptylines = lines.filter(v=>v.trim().length)
            let leadingSpacesPerLine = nonemptylines.filter(v=>!v.trim().startsWith('#')).map(v=>v.match(/\s*/)[0].length); // count leading spaces of each line which has code
            let extraLeadingSpaces = Math.min(...leadingSpacesPerLine) - minIndent; // recognize if every line containing code starts with spaces
            if ((extraLeadingSpaces > 0) && (extraLeadingSpaces < 1000)){
                let extraIndent = " ".repeat(extraLeadingSpaces);// string representing extra indent to remove
                code = lines.map(v=>v.startsWith(extraIndent)?v.replace(extraIndent, ""):v).join("\n") // remove extra space
            }
            return code
        }
        reformatIndentation(code){
            // deal with weird edge case where python comments use html tags and get auto-closed
            while(code.endsWith('>')){
                let newCode = code.replace(/<\/[a-z-]*>$/,'')
                if (newCode === code){
                    break
                }
                code = newCode;
            }
            code = this.unindent(code)
            let inem = '\nif __name__=="__main__":';
            let blocks = code.split(inem);
            if (blocks.length == 2){
                let [pre, post] = blocks
                post = this.unindent(post, 4)
                code = pre + inem + post
            }
            return code
        }
        loadEl(){
            /* load and format the html element */
            let code=this.innerHTML?this.reformatIndentation(this.innerHTML):"";

            this.initialCode = code;
            this.innerHTML = `<pre>${code}</pre>`// set innerHTML to the cleanest builtin HTML

            // load the editor
            this.loadEditor();

            // set theme
            if (this.hasAttribute("theme")){
                this.theme = this.getAttribute("theme")
            }

            // now load packages detected in code imports
            this.loadPackages()
        }
        loadEditor(){
            /* first load the editor as though codemirror does not and will not exist, then load codemirror*/
            this._loadEditor();
            codemirrorImported.then(this._loadCodeMirror.bind(this));
        }
        helpInfo = `
        <b>PyPrez</b> is powered by <i>Pyodide</i> and runs fully in your browser!<br/><br/>

        <b>To run:</b>
        <ul>
            <li>Click green arrow</li>
            <li>Shift + Enter</li>
            <li>Double-Click</li>
        </ul>
        <b>To re-run:</b>
        <ul>
            <li>Shift + Enter</li>
            <li>Double-Click</li>
        </ul>
        <b>To reload:</b>
        <ul>
            <li>Click red reload</li>
            <li>Shift + Backspace</li>
        </ul>
        <b>Post-Run Console</b>
        After code executes, try the runnable console at the bottom!

        <b>Add to StackOverflow:</b>
        Click <b>M&#8595</b> to copy markdown, then paste into your answer.
        `
        _loadEditor(){
            /* first load the editor as though codemirror does not and will not exist*/

            // check whether to add github link to top based on attributes
            let githublink = this.hasAttribute("githublink")?this.getAttribute("githublink")==="true":includeGithubLink
            let gh = githublink?githublinkImage:"<div></div>"

            // check whether to add a message bar to the top of the element
            let help= this.hasAttribute("help")?this.getAttribute("help")==="true":window.help;

            let snss = this.hasAttribute("showNamespaceSelect")?this.getAttribute("showNamespaceSelect"):window.showNamespaceSelect;
            snss=snss?"block":"none";
            let sts = this.hasAttribute("showThemeSelect")?this.getAttribute("showThemeSelect"):window.showThemeSelect;
            sts = sts?"block":"none";

            // make top bar above codemirror
            let top = ""
            if (help){
                top = `<div style="background-color:#d3d3d3;border-color:#808080;border-radius:3px;display:flex">
                    ${gh}
                    <div style="margin-left:10px;overflow:hidden;white-space: nowrap;"></div>
                    <div style="order:2;margin-left:auto;cursor:help;" clicktooltip="${this.helpInfo}#def">&#9432</div>
                    <div style="background-color:#f0f0f0;border-radius:5px;margin:2px;order:2;margin-right:5px;cursor:help;" tooltip="copy iframe#def" onclick="this.parentElement.parentElement.copyEmbeddable()">&lt/&gt</div>
                    <div style="background-color:#f0f0f0;border-radius:5px;margin:2px;order:2;margin-right:5px;cursor:help;" tooltip="copy runnable markdown#def" onclick="this.parentElement.parentElement.copyRunnable()">M&#8595</div>
                    <select style="order:2;margin-right:4px;background-color:#f0f0f0;border-radius:3px;display:${snss};">
                        <option>global</option>
                    </select>
                    <select style="order:2;margin-right:5px;background-color:#f0f0f0;border-radius:3px;display:${sts};">
                        <option>default</option>
                        <option style="background-color:#2b2b2b;color:#a9b7c6;">darcula</option>
                        <option style="background-color:#d7d4f0;color:#30a;">eclipse</option>
                        <option style="background-color:rgba(37,59,118,.99);color:#ff6400;">blackboard</option>
                        <option style="background-color:#d7d4f0;color:#0080ff;">xq-light</option>
                        <option style="background-color:#0a001f;color:#f8f8f8;">xq-dark</option>
                    </select>
                </div>`
            }else{
                top = `<div>
                    ${gh}
                    <div style="display:none;margin-left:10px;overflow:hidden;white-space: nowrap;"></div>
                    <div style="order:2;margin-left:auto;cursor:help;" clicktooltip="${this.helpInfo}#def">&#9432</div>
                    <div style="background-color:#f0f0f0;border-radius:5px;margin:2px;order:2;margin-right:5px;cursor:help;" tooltip="copy iframe#def" onclick="this.parentElement.parentElement.copyEmbeddable()">&lt/&gt</div>
                    <div style="background-color:#f0f0f0;border-radius:5px;margin:2px;order:2;margin-right:5px;cursor:help;" tooltip="copy runnable markdown#def" onclick="this.parentElement.parentElement.copyRunnable()">M&#8595</div>
                    <select style="order:2;margin-right:5px;background-color:#f0f0f0;border-radius:3px;display:${snss};">
                        <option>global</option>
                    </select>
                    <select style="order:2;margin-right:5px;background-color:#f0f0f0;border-radius:3px;display:${sts};">
                        <option>default</option>
                        <option style="background-color:#2b2b2b;color:#a9b7c6;">darcula</option>
                        <option style="background-color:#d7d4f0;color:#30a;">eclipse</option>
                        <option style="background-color:rgba(37,59,118,.99);color:#ff6400;">blackboard</option>
                        <option style="background-color:#d7d4f0;color:#0080ff;">xq-light</option>
                        <option style="background-color:#0a001f;color:#f8f8f8;">xq-dark</option>
                    </select>
                </div>`
            }
            this.style.display="flex"
            this.style["flex-direction"] = "column"
            this.style.resize = "both"
            this.style.overflow = "auto"
            this.innerHTML = `
            <div style="color:green">${this.startChar}</div>
            ${top}
            <textarea style="height:auto;">${this.initialCode}</textarea>
            <pre></pre>
            `
            this.start = this.children[0] // start button
            this.messageBar = this.children[1].children[1] // top message bar to use to print status (Loading, Running, etc.)
            this.copyEmbeddableLink = this.children[1].children[3]
            this.copyRunnableLink = this.children[1].children[4]
            this.namespaceSelect = this.children[1].children[5]
            this.themeSelect = this.children[1].children[6]
            this.textarea = this.children[2] // textarea in case codemirror does not load
            this.endSpace = this.children[3]

            // add click event to start button
            this.start.addEventListener("click", this.startClicked.bind(this))
            this.themeSelect.addEventListener("change", ((e)=>{
                this.theme = this.themeSelect.value;
                try{
                    localStorage.setItem("codemirrorTheme", this.themeSelect.value);
                }catch{}

            }).bind(this))
            this.namespaceSelect.addEventListener("click", ()=>{
                this.refreshNamespaces();
            })

            // size text area to fit initial code
            this.textarea.style.height = this.textarea.scrollHeight +"px" // set text area to full height
            let longestLine = this.initialCode.split("\n").map(v=>v.length).reduce((a,b)=>a>b?a:b)
            let fontSize = 1 * window.getComputedStyle(this.textarea).fontSize.slice(0,-2)
            let w = Math.min(window.innerWidth - 50, Math.ceil(longestLine * fontSize) + 200)
//            this.children[1].style.width = w +"px"
//            this.textarea.style.width = w  + "px"
            this.style.maxWidth = "100%"
            this.style.width = stackMode?"100%":(w + "px")

            // Set initial messages
            if (!pyodideImported.promise.fullfilled){
                this.message = "Loading pyodide"
                pyodideImported.then((()=>{this.message = "Ready   (Double-Click to Run)"}).bind(this))
            }
        }
        _loadCodeMirror(){
            // make codemirror editor from textarea
            this.editor = CodeMirror.fromTextArea(this.textarea, {
                lineNumbers: true,
                mode: this.language,
                viewportMargin: Infinity,
                gutters: ["Codemirror-linenumbers", "start"],
            });
//            this.editor.setSize(1*this.textarea.style.width.slice(0,-2))

            // add start button in gutter
            this.editor.doc.setGutterMarker(0, "start", this.start);

            // set double click listener on editor as well because otherwise outer element listener does not get triggered
            this.editor.display.lineDiv.addEventListener("dblclick", this.dblclicked.bind(this))


            try{
                if (!this.hasAttribute("theme")){
                    this.themeSelect.value = this.theme;
                    let cmt = localStorage.getItem("codemirrorTheme");
                    cmt = cmt?cmt:this.theme;
                    localStorage.setItem("codemirrorTheme", cmt);
                    this.themeSelect.value = cmt;
                    this.theme = cmt;
                }
            }catch{}
        }
        get selectedNamespace(){return this.namespaceSelect.value}
        set selectedNamespace(name){
            this.namespaceSelect.value = name;
        }
        get namespaces(){return Array.from(this.namespaceSelect.children).map(el=>el.innerHTML)}
        set namespaces(namespaces){
            let sn = this.selectedNamespace;
            this.namespaceSelect.innerHTML = namespaces.map(name=>`<option>${name}</option>`).join("")
            this.namespaceSelect.value = sn;
        }
        refreshNamespaces(){
            this.namespaces = pyprez.namespaceNames;
        }
        get namespace(){return this.selectedNamespace}
        set namespace(name){
            if (!this.namespaces.includes(name)){
                this.namespaces = this.namespaces.concat([name]);
            }
            this.selectedNamespace = name
        }

        /* ________________________ EVENTS _____________________________*/
        keypressed(e){
            /* Shift + Enter to run, Shift + Backspace to reload */
            if (e.shiftKey && e.key == "Backspace"){this.reload(); e.preventDefault();}
            else if (e.key == "Enter"){
                if (e.shiftKey && !this.done){this.run(); e.preventDefault();}
                if (this.done){
                    if (!(e.shiftKey || this.code.endsWith(':'))){this.run(); e.preventDefault();}
                    else{
                        let s = "\n" + this.consoleEscape
                        this.code += s;
                        e.preventDefault();
                        let lines = this.code.split("\n")
                        this.editor.setCursor({line: lines.length, ch: lines[lines.length-1].length})
                    }
                }
            }
        }
        dblclicked(e){
            /* always run or re-run on double click*/
            if (this.done){
                this.reload();
            }

            this.run();
            e.stopPropagation();
        }
        startClicked(){
            /* when the start button is clicked either run code or reload to the last code that was executed*/
            if (!this.executed){
                this.run();
            }else{
                this.reload();
            }
        }

        /* ________________________ STATE _____________________________*/
        done = false
        executed = false // store the code that was executed last from this element

        /* ________________________ CONFIG _____________________________*/
        separator = "\n____________________\n"
        startChar = "&#10148" // ➤
        reloadChar = "&#8635" //"↻"
        consolePrompt = consolePrompt
        consoleOut = consoleOut
        consoleEscape = consoleEscape

        /* ________________________ PROPERTIES _____________________________*/
        // get/set the message in the top message bar (which can be hidden if desired)
        get message(){
            return this.messageBar.innerHTML
        }
        set message(v){
            this.messageBar.innerHTML = v
        }

        // get/set the code content
        get code(){
            return this.editor?this.editor.getValue():this.textarea.value
        }
        set code(v){
            // escape html
            if (this.language == "html"){
                v = v.replaceAll("<", "&lt").replaceAll(">", "&gt")
            }

            if (this.editor){
                this.editor.setValue(v);
                this.editor.doc.setGutterMarker(0, "start", this.start);

                // scroll to bottom of element
//                let si = this.editor.getScrollInfo();
//                this.editor.scrollTo(0, si.height);
            }else{
                this.textarea.value = v;

                // scroll to bottom of element
                this.textarea.scrollTop = this.textarea.scrollHeight;
            }

            // scroll down on page until bottom of element is in view
            let bb = this.getBoundingClientRect();
//            if (bb.bottom > window.innerHeight){
//                window.scroll(0, 20 + bb.bottom - window.innerHeight)
//            }
        }

        // get/set the codemirror theme, importing from cdn if needed
        _theme = "default"
        get theme(){return this._theme}
        set theme(v){
            codemirrorImported.then((()=>{
                if (loadedCodeMirrorStyles.includes(v)){
                    this.editor.setOption("theme", v)
                }else{
                    let src = codemirrorCDN + "theme/" + v + ".min.css"
                    get(src).then(addStyle).then((()=>{
                        this.editor.setOption("theme", v);
                        loadedCodeMirrorStyles.push(v);
                    }).bind(this))
                }
            }).bind(this))
            this.themeSelect.value = v;
            this._theme = v;
        }

        /* ________________________ PYTHON IMPORTS _____________________________*/
        numImports = 0; // number of import statements we have already tried to auto-load
        loadPackages(){
            /* autodetect if new import statements have been added to code, and if so try to install them*/
            let code = this.code;
            let n = code.match(/import/g);
            if (n && n.length !== this.numImports){
                this.message = "Loading packages..."
                this.numImports = n.length;
                pyprez.load(this.code).then((()=>{this.message = "Ready...(Double-Click to Run)"}).bind(this))
            }
        }

        /* ________________________ RUN CODE _____________________________*/
        reload(){
            /*reset editor to the state from before it was executed last*/
            this.start.innerHTML = this.startChar
            this.start.style.color = "green";
            if (this.language !== "html"){
                this.code = this.executed;
            }
            this.message = "Ready   (Double-Click to Run)";
            this.executed = false;
            this.done = false
        }
        run(){
            console.log("running")
            if(this.done){
                this.consoleRun()
            }else if (this.code){
                if (this.editor){
                    let si = this.editor.getScrollInfo();
                    this.editor.scrollTo(0, si.height);
                }

                this.message = "Running..."
                let code = this.code.split(this.separator)[0];
                this.executed = code;
                this.start.style.color = "yellow"
                let promise;
                if (this.language == "python"){
                    this.code = code;
                    this.code += this.separator;
                    if (this.getAttribute("stdout") === "true"){
                        this.attachStd();
                    }
                    promise = pyprez.loadAndRunAsync(code, this.namespace);
                    promise.then(r=>{
                        this.done = true
                        this.message = "Complete! (Double-Click to Re-Run)"
                        let s = "\n" + this.consoleOut + (r?r.toString():"") + "\n" + this.consolePrompt;
                        this.code += s;
                        this.start.style.color = "red";
                        this.start.innerHTML = this.reloadChar;
                        if (this.getAttribute("stdout") === "true"){
                            this.detachStd();
                        }
                        return r
                    })
                }else if (this.language == "javascript"){
                    this.code = code;
                    let r = pyprez.namespaceEval(code, this.namespace)
                    this.done = true
                    this.message = "Complete! (Double-Click to Re-Run)"
                    let s = "\n" + this.consoleOut + ((![null, undefined].includes(r))?JSON.stringify(r, null, 2):"");
                    this.code += s;
                    this.start.style.color = "red";
                    this.start.innerHTML = this.reloadChar;
                    return r
                }else if (this.language == "html"){
                    if (!this.htmlResponse){
                        this.htmlResponse = document.createElement("div");
                        this.after(this.htmlResponse)
                    }
                    this.htmlResponse.innerHTML = this.code.replaceAll("&lt","<").replaceAll("&gt", ">");
                    this.done = true
                    this.message = "Complete! (Double-Click to Re-Run)"
                    this.start.style.color = "red";
                    this.start.innerHTML = this.reloadChar;
                }
            }

        }

        /* ________________________ POST-RUN CONSOLE _____________________________*/
        consoleRun(){
            let code = this.code.split(this.consolePrompt).pop().trim().replaceAll(this.consoleEscape, "")
            if (!code){
                this.code += "\n" + this.consolePrompt
            }else{
                if (this.language === "python"){
                    if (this.getAttribute("stdout") === "true"){
                        this.attachStd();
                    }
                    let r = pyprez.loadAndRunAsync(code, this.namespace).then(((r)=>{
                        if (this.getAttribute("stdout") === "true"){
                            this.detachStd();
                        }
                        this.printResult(r);
                    }).bind(this))
                    return r
                }else if (this.language === "javascript"){
                    let r = pyprez.namespaceEval(code, this.namespace)
                    return this.printResult(r)
                }
            }
        }
        printResult(r){
            let res;
            if (this.language === "python"){
                if (r === null){
                    r = ""
                }else{
                    res = r?r.toString():""
                }
            }else{
                 res = JSON.stringify(r, null, 2)
            }
            if (!this.code.endsWith("\n")){this.code += "\n"}
            this.code += this.consoleOut + res + "\n" + this.consolePrompt
            return res
        }
        appendLine(v){
            if (v !== null){
                this.code += "\n" + v
            }
        }

        /* ________________________ STDOUT/STDERR _____________________________*/
        attachStd(){
            this.oldstdout = pyprez.stdout
            this.oldstderr = pyprez.stderr
            pyprez.stdout = this.appendLine.bind(this)
            pyprez.stderr = this.appendLine.bind(this)
        }
        detachStd(r){
            if (this.oldstdout){
                pyprez.stdout = this.oldstdout
                pyprez.stderr = this.oldstderr
            }
            return r
        }

        getRunnable(){
            let c = this.code.split("\n").map(line => "    " + line).join("\n")
            let t = this.theme
            return `
<!-- begin snippet: js hide: false console: false babel: false -->
  <!-- language: lang-js -->
    #!/usr/bin/env python
${c}
<!-- language: lang-html -->
<script src="https://modularizer.github.io/pyprez/pyprez.min.js" theme="${t}"></script>
<!-- end snippet -->`
        }
        copyRunnable(){
            let s = this.getRunnable();
            console.log(s);
            navigator.clipboard.writeText(s);
            let originalColor = this.copyRunnableLink.style['background-color'];
            this.copyRunnableLink.style['background-color'] = 'rgb(149, 255, 162)';
            setTimeout((()=>{
                this.copyRunnableLink.style['background-color'] = originalColor;
            }).bind(this),300)
        }
        copyEmbeddable(){
            let c = encodeURIComponent(this.code);
            let t = this.theme;
            let s = `<iframe src="./embed.html?code=${c}&theme=${t}" style="resize:both;overflow:auto;min-width:50%;min-height:500px;"></iframe>`
            console.log(s)
            navigator.clipboard.writeText(s);
            let originalColor = this.copyEmbeddableLink.style['background-color'];
            this.copyEmbeddableLink.style['background-color'] = 'rgb(149, 255, 162)';
            setTimeout((()=>{
                this.copyEmbeddableLink.style['background-color'] = originalColor;
            }).bind(this),300)
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("pyprez-editor", PyPrezEditor);
    })

    /* ___________________________________________________ IMPORT ___________________________________________________ */
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
                console.debug("importing requirements ", requirements, " from <pyprez-import/>", this)
                pyprez.then(()=>{window.pyodide.loadPackage(requirements)}).then(()=>{
                    console.timeEnd("pyprez-import load")
                });
            }
            pyprez.register(this);
        }
        re = /\s*-?\s*(.*?)\s*[==[0-9|.]*]?\s*[,|;|\n]/g
    }
    window.addEventListener("load", ()=>{
        customElements.define("pyprez-import", PyPrezImport);
    })

    /* ___________________________________________________ SCRIPT ___________________________________________________ */
    class PyPrezScript extends HTMLElement{
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
            this.namespace = this.hasAttribute("namespace")?this.getAttribute("namespace"):"global"
            pyprez.recordNamespaceName(this.namespace)
            if (this.hasAttribute("src") && this.getAttribute("src")){
                console.debug("fetching script for pyprez-script src", this.getAttribute("src"))
                fetch(this.getAttribute("src")).then(r=>r.text()).then(this.run)
            }else{
                this.run(this.innerHTML);
            }
            pyprez.register(this);
        }
        run(code){
            console.debug("running code from <pyprez-script>", code, this)
            this.innerHTML = code;
            this.promise = pyprez.loadAndRunAsync(code, this.namespace).then(v=>{
                this.value = v;
                this.innerHTML=v?v.toString():"";
                return v
            })
            return this.promise
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("pyprez-script", PyPrezScript);
    })

    /* ___________________________________________________ CONSOLE ___________________________________________________ */
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

            // bind functions
            this.attachStd = this.attachStd.bind(this)
            this.detachStd = this.detachStd.bind(this)
            this.printResult = this.printResult.bind(this);
            this.eval = this.eval.bind(this);
            this.namespace = this.hasAttribute("namespace")?this.getAttribute("namespace"):"global"
            pyprez.recordNamespaceName(this.namespace)

            // set language to python(default), javascript, or html
            let language = this.hasAttribute("language")?this.getAttribute("language").toLowerCase():"python"
            let aliases = {
                "python": "python",
                "javascript": "javascript",
                "html": "html",
                "py": "python",
                "js": "javascript",
            }
            this.language = aliases[language]

            // get attributes
            let cols = this.hasAttribute("cols")?this.getAttribute("cols"):this.defaultCols
            let rows = this.hasAttribute("rows")?this.getAttribute("rows"):this.defaultRows
            let bg = this.style["background-color"]?this.style["background-color"]:this.defaultBackgroundColor
            let c = this.style["color"]?this.style["color"]:this.defaultTextColor

            // set innerHTML
            this.innerHTML = `<textarea cols="${cols}" rows="${rows}" style="background-color:${bg};color:${c};height:100%;"></textarea>`

            // save child element
            this.textarea = this.children[0]


            // allow loading code from an external source
            let src = false
            if (this.hasAttribute("src") && this.getAttribute("src") && (this.getAttribute("src") !== pyprezScript.src)){
                src = this.getAttribute("src")
                console.debug("fetching script for pyprez-editor src", src)
                if (src.endsWith('.js')){
                    this.language = "javascript"
                }else if (src.endsWith('.py')){
                    this.language = "python"
                }else if (src.endsWith('.html')){
                    this.language = "html"
                }
            }

            this.startup();

            // if src
            if (src){
                this.text += "\n" + this.consolePrompt + "# importing code from " + src
                fetch(src).then(r=>r.text()).then(((code)=>{
                    this.text += "\n" + this.consolePrompt + "# running code from " + src
                    this.eval(code)
                }).bind(this))
            }

            // attach listener
            this.textarea.addEventListener("keydown", this.keydown.bind(this));

            pyprez.register(this);
        }
        defaultCols = 120
        defaultRows = 20
        defaultBackgroundColor = "#000"
        defaultTextColor = "#fff"
        consolePrompt = consolePrompt
        consoleOut = consoleOut
        consoleEscape = consoleEscape

        /* ___________________________________ STARTUP ________________________________ */
        startup(){
            if (this.language === "python"){
                pyprez.loadAndRunAsync(`
                    import sys
                    s = f"""Python{sys.version}
                    Type "help", "copyright", "credits" or "license" for more information."""
                    s
                `, this.namespace).then(v=>{this.text = v + "\n" + this.consolePrompt})
            }else if (this.language === "javascript"){
                this.text += "Simple Javascript Console\n" + this.consolePrompt
            }
        }

        /* ___________________________________ EVENT LISTENERS ________________________________ */
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
          if (k === "Backspace" && (this.text.endsWith(this.consolePrompt) || this.text.endsWith(this.consoleEscape + " "))){
            e.preventDefault();
          }
        }

        /* ___________________________________ PROPERTIES ________________________________ */
        get text(){return this.textarea.value}
        set text(v){this.textarea.value = v}

        /* ___________________________________ METHODS ________________________________ */
        appendLine(v){
            this.text += "\n" + v
        }
        print(v){
            this.text += v;
            this.appendLine(this.consolePrompt);
        }
        printResult(r){
            let res;
            if (this.language === "python"){
                res = r?r.toString():""
            }else{
                 res = JSON.stringify(r, null, 2)
            }
            if (!this.text.endsWith("\n")){this.text += "\n"}
            this.print(this.consoleOut + res)
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
                let r = pyprez.loadAndRunAsync(code, this.namespace)
                .then(this.detachStd, this.detachStd)
                .then(this.printResult)
                return r
            }else if (this.language === "javascript"){
                let r = pyprez.namespaceEval(code, this.namespace)
                return this.printResult(r)
            }

        }
        run(){
            let code = this.text.split(this.consolePrompt).pop().trim().replaceAll(this.consoleEscape, "")
            if (!code){
                this.text += "\n" + this.consolePrompt
            }
            return this.eval(code)
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("pyprez-console", PyPrezConsole);
    })

    /* _________________________________  STACK OVERFLOW RUNNABLE ___________________________________________________ */
    class StackOverflow extends HTMLElement{
        /* element which shows the markdown which can be used to add runnable snippet to stack overflow */
        constructor(){
            super();
            this.classList.add("pyprez");
            if (!this.style.display){
                this.style.display = "flex"
            }
            this._header = "Run code snippet below to work with a runnable and editable python snippet"
            this._runnable = "#!/usr/bin/env python"
            this.innerHTML = this.getInnerHTML()
            pyprez.register(this);
        }
        get header(){
            return this._header
        }
        set header(header){
            this._header = header
            this.innerHTML = this.getInnerHTML()
        }
        get runnable(){
            return this._runnable
        }
        set runnable(runnable){
            this._runnable = runnable.replaceAll('<','&lt').replaceAll('>','&gt')
            this.innerHTML = this.getInnerHTML()
        }
        getInnerHTML(){
            return `
    <pre style="background:#d3d3d3;border-radius:0.5em;padding:1%;margin:1%;" contenteditable="true">
        <svg
            id="copy"
            height="40px"
            width="30px"
            viewBox="0 0 22 27"
            xmlns="http://www.w3.org/2000/svg"
            style="float:right;order: 2;margin-bottom:-40px;cursor:pointer;"
            onclick="navigator.clipboard.writeText(this.parentElement.innerText)">
      <g>
        <path
           style="fill:none;stroke:#000;stroke-width:1;"
           d="M 5,22 h -1 a 2 2 0 0 1 -2 -2 v -16 a 2 2 0 0 1 2 -2 h 11 a 2 2 0 0 1 2 2 v 1"
           id="bottom" />
        <rect
           style="fill:none;stroke:#000;stroke-width:1;"
           id="top"
           width="15"
           height="20"
           x="5"
           y="5"
           rx="2" />
      </g>
    </svg>
${this.header}
    ${this.runnable}
    </pre>
            `
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("stack-overflow", StackOverflow);
    })

    /* _________________________________  STACK OVERFLOW CONVERTER___________________________________________________ */
    class StackOverflowConverter extends HTMLElement{
        /* element which allows live editing python on the left while generating the markdown needed to add runnable
        script to stack overflow */
        constructor(){
            super();
            let ih = this.innerHTML;
            let mode = this.hasAttribute("mode")?`mode=${this.getAttribute("mode")}`:"";
            let src = this.hasAttribute("src")?`src=${this.getAttribute("src")}`:"";
            let namespace = this.hasAttribute("namespace")?this.getAttribute("namespace"):"global";
            pyprez.recordNamespaceName(this.namespace);

            this.innerHTML = `
            <div style="display:flex">
                <div style="flex:50%">
                    <b>Edit your python snippet here...</b>
                </div>
                <div style="flex:50%">
                    <div style="display:flex">
                        <b>then copy-paste this markdown into StackOverflow</b>
                        <div>
                            <a href="https://stackoverflow.com/questions/ask#"><img src="https://stackoverflow.com/favicon.ico" height="15px"/></a>
                            <a href="https://stackoverflow.com/questions/ask#">Draft a Question</a>
                        </div>
                    </div>
                </div>
            </div>
            <div style="display: flex">
                <div style="flex:50%;max-width:50%;">
                    <pyprez-editor ${mode} ${src} namespace="${namespace}" theme="darcula">
                        ${ih}
                    </pyprez-editor>
                </div>
                <div style="flex:50%">
                    <stack-overflow></stack-overflow>
                </div>
            </div>
            `
            this.pyprezEditor = this.children[1].children[0].children[0]
            this.stackOverflow = this.children[1].children[1].children[0]
            this.sync()
            this.pyprezEditor.addEventListener("keydown", (()=>{setTimeout(this.sync.bind(this), 10)}).bind(this))
            this.pyprezEditor.themeSelect.addEventListener("change", (()=>{setTimeout(this.sync.bind(this), 10)}).bind(this))
            codemirrorImported.then((()=>{
                setTimeout(this.sync.bind(this), 1000)
            }).bind(this))
        }
        sync(){
            this.stackOverflow.runnable = this.pyprezEditor.getRunnable();
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("stack-converter",  StackOverflowConverter);
    })

    /*__________________________________ TOOLTIPS _____________________________________________*/
    class TOOLTIP{
      empty={
        id: 'tooltip',
        innerHTML: '',
        style: {
            position: 'absolute',
            'z-index': 100000,
            top: 100,
            left: 100,
            display: 'none',
            opacity: 0.999,
        },
      }
      def={
        style: {
            position: 'relative',
            'background-color': '#fff',
            'border-color': '#606060',
            'border-style': 'solid',
            'border-width': '2px',
            'border-radius': '5px',
            margin: '5px',
            padding: '5px',
            opacity: 0.95,
        }
      }
      trigger= 'mouseover'
      attrNames= ['tooltip', 'learningtooltip']

      hold= false

      constructor(){
        this.el = this.createElement(this.empty)
        domContentLoaded.then(()=>{document.body.append(this.el)})
        this.addEventListener()

        let mouseDown = 0;
        window.addEventListener("mousedown", (e)=>{
            this.mousedown++;
            this.onEvent(e, true);
        })
        window.addEventListener("mouseup", ()=>{
            this.mousedown--
        })

        let enabled = localStorage.getItem("learningModeEnabled") === "true"
         if (enabled){
            this.enableLearningMode()
         }else{
            this.disableLearningMode()
         }
         this.keydownToggle = this.keydownToggle.bind(this)
      }
      mousedown = 0
      hideBlocked = false

      createElement(ob, innerHTML=-1){
        if (innerHTML === -1){
            innerHTML = ob.innerHTML
        }
        let el = document.createElement('div')
        let toggleWarning = document.createElement('div')
        toggleWarning.innerHTML = '<center style="font-size:10px"><pre>spacebar to toggle tooltip</pre></center>'
        let inner = document.createElement('div')
        el.id = ob.id
        for (let [k, v] of Object.entries(ob.style)){
            el.style[k] = v
        }
        inner.innerHTML = innerHTML


        el.appendChild(inner)
    //    el.appendChild(toggleWarning)
        return el
      }

      getDefHTML(t, innerHTML){
        let temp = this.createElement(this.def, t)
        t = temp.outerHTML
        return t
      }

      setInnerHTML(s, def=false){
        if (s.endsWith('#def') | def){
            s = this.getDefHTML(s.split('#def')[0])
        }
        this.el.innerHTML = s
      }
      offsetX=5
      offsetY=5
      show(s, clientY, clientX){
        this.el.style.top = window.scrollY + clientY + this.offsetY + "px"
        let maxLeft = window.innerWidth - this.el.getBoundingClientRect().width - 200
        this.el.style.left = Math.min(clientX + this.offsetX, maxLeft) + "px"
        this.setInnerHTML(s)
        this.el.style.display = 'block'
        maxLeft = window.innerWidth - this.el.getBoundingClientRect().width
        this.el.style.left = Math.min(clientX + this.offsetX, maxLeft) + "px"
        this.hold = true
        document.body.addEventListener("keydown", this.keydownToggle)
        setTimeout(()=>{this.hold = false;}, 100 )
      }

      hide(){
        if (!this.hold){
          if(!this.mousedown){
            this.hideBlocked = !this.hideBlocked
          }
          if (!this.hideBlocked){
              this.el.style.top = 0
              this.el.style.left = 0
              this.el.style.display = 'none'
              this.el.innerHTML = ''
              this.hideTimer = false
              document.body.removeEventListener("keydown", this.keydownToggle)
          }

        }
      }

      keydownToggle(e){
        if (e.key === " "){
            this.toggleLearningMode()
            e.preventDefault();
        }
      }

      get learningMode(){
        return this.attrNames.includes('learningtooltip')
      }
      enableLearningMode(){
        if (!this.learningMode){
            this.attrNames.push('learningtooltip')
        }
        localStorage.setItem("learningModeEnabled", true)
      }
      disableLearningMode(){
        if (this.learningMode){
            this.attrNames.splice(this.attrNames.indexOf('learningtooltip'),1)
        }
        this.hide()
        localStorage.setItem("learningModeEnabled", false)
      }
      toggleLearningMode(){
        if(this.learningMode){
            this.disableLearningMode()
        }else{
            this.enableLearningMode()
        }
      }

      onEvent(event, click=false){
        let attrNames = this.attrNames
        if (click){
            attrNames = attrNames.concat(['clicktooltip'])
        }

        let p = event.path
          let i=0;
          let found=false;
          if (p.length>4){
            while(!found && i<(p.length-4)){
               let _found = false
               for (let attrName of attrNames){
                   if (p[i].hasAttribute){
                    if (p[i].hasAttribute(attrName)){
                      _found = p[i]
                      this.show(_found.getAttribute(attrName), event.clientY, event.clientX)
                    }
                  }
               }
               found = _found

              i++;
            }
          }
          if (!found){
            this.hide()
          }
        }

      addEventListener(){
        window.addEventListener(this.trigger, this.onEvent.bind(this))

      }
    }

    var tooltip = new TOOLTIP()

}else{
    // if the user is using the script tag as a code block, add a real code block to the document
    pyprezConvert();
}



