// v0.4 koffi-shim（no-console-patch 生成，__DSH_KOFFI_SHIM_V0_4__）
import koffi from "../node_modules/koffi/index.js";
const MARK = '__dshNoConsolePatched';
if (koffi && typeof koffi.load === 'function' && !koffi[MARK]) {
  const proxyCache = new WeakMap();
  const origLoad = koffi.load;
  koffi.load = function (...args) {
    const lib = origLoad.apply(this, args);
    if (lib && typeof lib.func === 'function') {
      let proxied = proxyCache.get(lib);
      if (!proxied) {
        proxied = new Proxy(lib, {
          get(target, prop, receiver) {
            if (prop === 'func') {
              return function () {
                const fn = target.func.apply(target, arguments);
                if (arguments[1] === 'CreateProcessAsUserW' && typeof fn === 'function') {
                  return function (...callArgs) {
                    if (callArgs.length >= 7) {
                      const flags = callArgs[6];
                      if (typeof flags === 'number' && (flags & 0x08000000) === 0) callArgs[6] = flags | 0x08000000;
                    }
                    return fn.apply(this, callArgs);
                  };
                }
                return fn;
              };
            }
            return Reflect.get(target, prop, receiver);
          }
        });
        proxyCache.set(lib, proxied);
      }
      return proxied;
    }
    return lib;
  };
  koffi[MARK] = true;
}
export default koffi;
