/*https://pyodide.org/en/stable/usage/webworker.html*/
// Setup your project to serve `py-worker.js`. You should also serve
// `pyodide.js`, and all its associated `.asm.js`, `.data`, `.json`,
// and `.wasm` files as well:
importScripts("https://cdn.jsdelivr.net/pyodide/v0.21.3/full/pyodide.js");


self.stdout = (message)=>{self.postMessage({id: "stdout", message})}
self.stderr = (message)=>{self.postMessage({id: "stderr", message})}

async function loadPyodideAndPackages() {
  self.pyodide = await loadPyodide({
    stdout: self.stdout,
    stderr: self.stderr,
  });
}
let pyodideReadyPromise = loadPyodideAndPackages();

self.onmessage = async (event) => {
  // make sure loading is done
  await pyodideReadyPromise;
  // Don't bother yet with this line, suppose our API is built in such a way:
  const { id, python, method, ...context } = event.data;
  // The worker copies the context in its own "memory" (an object mapping name to values)
  for (const key of Object.keys(context)) {
    self[key] = context[key];
  }
  // Now is the easy part, the one that is similar to working in the main thread:
  try {
    if (method === "runPythonAsync"){
        await self.pyodide.loadPackagesFromImports(python);
        let results = await self.pyodide.runPythonAsync(python);
        self.postMessage({ results, id });
    }else if (method === "loadPackagesFromImports"){
        let results = await self.pyodide.loadPackagesFromImports(python);
        self.postMessage({ results, id });
    }

  } catch (error) {
    self.postMessage({ error: error.message, id });
  }
};