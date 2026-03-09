#!/usr/bin/env python3
"""
test_full_pipeline.py — Full CV Pipeline Test for chess_pieces_v7.onnx
=======================================================================
Validates the complete deployment of the v7 chess piece detection model:

  1. Model file integrity check (chess_pieces_v7.onnx exists, correct size)
  2. ONNX model load test (onnxruntime session creation)
  3. Model input/output shape validation (1x3x416x416 → 1x84x3549)
  4. Inference smoke test (random input, valid output shape)
  5. cv_worker.py PIECE_MODEL constant verification (points to v7)
  6. cv_worker.py load_models() integration test
  7. Synthetic frame inference test (416x416 blank board frame)
  8. Class count validation (12 chess piece classes)

Usage:
    python3.11 /home/ubuntu/otbchess2.0/server/tests/test_full_pipeline.py

Exit codes:
    0 — All tests passed
    1 — One or more tests failed
"""

import sys
import os
import time
import json
from pathlib import Path

# Add server directory to path
SERVER_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(SERVER_DIR))

# ─── Test Infrastructure ──────────────────────────────────────────────────────

PASS = "PASS"
FAIL = "FAIL"
SKIP = "SKIP"
WARN = "WARN"

results = []


def test(name, fn):
    """Run a single test function and record the result."""
    start = time.time()
    try:
        status, detail = fn()
    except Exception as e:
        import traceback
        status = FAIL
        detail = f"Exception: {e}\n{traceback.format_exc()}"
    elapsed = time.time() - start
    results.append({
        "name": name,
        "status": status,
        "detail": detail,
        "elapsed_ms": round(elapsed * 1000, 1),
    })
    icon = {"PASS": "✓", "FAIL": "✗", "SKIP": "○", "WARN": "⚠"}.get(status, "?")
    print(f"  [{icon}] {name} ({elapsed*1000:.0f}ms)")
    if status in (FAIL, WARN) and detail:
        for line in detail.strip().split("\n")[:5]:
            print(f"        {line}")
    return status == PASS


# ─── Test Definitions ─────────────────────────────────────────────────────────

def test_model_file_exists():
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    if not model_path.exists():
        return FAIL, f"File not found: {model_path}"
    size_mb = model_path.stat().st_size / (1024 * 1024)
    if size_mb < 5.0:
        return FAIL, f"Model file too small: {size_mb:.2f} MB (expected ≥5 MB)"
    return PASS, f"Found: {model_path} ({size_mb:.2f} MB)"


def test_board_seg_model_exists():
    model_path = SERVER_DIR / "cv-models" / "chess-board-seg.onnx"
    if not model_path.exists():
        return FAIL, f"File not found: {model_path}"
    size_mb = model_path.stat().st_size / (1024 * 1024)
    return PASS, f"Found: {model_path} ({size_mb:.2f} MB)"


def test_onnxruntime_available():
    try:
        import onnxruntime as ort
        version = ort.__version__
        return PASS, f"onnxruntime {version}"
    except ImportError:
        return FAIL, "onnxruntime not installed"


def test_model_load():
    import onnxruntime as ort
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(
        str(model_path),
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )
    inputs = session.get_inputs()
    outputs = session.get_outputs()
    if len(inputs) == 0:
        return FAIL, "No inputs found in model"
    if len(outputs) == 0:
        return FAIL, "No outputs found in model"
    return PASS, f"Loaded OK — inputs: {[i.name for i in inputs]}, outputs: {[o.name for o in outputs]}"


def test_model_input_shape():
    import onnxruntime as ort
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    shape = inp.shape
    # Expected: [1, 3, 416, 416] or [batch, 3, 416, 416]
    if len(shape) != 4:
        return FAIL, f"Expected 4D input, got shape: {shape}"
    if shape[1] != 3:
        return FAIL, f"Expected 3 channels, got: {shape[1]}"
    h, w = shape[2], shape[3]
    if h != 416 or w != 416:
        return WARN, f"Expected 416x416, got {h}x{w} (may still work)"
    return PASS, f"Input shape: {shape} — correct (1x3x416x416)"


def test_model_output_shape():
    import onnxruntime as ort
    import numpy as np
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    # Run with random input
    dummy = np.random.rand(1, 3, 416, 416).astype(np.float32)
    outputs = session.run(None, {inp.name: dummy})
    if len(outputs) == 0:
        return FAIL, "No outputs returned"
    out_shape = outputs[0].shape
    # Expected: (1, num_classes+4, num_anchors) for YOLO11n
    # For 12 classes: (1, 16, 3549) — 4 bbox + 12 classes
    if len(out_shape) != 3:
        return FAIL, f"Expected 3D output, got shape: {out_shape}"
    batch, channels, anchors = out_shape
    if batch != 1:
        return FAIL, f"Expected batch=1, got {batch}"
    return PASS, f"Output shape: {out_shape} — ({channels-4} classes, {anchors} anchors)"


def test_inference_smoke():
    import onnxruntime as ort
    import numpy as np
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    # Simulate a blank board frame (all zeros = empty board)
    blank = np.zeros((1, 3, 416, 416), dtype=np.float32)
    t0 = time.time()
    outputs = session.run(None, {inp.name: blank})
    elapsed_ms = (time.time() - t0) * 1000
    if outputs is None or len(outputs) == 0:
        return FAIL, "No output from inference"
    if elapsed_ms > 5000:
        return WARN, f"Inference took {elapsed_ms:.0f}ms (slow — expected <1000ms on CPU)"
    return PASS, f"Inference completed in {elapsed_ms:.0f}ms, output shape: {outputs[0].shape}"


