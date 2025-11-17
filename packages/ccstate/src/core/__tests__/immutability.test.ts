import { describe, expect, it } from 'vitest';
import { command, computed, createStore, state } from '..';

describe('immutability protection (#182)', () => {
  it('should prevent direct mutation of array from get()', () => {
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

  it('should prevent mutation of nested array in object', () => {
    interface User {
      id: number;
      tags: string[];
    }

    const store = createStore();
    const user$ = state<User>(
      { id: 1, tags: ['user', 'admin'] },
      {
        debugLabel: 'user$',
      },
    );

    const user = store.get(user$);

    // TDD: This test expects mutation to be prevented
    expect(() => {
      user.tags.push('superuser');
    }).toThrow();
  });

  it('should prevent mutation of Map returned by get()', () => {
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

  it('should prevent mutation of nested array in Map (#182 reproduction)', () => {
    const store = createStore();
    const nodeChildren$ = state(new Map<string, string[]>([['parent1', ['child1', 'child2']]]), {
      debugLabel: 'nodeChildren$',
    });

    const myCommand$ = command(({ get }) => {
      const map = get(nodeChildren$);
      const children = map.get('parent1');

      // TDD: This test expects mutation to be prevented
      // This is the exact bug from issue #182
      expect(() => {
        children?.push('child3');
      }).toThrow();
    });

    store.set(myCommand$);
  });

  it('should prevent mutation inside command context', () => {
    const store = createStore();
    const count$ = state(
      { count: 0, history: [0] },
      {
        debugLabel: 'count$',
      },
    );

    const increment$ = command(({ get }) => {
      const current = get(count$);

      // TDD: These mutations should be prevented
      expect(() => {
        current.count++;
      }).toThrow();

      expect(() => {
        current.history.push(1);
      }).toThrow();
    });

    store.set(increment$);
  });

  it('should prevent mutation of Set returned by get()', () => {
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

  it('should prevent mutation in computed getter', () => {
    const store = createStore();
    const base$ = state([1, 2, 3], {
      debugLabel: 'base$',
    });
    const derived$ = computed(
      (get) => {
        const arr = get(base$);

        // TDD: This test expects mutation to be prevented
        expect(() => {
          arr.push(4);
        }).toThrow();

        return arr.length;
      },
      {
        debugLabel: 'derived$',
      },
    );

    store.get(derived$);
  });

  it('should prevent property assignment on frozen object', () => {
    const store = createStore();
    const obj$ = state(
      { value: 1 },
      {
        debugLabel: 'obj$',
      },
    );

    const obj = store.get(obj$);

    // TDD: This test expects mutation to be prevented
    expect(() => {
      obj.value = 2;
    }).toThrow();
  });

  it('should prevent property deletion on frozen object', () => {
    const store = createStore();
    const obj$ = state<{ value: number; extra?: number }>(
      { value: 1, extra: 2 },
      {
        debugLabel: 'obj$',
      },
    );

    const obj = store.get(obj$);

    // TDD: This test expects mutation to be prevented
    expect(() => {
      delete obj.extra;
    }).toThrow();
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

    const obj = store.get(deep$);

    // TDD: This test expects mutation to be prevented at all levels
    expect(() => {
      obj.level1.level2.level3.push('c');
    }).toThrow();
  });
});
