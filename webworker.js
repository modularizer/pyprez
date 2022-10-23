/*https://pyodide.org/en/stable/usage/webworker.html*/
importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");


/* ___________________________________________ DEFERRED PROMISE _________________________________________________ */
class DeferredPromise{
    /* this is an object which creates a promise in a different spot from where it will be resolve. It allows you
    to say wait on athe completion of a task that you have not yet started. The interface is similar to
    that of a promise (supports `then`, `catch` and if you wish you can access the true promise with
    the `promise` attribute.*/
    constructor(){
        this.fulfilled = false
        this.rejected = false
        this.resolve = this.resolve.bind(this)
        this.reject = this.reject.bind(this)
        this._resolve = ()=>{}
        this._reject = ()=>{}
        this.promise = new Promise((resolve, reject)=>{
            this._resolve = resolve
            this._reject = reject
        })
    }
    resolve(r){
        this.fulfilled=true;
        this.result = r;
        this._resolve(r);
    }
    reject(e){
        this._reject(e)
        this.rejected=true;
        this.error = e;
    }
    then(onfulfilled, onrejected){return this.promise.then(onfulfilled, onrejected)}
    catch(onrejected){return this.promise.catch(onrejected)}
}
/* ___________________________________________ INTERFACE _________________________________________________ */
let workerReady = new DeferredPromise();
let pyodidePromise = new DeferredPromise();

class Interface{
        constructor(){
            this.parent = self;
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
            workerReady.resolve(this);
            return this.proxy
        }
        _id = 0
        get id(){
            let id = this._id
            this._id = (id + 1) % Number.MAX_SAFE_INTEGER;
            return id
        }

        pendingRequests = {}
        receivemessage(event){
            console.warn("received", event.data)
            let data = Object.assign({}, event.data)
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
            let [deferredPromise, sentData] = this.pendingRequests[data.id];
            delete this.pendingRequests[data.id];
            if (data.results){deferredPromise.resolve(data.results)}
            else{ deferredPromise.reject(data.error)}
        }
        receiveCallRequest(data){
            let f = this.getMethod(data.method);
            console.warn("F", f)
            if (f){ return f(...data.args)}
            else{this.postError(data, "method not found:" + self.pyodide)}
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
self.interface = new Interface();
self.interface.postMessage = (data)=>{self.postMessage(data)}
self.onmessage = async (event) => {
    self.interface.receivemessage(event)
}

/* ___________________________________________ REST _________________________________________________ */
self.stdout = (message)=>{self.interface.postCall("stdout", [message])}
self.stderr = (message)=>{self.interface.postCall("stderr", [message])}
self.stdin = ()=>{self.interface.postRequest("stdin", [])}


function loadPyodideAndPackages() {
  return loadPyodide({
    stdout: self.stdout,
    stderr: self.stderr,
    stdin: self.stdin,
  }).then(pyodide=>{
    self.pyodide = pyodide;
    self.interface.parent = self.pyodide;
    pyodide.runPythonAsync(`
        def try_to_input(msg):
            print(msg)
            raise Exception('input function not implemented in webworker, please specify webworker="false"')

    `).then(r=>{
        pyodidePromise.resolve(pyodide);
        self.postMessage({id: -1, type:"call", method:"workerReady.resolve", args: [], results: false, error: null})
    })
  })
}
loadPyodideAndPackages();


