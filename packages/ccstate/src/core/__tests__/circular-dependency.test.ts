import { expect, it, describe } from 'vitest';
import { computed, state, createStore } from '..';
import type { Computed } from '..';

/* eslint-disable prefer-const */
// Note: This file intentionally creates circular references to test detection.
// Variables are declared with 'let' to allow temporal dead zone references.

describe('Circular dependency detection', () => {
  // Test 1: Simple A→B→A cycle + error message validation
  it('should throw error for A→B→A cycle with clear message', () => {
    const store = createStore();

    let a$: Computed<number>;
    let b$: Computed<number>;

    a$ = computed((get) => get(b$) + 1, { debugLabel: 'a$' });
    b$ = computed((get) => get(a$) + 1, { debugLabel: 'b$' });

    try {
      store.get(a$);
      throw new Error('Should have thrown circular dependency error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Circular dependency');
      expect((error as Error).message).toContain('a$');
    }

    // Both directions should throw
    expect(() => store.get(b$)).toThrow(/Circular dependency/);
  });

  // Test 2: Self-referencing computed (most sensitive edge case)
  it('should detect self-referencing computed', () => {
    const store = createStore();

    let a$: Computed<number>;
    a$ = computed((get) => get(a$) + 1, { debugLabel: 'self$' });

    expect(() => store.get(a$)).toThrow(/Circular dependency/);
  });

  // Test 3: Three-node indirect cycle A→B→C→A
  it('should detect A→B→C→A indirect cycle', () => {
    const store = createStore();

    let a$: Computed<number>;
    let b$: Computed<number>;
    let c$: Computed<number>;

    a$ = computed((get) => get(b$) + 1, { debugLabel: 'a$' });
    b$ = computed((get) => get(c$) + 1, { debugLabel: 'b$' });
    c$ = computed((get) => get(a$) + 1, { debugLabel: 'c$' });

    expect(() => store.get(a$)).toThrow(/Circular dependency/);
    expect(() => store.get(b$)).toThrow(/Circular dependency/);
    expect(() => store.get(c$)).toThrow(/Circular dependency/);
  });

  // Test 4: Conditional cycle triggered by state change (Issue #2 Case 2)
  it('should detect cycle when condition changes', () => {
    const store = createStore();
    const flag$ = state(false);

    let a$: Computed<number>;
    let b$: Computed<number>;

    a$ = computed(
      (get) => {
        return get(flag$) ? get(b$) + 1 : 10;
      },
      { debugLabel: 'a$' },
    );
    b$ = computed((get) => get(a$) + 1, { debugLabel: 'b$' });

    // Initial state should work normally
    expect(store.get(a$)).toBe(10);
    expect(store.get(b$)).toBe(11);

    // After triggering the cycle
    store.set(flag$, true);
    expect(() => store.get(a$)).toThrow(/Circular dependency/);
    expect(() => store.get(b$)).toThrow(/Circular dependency/);
  });

  // Test 5: Recovery after fixing the cycle (validates finally cleanup)
  it('should allow re-evaluation after fixing cycle', () => {
    const store = createStore();
    const flag$ = state(true);

    let a$: Computed<number>;
    let b$: Computed<number>;

    a$ = computed((get) => (get(flag$) ? get(b$) : 10), { debugLabel: 'a$' });
    b$ = computed((get) => get(a$) + 1, { debugLabel: 'b$' });

    // First access with cycle should throw
    expect(() => store.get(a$)).toThrow(/Circular dependency/);

    // After fixing the cycle, should work normally
    store.set(flag$, false);
    expect(store.get(a$)).toBe(10);
    expect(store.get(b$)).toBe(11);
  });

  // Test 6: Diamond dependencies should not be treated as cycles
  it('should not treat diamond dependencies as cycles', () => {
    const store = createStore();
    const base$ = state(1);
    const left$ = computed((get) => get(base$) + 1, { debugLabel: 'left$' });
    const right$ = computed((get) => get(base$) + 2, { debugLabel: 'right$' });
    const top$ = computed((get) => get(left$) + get(right$), { debugLabel: 'top$' });

    // Diamond structure is legal, should not throw
    expect(store.get(top$)).toBe(5); // (1+1) + (1+2) = 5

    // Update base and verify it still works
    store.set(base$, 2);
    expect(store.get(top$)).toBe(7); // (2+1) + (2+2) = 7
  });

  // Test 7: Error message should include debugLabel for better DX
  it('should provide meaningful error message with debugLabel', () => {
    const store = createStore();

    let userProfile$: Computed<unknown>;
    let userStats$: Computed<unknown>;

    userProfile$ = computed((get) => get(userStats$), {
      debugLabel: 'userProfile$',
    });
    userStats$ = computed((get) => get(userProfile$), {
      debugLabel: 'userStats$',
    });

    try {
      store.get(userProfile$);
      throw new Error('Should have thrown circular dependency error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const message = (error as Error).message;
      expect(message).toContain('userProfile$');
      expect(message).toContain('Circular dependency');
    }
  });
});
