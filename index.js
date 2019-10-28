const raf = require("random-access-file");
const lru = require("lru");

module.exports = RandomAccessAlias;

function RandomAccessAlias(resolver, storage) {
  // Default to random access file storage
  if (!storage) storage = raf;
  // Cache to store recently resolved filenames to speed up retrieval of commonly references.
  const cache = lru(128);
  return (filename, options) => {
    // Queue to keep track of all operations on storage before name has been resolved;
    let queue = [];
    let store;
    let error;

    // Method to run all methods in the queue once storage is ready and dispose of queue afterwards.
    const flushDeferredMethods = () => {
      queue.forEach(deferred => {
        Reflect.apply(Reflect.get(store, deferred.prop), store, deferred.args);
      });
      queue = [];
    };
    // if filename is already in cache return storage without proxy.
    if (cache.get(filename)) {
      return storage(cache.get(filename));
    }
    // Resolve filename alias
    Promise.resolve(resolver(filename))
      .then(realName => {
        if (!realName || realName !== "string") {
          throw new Error(
            "Invalid Filename alias. Alias must be non-empty string"
          );
        }
        // Save to cache
        cache.set(filename, realName);
        store = storage(realName, options);
        flushDeferredMethods();
      })
      .catch(e => {
        error = e;
        // should flush queue with errors in callbacks;
      });
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
          if (error) {
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
