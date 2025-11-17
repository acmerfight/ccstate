import { bench, describe } from 'vitest';
import { createStore } from '../store/store';
import { state, computed } from '../signal/factory';
import { freezeValue } from '../freeze';

describe('freeze performance impact', () => {
  describe('small objects (< 10 properties)', () => {
    const smallObj = { a: 1, b: 2, c: 3 };
    const smallState$ = state(smallObj);

    bench('baseline: get without freeze', () => {
      // Simulate getting value without freeze
      const value = smallObj;
      return value.a;
    });

    bench('with freeze: direct freeze', () => {
      const value = freezeValue(smallObj);
      return value.a;
    });

    bench('with freeze: store.get()', () => {
      const store = createStore();
      const value = store.get(smallState$);
      return value.a;
    });
  });

  describe('medium objects (10-100 properties)', () => {
    const mediumObj = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`key${i}`, i]));
    const mediumState$ = state(mediumObj);

    bench('baseline: get without freeze', () => {
      const value = mediumObj;
      return value.key0;
    });

    bench('with freeze: direct freeze', () => {
      const value = freezeValue(mediumObj);
      return value.key0;
    });

    bench('with freeze: store.get()', () => {
      const store = createStore();
      const value = store.get(mediumState$);
      return value.key0;
    });
  });

  describe('large objects (> 100 properties)', () => {
    const largeObj = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`key${i}`, i]));
    const largeState$ = state(largeObj);

    bench('baseline: get without freeze', () => {
      const value = largeObj;
      return value.key0;
    });

    bench('with freeze: direct freeze', () => {
      const value = freezeValue(largeObj);
      return value.key0;
    });

    bench('with freeze: store.get()', () => {
      const store = createStore();
      const value = store.get(largeState$);
      return value.key0;
    });
  });

  describe('nested objects (3 levels)', () => {
    const nestedObj = {
      level1: {
        level2: {
          level3: { value: 42 },
        },
      },
    };
    const nestedState$ = state(nestedObj);

    bench('baseline: get without freeze', () => {
      const value = nestedObj;
      return value.level1.level2.level3.value;
    });

    bench('with freeze: direct freeze', () => {
      const value = freezeValue(nestedObj);
      return value.level1.level2.level3.value;
    });

    bench('with freeze: store.get()', () => {
      const store = createStore();
      const value = store.get(nestedState$);
      return value.level1.level2.level3.value;
    });
  });

  describe('arrays', () => {
    const smallArray = Array.from({ length: 10 }, (_, i) => i);
    const largeArray = Array.from({ length: 1000 }, (_, i) => i);

    bench('small array: baseline', () => {
      const value = smallArray;
      return value[0];
    });

    bench('small array: with freeze', () => {
      const value = freezeValue(smallArray);
      return value[0];
    });

    bench('large array: baseline', () => {
      const value = largeArray;
      return value[0];
    });

    bench('large array: with freeze', () => {
      const value = freezeValue(largeArray);
      return value[0];
    });
  });

  describe('Map and Set', () => {
    const smallMap = new Map(Array.from({ length: 10 }, (_, i) => [`key${i}`, i]));
    const largeMap = new Map(Array.from({ length: 100 }, (_, i) => [`key${i}`, i]));
    const smallSet = new Set(Array.from({ length: 10 }, (_, i) => i));

    bench('Map (10 items): baseline', () => {
      const value = smallMap;
      return value.get('key0');
    });

    bench('Map (10 items): with freeze', () => {
      const value = freezeValue(smallMap);
      return value.get('key0');
    });

    bench('Map (100 items): baseline', () => {
      const value = largeMap;
      return value.get('key0');
    });

    bench('Map (100 items): with freeze', () => {
      const value = freezeValue(largeMap);
      return value.get('key0');
    });

    bench('Set (10 items): baseline', () => {
      const value = smallSet;
      return value.has(0);
    });

    bench('Set (10 items): with freeze', () => {
      const value = freezeValue(smallSet);
      return value.has(0);
    });
  });

  describe('real-world scenario: computed chain', () => {
    const store = createStore();
    const data$ = state({
      users: Array.from({ length: 20 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        tags: ['tag1', 'tag2'],
      })),
    });

    const userCount$ = computed((get) => {
      return get(data$).users.length;
    });

    const firstUser$ = computed((get) => {
      return get(data$).users[0];
    });

    bench('computed: get count', () => {
      return store.get(userCount$);
    });

    bench('computed: get first user', () => {
      return store.get(firstUser$);
    });

    bench('computed: access nested property', () => {
      const user = store.get(firstUser$);
      return user?.name;
    });
  });

  describe('worst case: deeply nested with arrays', () => {
    const worstCase = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                items: Array.from({ length: 100 }, (_, i) => ({
                  id: i,
                  data: { value: i },
                })),
              },
            },
          },
        },
      },
    };

    bench('worst case: baseline', () => {
      const value = worstCase;
      return value.level1.level2.level3.level4.level5.items[0].data.value;
    });

    bench('worst case: with freeze', () => {
      const value = freezeValue(worstCase);
      return value.level1.level2.level3.level4.level5.items[0].data.value;
    });
  });

  describe('subsequent access (freeze is one-time cost)', () => {
    const obj = { a: 1, b: 2, c: 3 };
    const frozen = freezeValue(obj);

    bench('frozen object: 1st access', () => {
      return frozen.a;
    });

    bench('frozen object: 2nd access', () => {
      return frozen.b;
    });

    bench('frozen object: 3rd access', () => {
      return frozen.c;
    });

    bench('frozen object: repeated access in loop', () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += frozen.a + frozen.b + frozen.c;
      }
      return sum;
    });
  });
});
