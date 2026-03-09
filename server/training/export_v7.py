#!/usr/bin/env python3
"""
export_v7.py — Export YOLO v7 Chess Piece Detection Model to ONNX
=================================================================
Exports the best.pt weights from the v7 training run to ONNX format
and copies the resulting model to the cv-models/ deployment directory.

Source weights : /home/ubuntu/chess-training-data/runs_v7/chess-pieces-v7/weights/best.pt
Output ONNX    : /home/ubuntu/otbchess2.0/server/cv-models/chess_pieces_v7.onnx

Export settings (matching v6 baseline):
  - Format  : ONNX
  - Opset   : 11
  - Imgsz   : 416
  - Simplify: True
  - Batch   : 1
  - Half    : False (CPU-compatible float32)
  - NMS     : False (handled in cv_worker.py)

Usage:
    python3.11 /home/ubuntu/training/export_v7.py
"""

import sys
import shutil
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────────────
BEST_PT     = Path("/home/ubuntu/chess-training-data/runs_v7/chess-pieces-v7/weights/best.pt")
OUTPUT_DIR  = Path("/home/ubuntu/otbchess2.0/server/cv-models")
OUTPUT_NAME = "chess_pieces_v7.onnx"
OUTPUT_PATH = OUTPUT_DIR / OUTPUT_NAME

# Export image size (must match PIECE_SIZE in cv_worker.py)
IMGSZ = 416


def main():
    print("=" * 60)
    print("  OTB Chess — YOLO v7 ONNX Export")
    print("=" * 60)
    print(f"  Source  : {BEST_PT}")
    print(f"  Output  : {OUTPUT_PATH}")
    print(f"  Imgsz   : {IMGSZ}x{IMGSZ}")
    print()

    # Validate source weights exist
    if not BEST_PT.exists():
        print(f"  [ERROR] best.pt not found at: {BEST_PT}")
        print("  Ensure training has completed and weights are saved.")
        sys.exit(1)

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Load model and export
    try:
        from ultralytics import YOLO
        print("  Loading model from best.pt ...")
        model = YOLO(str(BEST_PT))

        print("  Exporting to ONNX ...")
        export_path = model.export(
            format="onnx",
            imgsz=IMGSZ,
            opset=11,
            simplify=True,
            batch=1,
            half=False,
            nms=False,
            dynamic=False,
        )
        print(f"  Export complete: {export_path}")

        # The export creates the .onnx next to the .pt file; copy to cv-models/
        exported_onnx = Path(str(BEST_PT).replace(".pt", ".onnx"))
        if not exported_onnx.exists():
            # Try the default ultralytics export location
            exported_onnx = Path(str(export_path))

        if exported_onnx.exists():
            shutil.copy2(str(exported_onnx), str(OUTPUT_PATH))
            print(f"  Copied to deployment dir: {OUTPUT_PATH}")
        else:
            print(f"  [WARNING] Could not find exported ONNX at {exported_onnx}")
            print(f"  Trying export_path directly: {export_path}")
            shutil.copy2(str(export_path), str(OUTPUT_PATH))
            print(f"  Copied to deployment dir: {OUTPUT_PATH}")

    except ImportError:
        print("  [ERROR] ultralytics not installed. Run: pip3 install ultralytics")
        sys.exit(1)
    except Exception as e:
        print(f"  [ERROR] Export failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Verify output
    if OUTPUT_PATH.exists():
        size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
        print()
        print("  ✓ Export successful!")
        print(f"  ✓ Output: {OUTPUT_PATH}")
        print(f"  ✓ Size  : {size_mb:.2f} MB")
        print()
        print("  Next step: Update PIECE_MODEL in cv_worker.py to chess_pieces_v7.onnx")
        print("  Then run : python3.11 /home/ubuntu/otbchess2.0/server/tests/test_full_pipeline.py")
    else:
        print("  [ERROR] Output file not found after export!")
        sys.exit(1)


if __name__ == "__main__":
    main()
