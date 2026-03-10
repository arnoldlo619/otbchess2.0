/**
 * Vitest tests for temporal smoothing in cv_worker.py.
 *
 * Each test delegates to the Python harness (temporal_smooth_harness.py)
 * which directly imports and exercises the temporal_smooth_board() function.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const HARNESS = path.resolve(__dirname, 'temporal_smooth_harness.py');

function runHarnessTest(testName: string): { passed: boolean; output: string } {
  try {
    const output = execSync(`python3.11 "${HARNESS}" ${testName}`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    return { passed: true, output: output.trim() };
  } catch (err: any) {
    return { passed: false, output: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

describe('Temporal Smoothing — cv_worker.py', () => {
  it('does not override high-confidence detections', () => {
    const { passed, output } = runHarnessTest('test_high_confidence_not_overridden');
    expect(passed, output).toBe(true);
  });

  it('corrects low-confidence detection when prior piece is in alternatives', () => {
    const { passed, output } = runHarnessTest('test_low_confidence_corrected_by_prior');
    expect(passed, output).toBe(true);
  });

  it('does not override when prior piece is not in alternatives', () => {
    const { passed, output } = runHarnessTest('test_prior_not_in_alternatives_no_override');
    expect(passed, output).toBe(true);
  });

  it('does not hallucinate pieces on empty squares', () => {
    const { passed, output } = runHarnessTest('test_no_hallucination_empty_square');
    expect(passed, output).toBe(true);
  });

  it('skips smoothing when board differs significantly from prior', () => {
    const { passed, output } = runHarnessTest('test_large_diff_skips_smoothing');
    expect(passed, output).toBe(true);
  });

  it('leaves board unchanged when prior_fen is None', () => {
    const { passed, output } = runHarnessTest('test_none_prior_fen_unchanged');
    expect(passed, output).toBe(true);
  });

  it('parses FEN to board grid correctly', () => {
    const { passed, output } = runHarnessTest('test_fen_to_board_grid');
    expect(passed, output).toBe(true);
  });

  it('makes no change when prior agrees with current detection', () => {
    const { passed, output } = runHarnessTest('test_prior_agrees_no_change');
    expect(passed, output).toBe(true);
  });
});
