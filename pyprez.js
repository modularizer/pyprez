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
    }
    let strConfig = {
        codemirrorCDN: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/6.65.7/",
        pyodideCDN: "https://cdn.jsdelivr.net/pyodide/v0.20.0/full/pyodide.js",
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
                        theme: "default",
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
                console.error(data.id, data, this, this.pendingRequests);
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
                        console.error(pyodide)
                        window.pyodide = pyodide;
                        console.warn(window.pyodidePromise)
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
                    `).then(r=>{
                        if (r == 4){
                            window.pyodide = pyodide;
                            pyodidePromise.resolve(true);
                        }
                    })
                })
            })
        }
        return pyodidePromise
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
            loadPyodideInterface(this.config)
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

        _runPythonAsync(code){
            /* internal function which runs the code */
            if (code){
                console.debug("running code asynchronously:")
                console.debug(code)

                return pyodide.runPythonAsync(code).catch(this.stderr)
            }
        }

        // utility methods used to load requirements and run code asynchronously as soon as pyodide is loaded
        load(code, requirements="detect"){
            /*load required packages as soon as pyodide is loaded*/
            return this.then(() =>{
                let requirementsLoaded;
                if (requirements === "detect"){
                    if (code){
                        console.debug("auto loading packages detected in code")
                        console.debug(code)
                        requirementsLoaded = window.pyodide.loadPackagesFromImports(code)
                    }
                }else{
                    console.debug("loading", requirements)
                    requirementsLoaded = window.pyodide.loadPackage(requirements);
                }
                return requirementsLoaded
            })
        }
        loadAndRunAsync(code, requirements="detect"){
            /* run a python script asynchronously as soon as pyodide is loaded and all required packages are imported*/
            console.warn(pyodidePromise)
            let p = this.then((() =>{
                console.error("here")
                if (code){
                    return this.load(code, requirements)
                        .then((r => this._runPythonAsync(code)).bind(this))
                        .catch((e => this._runPythonAsync(code)).bind(this))
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
                    console.warn("got", code)
                    this.innerHTML = code;
                    this.loadEl();
                })
            }else{
                this.loadEl();
            }

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
            let extraIndent = " ".repeat(extraLeadingSpaces);// string representing extra indent to remove
            code = lines.map(v=>v.startsWith(extraIndent)?v.replace(extraIndent, ""):v).join("\n") // remove extra space
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
        _loadEditor(){
            /* first load the editor as though codemirror does not and will not exist*/

            // check whether to add github link to top based on attributes
            let githublink = this.hasAttribute("githublink")?this.getAttribute("githublink")==="true":false
            let gh = githublink?githublinkImage:"<div></div>"

            // check whether to add a message bar to the top of the element
            let help= this.hasAttribute("help")?this.getAttribute("help")==="true":window.help;

            // make top bar above codemirror
            let top = ""
            if (help){
                top = `<div style="background-color:#d3d3d3;border-color:#808080;border-radius:3px;display:flex">
                    ${gh}
                    <div style="margin-left:10px;overflow:hidden;"></div>
                    <select style="order:2;margin-left:auto;background-color:#f0f0f0;border-radius:3px;">
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
                    <div style="display:none;margin-left:10px;overflow:hidden;"></div>
                    <select style="order:2;margin-left:auto;background-color:#f0f0f0;border-radius:3px;">
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
            this.select = this.children[1].children[2]
            this.textarea = this.children[2] // textarea in case codemirror does not load
            this.endSpace = this.children[3]

            // add click event to start button
            this.start.addEventListener("click", this.startClicked.bind(this))
            this.select.addEventListener("change", ((e)=>{
                localStorage.setItem("codemirrorTheme", this.select.value);
                this.theme = this.select.value;
            }).bind(this))

            // size text area to fit initial code
            this.textarea.style.height = this.textarea.scrollHeight +"px" // set text area to full height
            let longestLine = this.initialCode.split("\n").map(v=>v.length).reduce((a,b)=>a>b?a:b)
            let fontSize = 1 * window.getComputedStyle(this.textarea).fontSize.slice(0,-2)
            let w = Math.min(window.innerWidth - 50, Math.ceil(longestLine * fontSize) + 200)
//            this.children[1].style.width = w +"px"
//            this.textarea.style.width = w  + "px"
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

            let cmt = localStorage.getItem("codemirrorTheme");
            cmt = cmt?cmt:this.theme;
            localStorage.setItem("codemirrorTheme", cmt);
            this.select.value = cmt;
            this.theme = cmt;
        }

        /* ________________________ EVENTS _____________________________*/
        keypressed(e){
            /* Shift + Enter to run, Shift + Backspace to reload */
            if (e.shiftKey){
                if (e.key == "Enter"){this.run(); e.preventDefault();}
                else if (e.key == "Backspace"){this.reset(); e.preventDefault();}
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
                v = v.replaceAll("<", "&lt").replaceAll(">", "gt")
            }

            if (this.editor){
                this.editor.setValue(v);
                this.editor.doc.setGutterMarker(0, "start", this.start);

                // scroll to bottom of element
                let si = this.editor.getScrollInfo();
                this.editor.scrollTo(0, si.height);
            }else{
                this.textarea.value = v;

                // scroll to bottom of element
                this.textarea.scrollTop = this.textarea.scrollHeight;
            }

            // scroll down on page until bottom of element is in view
            let bb = this.getBoundingClientRect();
            if (bb.bottom > window.innerHeight){
                window.scrollTo(0, bb.bottom)
            }
        }

        // get/set the codemirror theme, importing from cdn if needed
        get theme(){return this.editor.options.theme}
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
            this.code = this.executed;
            console.warn("Setting code to ", this.executed, this.code)
            this.executed = false;
            this.done = false
        }
        run(){
            console.log("run", this.done)
            if(this.done){
                this.consoleRun()
            }else if (this.code){
                this.message = "Running..."
                let code = this.code.split(this.separator)[0];
                this.executed = code;
                this.code = code;
                this.start.style.color = "yellow"
                let promise;
                if (this.language == "python"){
                    this.code += this.separator;
                    if (this.getAttribute("stdout") === "true"){
                        this.attachStd();
                    }
                    promise = pyprez.loadAndRunAsync(code);
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
                    let r = eval(code)
                    this.done = true
                    this.code += "\n" + this.consolePrompt + JSON.stringify(r, null, 2);
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
                    let r = pyprez.loadAndRunAsync(code).then(((r)=>{
                        if (this.getAttribute("stdout") === "true"){
                            this.detachStd();
                        }
                        this.printResult(r);
                    }).bind(this))
                    return r
                }else if (this.language === "javascript"){
                    let r = eval(code)
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
            this.promise = pyprez.loadAndRunAsync(code).then(v=>{
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

            if (this.language === "python"){
                pyprez.loadAndRunAsync(`
                    import sys
                    s = f"""Python{sys.version}
                    Type "help", "copyright", "credits" or "license" for more information."""
                    s
                `).then(v=>{this.text = v + "\n" + this.consolePrompt})
            }else if (this.language === "javascript"){
                this.text += "Simple Javascript Console\n" + this.consolePrompt
            }

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
                `).then(v=>{this.text = v + "\n" + this.consolePrompt})
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
                let r = pyprez.loadAndRunAsync(code)
                .then(this.detachStd, this.detachStd)
                .then(this.printResult)
                return r
            }else if (this.language === "javascript"){
                let r = eval(code)
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
            this._header = "Run the javascript snippet below to see a runnable Python example:"
            this._code = "# your code here"
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
        get code(){
            return this._code
        }
        set code(code){
            this._code = code
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
    ${this.getRunnable()}
    </pre>
            `
        }
        getRunnable(){
            return `${this.header}
    &lt!-- begin snippet: js hide: false console: false babel: false --&gt

      &lt!-- language: lang-js --&gt
        # keep this comment
        ${this.code}

     &lt!-- language: lang-html --&gt

        &ltscript src=${preferredPyPrezImportSrc}&gt&lt/script&gt

    &lt!-- end snippet --&gt
    </pre>`
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
            this.innerHTML = `
            <div style="display:flex">
                <div style="flex:50%">
                    <b>Edit your python snippet here...</b>
                </div>
                <div style="flex:50%">
                    <b>then copy-paste this auto-generated markdown into StackOverflow</b>
                </div>
            </div>
            <div style="display: flex">
                <div style="flex:50%">
                    <pyprez-editor ${mode} ${src}>
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
        }
        sync(){
            this.stackOverflow.code = this.pyprezEditor.code
        }
    }
    window.addEventListener("load", ()=>{
        customElements.define("stack-converter",  StackOverflowConverter);
    })
}else{
    // if the user is using the script tag as a code block, add a real code block to the document
    pyprezConvert();
}