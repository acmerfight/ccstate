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
});