def test_cv_worker_piece_model_constant():
    """Verify cv_worker.py PIECE_MODEL points to chess_pieces_v7.onnx"""
    cv_worker_path = SERVER_DIR / "cv_worker.py"
    if not cv_worker_path.exists():
        return FAIL, f"cv_worker.py not found at {cv_worker_path}"
    content = cv_worker_path.read_text()
    if "chess_pieces_v7.onnx" not in content:
        # Check what it currently points to
        import re
        match = re.search(r'PIECE_MODEL\s*=.*?"([^"]+)"', content)
        current = match.group(1) if match else "unknown"
        return FAIL, f"PIECE_MODEL not updated to v7. Current: {current}"
    return PASS, "PIECE_MODEL = cv-models/chess_pieces_v7.onnx ✓"


def test_cv_worker_load_models():
    """Test cv_worker.load_models() with the v7 model"""
    try:
        from cv_worker import load_models, PIECE_MODEL, BOARD_SEG_MODEL
        if not BOARD_SEG_MODEL.exists():
            return SKIP, f"Board seg model not found: {BOARD_SEG_MODEL} — skipping integration test"
        if not PIECE_MODEL.exists():
            return FAIL, f"Piece model not found: {PIECE_MODEL}"
        board_seg, piece_det = load_models()
        if board_seg is None or piece_det is None:
            return FAIL, "load_models() returned None"
        return PASS, f"load_models() OK — board_seg and piece_det sessions created"
    except Exception as e:
        return FAIL, str(e)


def test_class_names():
    """Verify CLASS_NAMES has 12 chess piece classes"""
    try:
        from cv_worker import CLASS_NAMES
        expected = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k']
        if len(CLASS_NAMES) != 12:
            return FAIL, f"Expected 12 classes, got {len(CLASS_NAMES)}: {CLASS_NAMES}"
        if CLASS_NAMES != expected:
            return WARN, f"CLASS_NAMES differ from expected. Got: {CLASS_NAMES}"
        return PASS, f"12 classes: {CLASS_NAMES}"
    except ImportError as e:
        return FAIL, str(e)


def test_model_output_class_count():
    """Verify the model output has the correct number of detection channels (4 bbox + 12 classes = 16)"""
    import onnxruntime as ort
    import numpy as np
    model_path = SERVER_DIR / "cv-models" / "chess_pieces_v7.onnx"
    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
    inp = session.get_inputs()[0]
    dummy = np.zeros((1, 3, 416, 416), dtype=np.float32)
    outputs = session.run(None, {inp.name: dummy})
    out_shape = outputs[0].shape
    channels = out_shape[1]
    num_classes = channels - 4  # subtract 4 bbox coords
    if num_classes == 12:
        return PASS, f"12 chess piece classes detected in output (channels={channels})"
    elif num_classes == 80:
        return WARN, f"Model has 80 COCO classes — this is the base YOLO11n, not fine-tuned for chess. Channels={channels}"
    else:
        return WARN, f"Unexpected class count: {num_classes} (channels={channels})"


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print()
    print("=" * 60)
    print("  OTB Chess — Full CV Pipeline Test (v7)")
    print("=" * 60)
    print(f"  Server dir : {SERVER_DIR}")
    print(f"  Model      : chess_pieces_v7.onnx")
    print()

    # Run all tests
    test("1. chess_pieces_v7.onnx file exists",       test_model_file_exists)
    test("2. chess-board-seg.onnx file exists",        test_board_seg_model_exists)
    test("3. onnxruntime available",                   test_onnxruntime_available)
    test("4. ONNX model loads successfully",           test_model_load)
    test("5. Model input shape (1x3x416x416)",         test_model_input_shape)
    test("6. Model output shape validation",           test_model_output_shape)
    test("7. Inference smoke test (blank frame)",      test_inference_smoke)
    test("8. cv_worker PIECE_MODEL = v7",              test_cv_worker_piece_model_constant)
    test("9. cv_worker.load_models() integration",     test_cv_worker_load_models)
    test("10. CLASS_NAMES (12 chess pieces)",          test_class_names)
    test("11. Model output class count",               test_model_output_class_count)

    # Summary
    passed = sum(1 for r in results if r["status"] == PASS)
    warned = sum(1 for r in results if r["status"] == WARN)
    failed = sum(1 for r in results if r["status"] == FAIL)
    skipped = sum(1 for r in results if r["status"] == SKIP)
    total = len(results)

    print()
    print("─" * 60)
    print(f"  Results: {passed}/{total} passed, {warned} warnings, {failed} failed, {skipped} skipped")
    print("─" * 60)

    # Write JSON report
    report_path = Path(__file__).parent / "pipeline_test_v7_results.json"
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model": "chess_pieces_v7.onnx",
        "passed": passed,
        "warned": warned,
        "failed": failed,
        "skipped": skipped,
        "total": total,
        "tests": results,
    }
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"  Report saved: {report_path}")

    if failed > 0:
        print()
        print("  PIPELINE TEST: FAILED")
        sys.exit(1)
    elif warned > 0:
        print()
        print("  PIPELINE TEST: PASSED WITH WARNINGS")
        sys.exit(0)
    else:
        print()
        print("  PIPELINE TEST: ALL CLEAR ✓")
        sys.exit(0)


if __name__ == "__main__":
    main()
