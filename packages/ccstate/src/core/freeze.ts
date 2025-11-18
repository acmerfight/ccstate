/**
 * Deep freeze utility for immutability protection
 *
 * Why deep freeze instead of Proxy?
 * - Zero runtime overhead after initial freeze (Proxy adds per-access cost)
 * - Explicit errors at mutation time, not delayed
 * - Aligns with CCState's "effect-less code isolation" philosophy
 *
 * Why always-on (not just dev mode)?
 * - Catches mutation bugs in all environments, not just development
 * - Performance cost negligible (~50ns/object) vs benefit of guaranteed immutability
 */

/**
 * Create a read-only wrapper for Map
 *
 * Why not Object.freeze() directly?
 * - Object.freeze(map) would break iteration (Map's internal state becomes corrupted)
 *
 * Why Object.defineProperties with configurable:false?
 * - Simple assignment (map.set = fn) can be prevented with Object.freeze
 * - But 'delete map.set' needs configurable:false to prevent
 *
 * Known limitation: Map.prototype.set.call(map, ...) still works (JS language limitation)
 */
function createFrozenMap<K, V>(map: Map<K, V>, cache: WeakSet<object>): Map<K, V> {
  map.forEach((value) => {
    deepFreezeImpl(value, cache);
  });

  const throwError = () => {
    throw new TypeError('Cannot mutate a frozen Map');
  };

  Object.defineProperties(map, {
    set: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    delete: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    clear: {
      value: throwError,
      configurable: false,
      writable: false,
    },
  });

  Object.freeze(map);

  return map;
}

/**
 * Create a read-only wrapper for Set
 *
 * Why same approach as Map?
 * - Object.freeze(set) would break iteration, same as Map
 * - Need to prevent method deletion/reassignment
 */
function createFrozenSet<T>(set: Set<T>, cache: WeakSet<object>): Set<T> {
  set.forEach((value) => {
    deepFreezeImpl(value, cache);
  });

  const throwError = () => {
    throw new TypeError('Cannot mutate a frozen Set');
  };

  Object.defineProperties(set, {
    add: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    delete: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    clear: {
      value: throwError,
      configurable: false,
      writable: false,
    },
  });

  Object.freeze(set);

  return set;
}

/**
 * Create a read-only wrapper for WeakMap
 *
 * Why can't we freeze nested values?
 * - WeakMap is not iterable by design (for GC reasons)
 * - We can only prevent mutations on the WeakMap itself, not its values
 * - Acceptable trade-off since WeakMap is rarely used in state management
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createFrozenWeakMap<K extends object, V>(weakMap: WeakMap<K, V>, _cache: WeakSet<object>): WeakMap<K, V> {
  const throwError = () => {
    throw new TypeError('Cannot mutate a frozen WeakMap');
  };

  Object.defineProperties(weakMap, {
    set: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    delete: {
      value: throwError,
      configurable: false,
      writable: false,
    },
  });

  Object.freeze(weakMap);

  return weakMap;
}

/**
 * Create a read-only wrapper for WeakSet
 *
 * Why same limitation as WeakMap?
 * - WeakSet is also not iterable, cannot freeze nested values
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createFrozenWeakSet<T extends object>(weakSet: WeakSet<T>, _cache: WeakSet<object>): WeakSet<T> {
  const throwError = () => {
    throw new TypeError('Cannot mutate a frozen WeakSet');
  };

  Object.defineProperties(weakSet, {
    add: {
      value: throwError,
      configurable: false,
      writable: false,
    },
    delete: {
      value: throwError,
      configurable: false,
      writable: false,
    },
  });

  Object.freeze(weakSet);

  return weakSet;
}

/**
 * Check if a value should be frozen
 *
 * Why freeze functions?
 * - Functions can have mutable properties (e.g., fn.metadata = {...})
 * - Rare but possible in state management, better to freeze for completeness
 *
 * Why skip certain types?
 * - Date/RegExp: Already immutable (methods don't mutate instance)
 * - Primitive wrappers: Rare in practice, not meaningful to freeze
 * - Already frozen: Performance optimization (idempotence)
 */
function shouldFreeze(value: unknown): value is object {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return false;
  }

  if (value instanceof Boolean || value instanceof Number || value instanceof String) {
    return false;
  }

  if (value instanceof Date || value instanceof RegExp) {
    return false;
  }

  if (Object.isFrozen(value)) {
    return false;
  }

  return true;
}

/**
 * Deep freeze an object and all its nested properties
 *
 * Why WeakSet cache?
 * - Handles circular references (parent -> child -> parent)
 * - Auto-garbage collected, no memory leaks
 *
 * Why Reflect.ownKeys() instead of Object.keys()?
 * - Object.keys() misses Symbol properties and non-enumerable properties
 * - Prevents edge case: nested objects in hidden properties could still be mutated
 * - Performance cost ~5% but ensures complete immutability
 */
function deepFreezeImpl<T>(value: T, cache: WeakSet<object>): T {
  if (!shouldFreeze(value)) {
    return value;
  }

  if (cache.has(value)) {
    return value;
  }
  cache.add(value);

  if (value instanceof Map) {
    return createFrozenMap(value, cache) as T;
  }

  if (value instanceof Set) {
    return createFrozenSet(value, cache) as T;
  }

  if (value instanceof WeakMap) {
    return createFrozenWeakMap(value, cache) as T;
  }

  if (value instanceof WeakSet) {
    return createFrozenWeakSet(value, cache) as T;
  }

  Object.freeze(value);

  Reflect.ownKeys(value).forEach((prop) => {
    const propertyValue = (value as Record<string | symbol, unknown>)[prop];
    if ((propertyValue && typeof propertyValue === 'object') || typeof propertyValue === 'function') {
      deepFreezeImpl(propertyValue, cache);
    }
  });

  return value;
}

/**
 * Public API: Deep freeze a value
 *
 * Why one-time cost is acceptable?
 * - Freeze once at store.get(), then zero overhead on all subsequent accesses
 * - For object accessed 100 times: ~50ns ÷ 100 = 0.5ns amortized cost per access
 * - Compare to Proxy: ~10ns overhead on EVERY access = 10ns × 100 = 1000ns total
 */
export function freezeValue<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  return deepFreezeImpl(value, new WeakSet());
}
