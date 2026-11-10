import assert from 'node:assert/strict';
import test from 'node:test';
import { formatStageTiming, recordStage, type StageMark } from '../src/background/proof-stage-timing.ts';

test('repeated progress messages in one stage keep a single mark', () => {
  let marks: StageMark[] = [];
  marks = recordStage(marks, 'preparing', 1_000);
  marks = recordStage(marks, 'reading_data', 2_000);
  marks = recordStage(marks, 'reading_data', 3_000);
  marks = recordStage(marks, 'generating_proof', 9_500);
  assert.deepEqual(
    marks.map((mark) => mark.stage),
    ['preparing', 'reading_data', 'generating_proof'],
  );
});

test('each stage is timed until the next one and the last until the end', () => {
  const marks: StageMark[] = [
    { stage: 'preparing', at: 1_000 },
    { stage: 'opening_page', at: 1_800 },
    { stage: 'reading_data', at: 6_000 },
    { stage: 'generating_proof', at: 12_000 },
    { stage: 'submitting', at: 31_000 },
  ];
  assert.equal(
    formatStageTiming(marks, 1_000, 32_250),
    'timing=31.3s[preparing:0.8,opening_page:4.2,reading_data:6.0,generating_proof:19.0,submitting:1.3]',
  );
});

test('a stage entered again is timed as its own segment', () => {
  const marks: StageMark[] = [
    { stage: 'reading_data', at: 0 },
    { stage: 'opening_page', at: 2_000 },
    { stage: 'reading_data', at: 5_000 },
  ];
  assert.equal(
    formatStageTiming(marks, 0, 6_000),
    'timing=6.0s[reading_data:2.0,opening_page:3.0,reading_data:1.0]',
  );
});

test('no marks gives no timing segment', () => {
  assert.equal(formatStageTiming([], 0, 5_000), '');
});
