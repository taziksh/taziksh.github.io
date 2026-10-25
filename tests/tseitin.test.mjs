import test from 'node:test';
import assert from 'node:assert/strict';
import { allClauses, clauseHolds, deriveAuxiliaries, evaluateOriginal, groups } from '../src/lib/tseitin.ts';

const bits = (n, length) => Array.from({ length }, (_, index) => Boolean(n & (1 << index)));

test('each gate CNF permits exactly the truth table of its operator', () => {
  for (let mask = 0; mask < 256; mask++) {
    const a = bits(mask, 8);
    const definitions = [a[4] === (a[0] || a[1]), a[5] === (a[4] === a[2]), a[6] === !a[3], a[7] === (!a[5] || a[6])];
    groups.forEach((group, index) => assert.equal(group.clauses.every(c => clauseHolds(c, a)), definitions[index], `gate ${index + 1}, assignment ${mask}`));
  }
});

test('projecting all 256 CNF assignments gives exactly the original satisfying inputs', () => {
  let satisfyingInputs = 0;
  for (let xMask = 0; xMask < 16; xMask++) {
    const x = bits(xMask, 4);
    const satisfyingY = Array.from({ length: 16 }, (_, yMask) => bits(yMask, 4))
      .filter(y => allClauses.every(c => clauseHolds(c, [...x, ...y])));
    assert.equal(satisfyingY.length, evaluateOriginal(x) ? 1 : 0, `inputs ${xMask}`);
    if (satisfyingY.length) {
      satisfyingInputs++;
      assert.deepEqual(satisfyingY[0], deriveAuxiliaries(x));
    }
  }
  assert.equal(satisfyingInputs, 12);
  assert.equal(allClauses.length, 13);
});

test('omitting the root admits false originals; dishonest auxiliaries fail definitions', () => {
  const x = [true, false, true, true];
  const honest = [...x, ...deriveAuxiliaries(x)];
  assert.equal(evaluateOriginal(x), false);
  assert.equal(allClauses.every(c => clauseHolds(c, honest)), false);
  assert.equal(allClauses.slice(0, -1).every(c => clauseHolds(c, honest)), true);
  for (let index = 4; index < 8; index++) {
    const dishonest = [...honest];
    dishonest[index] = !dishonest[index];
    assert.equal(allClauses.slice(0, -1).every(c => clauseHolds(c, dishonest)), false);
  }
});
