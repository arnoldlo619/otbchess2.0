#!/usr/bin/env python3
"""
monitor_v7.py — YOLO v7 Chess Piece Detection Training Monitor
==============================================================
Reads results.csv from the v7 training run and reports:
  - Current epoch
  - mAP50 (B)
  - mAP50-95 (B)
  - Training/validation losses
  - Whether training is complete (epoch 19 or 20 done)
  - Whether the training process is still running

Usage:
    python3.11 /home/ubuntu/training/monitor_v7.py
"""

import os
import sys
import csv
import subprocess
from pathlib import Path

RESULTS_CSV = Path("/home/ubuntu/chess-training-data/runs_v7/chess-pieces-v7/results.csv")
WEIGHTS_DIR = Path("/home/ubuntu/chess-training-data/runs_v7/chess-pieces-v7/weights")
TOTAL_EPOCHS = 20


def is_training_running():
    """Check if a YOLO training process is currently running."""
    try:
        result = subprocess.run(
            ["pgrep", "-f", "yolo.*train|train.*chess.*v7"],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def parse_results_csv(csv_path: Path):
    """Parse results.csv and return list of epoch dicts."""
    if not csv_path.exists():
        return []
    rows = []
    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stripped = {k.strip(): v.strip() for k, v in row.items()}
            rows.append(stripped)
    return rows


def print_results_table(rows):
    """Print a formatted results table."""
    header = f"{'Epoch':>6} | {'mAP50':>8} | {'mAP50-95':>10} | {'Precision':>10} | {'Recall':>8} | {'Val/Box':>8} | {'Val/Cls':>8}"
    sep = "-" * len(header)
    print(sep)
    print(header)
    print(sep)
    for row in rows:
        try:
            epoch      = int(float(row.get("epoch", 0)))
            map50      = float(row.get("metrics/mAP50(B)", 0))
            map5095    = float(row.get("metrics/mAP50-95(B)", 0))
            precision  = float(row.get("metrics/precision(B)", 0))
            recall     = float(row.get("metrics/recall(B)", 0))
            val_box    = float(row.get("val/box_loss", 0))
            val_cls    = float(row.get("val/cls_loss", 0))
            print(f"{epoch:>6} | {map50:>8.4f} | {map5095:>10.4f} | {precision:>10.4f} | {recall:>8.4f} | {val_box:>8.4f} | {val_cls:>8.4f}")
        except (ValueError, KeyError):
            continue
    print(sep)


def main():
    print("=" * 60)
    print("  OTB Chess — YOLO v7 Training Monitor")
    print("=" * 60)
    print(f"  Results CSV : {RESULTS_CSV}")
    print(f"  Weights dir : {WEIGHTS_DIR}")
    print()

    # Check if training process is running
    training_running = is_training_running()
    if training_running:
        print("  [STATUS] Training process is RUNNING")
    else:
        print("  [STATUS] Training process is NOT running (completed or not started)")

    # Parse results
    rows = parse_results_csv(RESULTS_CSV)

    if not rows:
        print("\n  [WARNING] No results.csv found or file is empty.")
        print("  Training may not have started yet, or the path is incorrect.")
        sys.exit(1)

    # Get latest epoch stats
    last = rows[-1]
    try:
        current_epoch = int(float(last.get("epoch", 0)))
        map50         = float(last.get("metrics/mAP50(B)", 0))
        map5095       = float(last.get("metrics/mAP50-95(B)", 0))
        precision     = float(last.get("metrics/precision(B)", 0))
        recall        = float(last.get("metrics/recall(B)", 0))
        val_box       = float(last.get("val/box_loss", 0))
        val_cls       = float(last.get("val/cls_loss", 0))
    except (ValueError, KeyError) as e:
        print(f"\n  [ERROR] Could not parse results.csv: {e}")
        sys.exit(1)

    # Determine completion
    is_complete = (current_epoch >= TOTAL_EPOCHS) or (not training_running and current_epoch >= 19)

    print(f"\n  Current Epoch  : {current_epoch} / {TOTAL_EPOCHS}")
    print(f"  mAP50          : {map50:.4f}  ({map50*100:.2f}%)")
    print(f"  mAP50-95       : {map5095:.4f}  ({map5095*100:.2f}%)")
    print(f"  Precision      : {precision:.4f}")
    print(f"  Recall         : {recall:.4f}")
    print(f"  Val/Box Loss   : {val_box:.4f}")
    print(f"  Val/Cls Loss   : {val_cls:.4f}")
    print()

    # Print full table
    print("  Full Training History:")
    print()
    print_results_table(rows)

    # Best epoch
    best_row = max(rows, key=lambda r: float(r.get("metrics/mAP50(B)", 0)))
    best_epoch = int(float(best_row.get("epoch", 0)))
    best_map50 = float(best_row.get("metrics/mAP50(B)", 0))
    best_map5095 = float(best_row.get("metrics/mAP50-95(B)", 0))
    print(f"\n  Best Epoch     : {best_epoch} (mAP50={best_map50:.4f}, mAP50-95={best_map5095:.4f})")

    # Check weights
    best_pt = WEIGHTS_DIR / "best.pt"
    last_pt = WEIGHTS_DIR / "last.pt"
    print(f"\n  best.pt exists : {best_pt.exists()}")
    print(f"  last.pt exists : {last_pt.exists()}")

    if is_complete:
        print()
        print("  " + "=" * 56)
        print("  TRAINING COMPLETE — Ready for ONNX export and deployment")
        print("  " + "=" * 56)
        print()
        print("  Next step: python3.11 /home/ubuntu/training/export_v7.py")
        sys.exit(0)
    else:
        progress_pct = (current_epoch / TOTAL_EPOCHS) * 100
        print(f"\n  Progress: {current_epoch}/{TOTAL_EPOCHS} epochs ({progress_pct:.1f}%)")
        print("  Training still in progress...")
        sys.exit(2)


if __name__ == "__main__":
    main()
