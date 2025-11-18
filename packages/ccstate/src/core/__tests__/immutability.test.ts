import { describe, expect, it } from 'vitest';
import { command, computed, createStore, state } from '..';

describe('immutability protection (#182)', () => {
  it('should prevent mutation of array from get', () => {
    const store = createStore();
    const array$ = state(['a', 'b', 'c'], {
      debugLabel: 'array$',
    });

    const arr = store.get(array$);

    // TDD: This test expects mutation to be prevented
    // Currently this will NOT throw - demonstrating the problem exists
    expect(() => {
      arr.push('d');
    }).toThrow();
  });

  it('should prevent mutation of object properties', () => {
    const store = createStore();
    const obj$ = state<{ value: number; extra?: string }>(
      { value: 1, extra: 'test' },
      {
        debugLabel: 'obj$',
      },
    );

    const obj = store.get(obj$);

    // TDD: Both property assignment and deletion should be prevented
    expect(() => {
      obj.value = 2;
    }).toThrow();

    expect(() => {
      delete obj.extra;
    }).toThrow();
  });

  it('should prevent mutation of Map', () => {
    const store = createStore();
    const map$ = state(new Map([['key1', 'value1']]), {
      debugLabel: 'map$',
    });

    const map = store.get(map$);

    // TDD: This test expects mutation to be prevented
    expect(() => {
      map.set('key2', 'value2');
    }).toThrow();
  });

  it('should prevent mutation of Set', () => {
    const store = createStore();
    const set$ = state(new Set([1, 2, 3]), {
      debugLabel: 'set$',
    });

    const s = store.get(set$);

    // TDD: This test expects mutation to be prevented
    expect(() => {
      s.add(4);
    }).toThrow();
  });

  it('should prevent mutation of nested array in Map (#182 reproduction)', () => {
    const store = createStore();
    const nodeChildren$ = state(new Map<string, string[]>([['parent1', ['child1', 'child2']]]), {
      debugLabel: 'nodeChildren$',
    });

    const verifyImmutability$ = command(({ get }) => {
      const map = get(nodeChildren$);
      const children = map.get('parent1');

      // TDD: This is the exact bug from issue #182
      // Nested arrays within Map should be frozen
      expect(() => {
        children?.push('child3');
      }).toThrow();
    });

    store.set(verifyImmutability$);
  });

  it('should prevent mutation of deeply nested structures', () => {
    interface DeepStructure {
      level1: {
        level2: {
          level3: string[];
        };
      };
    }

    const store = createStore();
    const deep$ = state<DeepStructure>(
      {
        level1: {
          level2: {
            level3: ['a', 'b'],
          },
        },
      },
      {
        debugLabel: 'deep$',
      },
    );

    const verifyDeepFreeze$ = computed((get) => {
      const obj = get(deep$);

      // TDD: Deep freezing should prevent mutation at all levels
      expect(() => {
        obj.level1.level2.level3.push('c');
      }).toThrow();

      return obj.level1.level2.level3.length;
    });

    store.get(verifyDeepFreeze$);
  });

  it('should freeze non-enumerable properties with nested objects', () => {
    const store = createStore();

    // Create an object with non-enumerable property containing nested object
    const objWithHidden = { public: { value: 1 } };
    Object.defineProperty(objWithHidden, 'hidden', {
      value: { nested: { data: 2 } },
      enumerable: false, // Non-enumerable
      writable: true,
      configurable: true,
    });

    const state$ = state(objWithHidden, {
      debugLabel: 'nonEnumState$',
    });

    const result = store.get(state$);

    // Verify public property is frozen (baseline)
    expect(() => {
      result.public.value = 999;
    }).toThrow();

    // Critical: Verify non-enumerable property is also frozen
    // This test ensures Reflect.ownKeys() is used instead of Object.keys()
    const hidden = (result as unknown as { hidden: { nested: { data: number } } }).hidden;
    expect(() => {
      hidden.nested.data = 999;
    }).toThrow();
  });

  it('should freeze Symbol properties with nested objects', () => {
    const store = createStore();

    const symKey = Symbol('secretData');
    const objWithSymbol = {
      public: { value: 1 },
      [symKey]: { nested: { data: 2 } },
    };

    const state$ = state(objWithSymbol, {
      debugLabel: 'symbolState$',
    });

    const result = store.get(state$);

    // Verify Symbol property is frozen
    // This test ensures Reflect.ownKeys() captures Symbol keys (Object.keys() wouldn't)
    const symbolValue = (result as Record<symbol, { nested: { data: number } }>)[symKey];
    expect(() => {
      symbolValue.nested.data = 999;
    }).toThrow();
  });

  it('should freeze function properties with nested objects', () => {
    const store = createStore();

    // Create a state with a function that has nested object properties
    // This edge case, though rare, can occur in state management
    const handler = function processData() {
      return 42;
    };
    // Add metadata to the function (rare but possible)
    (handler as { metadata?: { config: { value: number } } }).metadata = {
      config: { value: 1 },
    };

    const stateWithFunction = {
      data: { value: 10 },
      handler,
    };

    const state$ = state(stateWithFunction, {
      debugLabel: 'functionState$',
    });

    const result = store.get(state$);

    // Verify regular data is frozen (baseline)
    expect(() => {
      result.data.value = 999;
    }).toThrow();

    // Critical: Verify function properties are also frozen
    // This ensures MDN standard compliance: freezing functions and their properties
    const resultHandler = result.handler as {
      metadata?: { config: { value: number } };
    };
    expect(() => {
      if (resultHandler.metadata) {
        resultHandler.metadata.config.value = 999;
      }
    }).toThrow();
  });

  it('should prevent Map methods deletion and reassignment', () => {
    const store = createStore();
    const map$ = state(new Map([['a', 1]]), {
      debugLabel: 'methodProtectionMap$',
    });

    const frozenMap = store.get(map$);

    // Verify methods are protected via Object.defineProperties
    // configurable: false prevents deletion
    // writable: false prevents reassignment
    expect(Object.getOwnPropertyDescriptor(frozenMap, 'set')?.configurable).toBe(false);
    expect(Object.getOwnPropertyDescriptor(frozenMap, 'set')?.writable).toBe(false);
  });

  it('should freeze WeakMap and prevent mutations', () => {
    const store = createStore();

    const key1 = { id: 1 };
    const key2 = { id: 2 };
    const weakMap = new WeakMap<{ id: number }, string>([
      [key1, 'value1'],
      [key2, 'value2'],
    ]);

    const state$ = state(
      { cache: weakMap },
      {
        debugLabel: 'weakMapState$',
      },
    );

    const result = store.get(state$);

    // Verify WeakMap mutations are prevented
    expect(() => {
      result.cache.set({ id: 3 }, 'value3');
    }).toThrow();

    expect(() => {
      result.cache.delete(key1);
    }).toThrow();
  });

  it('should freeze WeakSet and prevent mutations', () => {
    const store = createStore();

    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const weakSet = new WeakSet<{ id: number }>([obj1, obj2]);

    const state$ = state(
      { refs: weakSet },
      {
        debugLabel: 'weakSetState$',
      },
    );

    const result = store.get(state$);

    // Verify WeakSet mutations are prevented
    expect(() => {
      result.refs.add({ id: 3 });
    }).toThrow();

    expect(() => {
      result.refs.delete(obj1);
    }).toThrow();
  });
});
