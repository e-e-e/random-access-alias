const raf = require("random-access-file");

module.exports = { create };

/**
 * Creates a new storage constructor function that transforms given filenames with provided resolver function.
 *
 * @typedef {function(string): string | Promise<string>} Resolver
 * @param {Resolver} resolver function to translate given filename to real file location.
 * @param {RandomAccessStorage=} storage Defaults to RandomAccessFile when unspecified.
 *
 * @returns {function(string, object=): Proxy<RandomAccessStorage>} Proxy wrapper of provided storage type.
 */
function create(resolver, storage) {
  // Default to random access file storage
  if (!storage) storage = raf;
  return (filename, options) => {
    // Queue to keep track of all operations on storage before name has been resolved;
    let queue = [];
    let failed = false;
    let store;

    // Function to run all methods in the queue once storage is ready and dispose of queue afterwards.
    const flushDeferredMethods = () => {
      queue.forEach(deferred => {
        Reflect.apply(Reflect.get(store, deferred.prop), store, deferred.args);
      });
      queue = [];
    };

    // Function to flush all deferred method calls in the queue with error state.
    const flushDeferredWithErrorState = err => {
      queue.forEach(deferred => {
        if (deferred.prop === "on" && deferred.args[0] !== "error") return;
        const lastArg = deferred.args[deferred.args.length - 1];
        if (typeof lastArg !== "function") return;
        lastArg(err);
      });
      queue = [];
    };
    // Create functions which save function alls into queue for later execution.
    const createDeferrer = prop => (...args) => queue.push({ prop, args });
    // Create table lookup for properties on Abstract Storage interface for use before
    // the real storage is available.
    const deferred = [
      "write",
      "read",
      "stat",
      "del",
      "close",
      "destroy",
      "on"
    ].reduce(
      (p, prop) => {
        p[prop] = createDeferrer(prop);
        return p;
      },
      {
        opened: false,
        destroyed: false,
        closed: false
      }
    );

    // Resolve filename alias
    Promise.resolve(resolver(filename))
      .then(realName => {
        if (!realName || typeof realName !== "string") {
          throw new Error(
            "Invalid filename alias. Alias must be non-empty string."
          );
        }
        store = storage(realName, options);
        flushDeferredMethods();
      })
      .catch(e => {
        failed = true;
        flushDeferredWithErrorState(e);
      });

    // Return Proxy which defers all method calls until the filename is resolved and the real store is ready to be used.
    return new Proxy(
      {},
      {
        get: (_, prop, receiver) => {
          // If store is ready simply proxy to the store.
          if (store) {
            return Reflect.get(store, prop, receiver);
          }
          // Always throw error if there was an error in resolving the alias filename.
          if (failed) {
            throw new Error("Store not setup: Alias resolution failed!");
          }
          const value = deferred[prop];
          // If value is not mirrored we throw an error.
          if (!value) throw new Error("Aliased store is not ready yet");
          return value;
        }
      }
    );
  };
}
