"""Regression coverage for highly rotated chessboard corner ordering.

Run directly with:
    python3 server/tests/test_rotated_corner_geometry.py
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

import cv2
import numpy as np


WORKER_PATH = Path(__file__).resolve().parents[1] / "cv_worker.py"
spec = importlib.util.spec_from_file_location("cv_worker", WORKER_PATH)
if spec is None or spec.loader is None:  # pragma: no cover - setup guard
    raise RuntimeError("Could not load cv_worker.py")
cv_worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cv_worker)


class RotatedCornerGeometryTests(unittest.TestCase):
    """Prevent degenerate [tl, tr, br, bl] quads around 45° rotation."""

    @staticmethod
    def rotated_board_mask(angle: float) -> np.ndarray:
        mask = np.zeros((256, 256), dtype=np.float32)
        corners = cv2.boxPoints(((128, 128), (150, 150), angle)).astype(np.int32)
        cv2.fillConvexPoly(mask, corners, 1.0)
        return mask

    def test_sort_corners_keeps_four_unique_vertices_at_45_degrees(self) -> None:
        points = [(128, 21), (234, 128), (128, 234), (21, 128)]
        ordered = cv_worker.sort_corners(points)

        self.assertEqual(len(ordered), 4)
        self.assertEqual(len(set(ordered)), 4)
        self.assertEqual(ordered[0], (128, 21))
        self.assertEqual(ordered, [(128, 21), (234, 128), (128, 234), (21, 128)])

    def test_extract_corners_returns_a_non_degenerate_quad_above_30_degrees(self) -> None:
        for angle in (30, 35, 40, 45, 50, 60):
            with self.subTest(angle=angle):
                corners, confidence = cv_worker.extract_corners(
                    self.rotated_board_mask(angle), 256, 256
                )
                self.assertIsNotNone(corners)
                self.assertGreaterEqual(confidence, 0.5)
                self.assertEqual(len(corners), 4)
                self.assertEqual(len(set(corners)), 4)

                # Clockwise ordering in image coordinates has positive signed area.
                area = sum(
                    corners[index][0] * corners[(index + 1) % 4][1]
                    - corners[(index + 1) % 4][0] * corners[index][1]
                    for index in range(4)
                )
                self.assertGreater(area, 10_000)


if __name__ == "__main__":
    unittest.main()
