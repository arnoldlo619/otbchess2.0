#!/usr/bin/env python3
"""
OTB Chess — CV Pipeline End-to-End Benchmark
=============================================

Runs two levels of testing:

  Level 1 — Move Reconstruction Pipeline (no ONNX models needed)
    Feeds known FEN timelines directly into the move detection pipeline
    and measures PGN reconstruction accuracy against ground truth.
    Tests: perfect FENs, noisy FENs, skipped frames, and combined noise.

  Level 2 — Full CV Pipeline (requires ONNX models + video file)
    Runs cv_worker.py against a synthetic test video and measures
    what the models can actually detect end-to-end.

Usage:
    python3 run_benchmark.py [--level 1] [--level 2] [--video test_game.mp4]

Output:
    JSON report with accuracy metrics for each test case.
"""

import argparse
import json
import sys
import os
import time
from pathlib import Path

# Add parent directory to path for cv_worker imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import chess
import chess.pgn

from generate_test_video import (
    GROUND_TRUTH_MOVES,
    GROUND_TRUTH_PGN_MOVES,
    generate_fen_timeline,
    generate_fen_timeline_with_noise,
    generate_test_video,
)


# ─── Accuracy Metrics ───────────────────────────────────────────────────────

def compute_move_accuracy(reconstructed_moves, ground_truth_moves):
    """
    Compute move-level accuracy metrics.

    Returns dict with:
        total_ground_truth: number of moves in ground truth
        total_reconstructed: number of moves reconstructed
        correct_moves: number of moves that match ground truth in order
        accuracy_pct: percentage of correct moves
        first_error_at: move number where first error occurs (0-indexed), or -1
        extra_moves: moves in reconstruction not in ground truth
        missing_moves: moves in ground truth not reconstructed
    """
    gt = ground_truth_moves
    rc = reconstructed_moves

    correct = 0
    first_error = -1
    for i in range(min(len(gt), len(rc))):
        if gt[i] == rc[i]:
            correct += 1
        elif first_error == -1:
            first_error = i

    return {
        "total_ground_truth": len(gt),
        "total_reconstructed": len(rc),
        "correct_moves": correct,
        "accuracy_pct": round(100.0 * correct / len(gt), 1) if gt else 0.0,
        "first_error_at": first_error,
        "extra_moves": len(rc) - len(gt) if len(rc) > len(gt) else 0,
        "missing_moves": len(gt) - len(rc) if len(gt) > len(rc) else 0,
        "reconstructed_sequence": rc,
        "ground_truth_sequence": gt,
    }


def extract_moves_from_pgn(pgn_str):
    """Extract the list of SAN moves from a PGN string."""
    if not pgn_str:
        return []
    try:
        import io
        game = chess.pgn.read_game(io.StringIO(pgn_str))
        if not game:
            return []
        moves = []
        node = game
        while node.variations:
            next_node = node.variations[0]
            moves.append(node.board().san(next_node.move))
            node = next_node
        return moves
    except Exception as e:
        print(f"  WARNING: PGN parse error: {e}", file=sys.stderr)
        return []


# ─── Level 1: Move Reconstruction Pipeline ──────────────────────────────────

def run_level1_tests():
    """
    Test the move reconstruction pipeline by feeding known FEN timelines
    directly into the detection logic (bypassing ONNX models).
    """
    from cv_worker import (
        detect_move_from_fens,
        fens_are_similar,
        count_piece_differences,
        fen_position_part,
        validate_fen_piece_count,
        merge_fen_timelines,
    )

    results = {}

    # ── Test 1: Perfect FEN timeline (no noise, no skips) ──────────────────
    print("\n  Test 1: Perfect FEN timeline (20 moves, no noise)")
    timeline = generate_fen_timeline(seconds_per_move=4)

    reconstructed = reconstruct_from_timeline(timeline)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    results["perfect_timeline"] = metrics
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")
    print(f"    Reconstructed: {metrics['total_reconstructed']} moves")
    if metrics['first_error_at'] >= 0:
        print(f"    First error at move {metrics['first_error_at'] + 1}")

    # ── Test 2: Timeline with 10% skipped frames ──────────────────────────
    print("\n  Test 2: FEN timeline with 10% skipped frames")
    noisy_tl, gt_tl, skips, noise = generate_fen_timeline_with_noise(
        seconds_per_move=4, skip_rate=0.10, noise_rate=0.0
    )
    reconstructed = reconstruct_from_timeline(noisy_tl)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    metrics["skipped_frames"] = skips
    results["skip_10pct"] = metrics
    print(f"    Skipped frames: {skips}")
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")

    # ── Test 3: Timeline with 20% skipped frames ──────────────────────────
    print("\n  Test 3: FEN timeline with 20% skipped frames")
    noisy_tl, gt_tl, skips, noise = generate_fen_timeline_with_noise(
        seconds_per_move=4, skip_rate=0.20, noise_rate=0.0
    )
    reconstructed = reconstruct_from_timeline(noisy_tl)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    metrics["skipped_frames"] = skips
    results["skip_20pct"] = metrics
    print(f"    Skipped frames: {skips}")
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")

    # ── Test 4: Timeline with 5% noise (low confidence) ───────────────────
    print("\n  Test 4: FEN timeline with 5% noise")
    noisy_tl, gt_tl, skips, noise = generate_fen_timeline_with_noise(
        seconds_per_move=4, skip_rate=0.0, noise_rate=0.05
    )
    reconstructed = reconstruct_from_timeline(noisy_tl)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    metrics["noisy_frames"] = noise
    results["noise_5pct"] = metrics
    print(f"    Noisy frames: {noise}")
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")

    # ── Test 5: Combined noise (10% skip + 5% noise) ─────────────────────
    print("\n  Test 5: Combined noise (10% skip + 5% noise)")
    noisy_tl, gt_tl, skips, noise = generate_fen_timeline_with_noise(
        seconds_per_move=4, skip_rate=0.10, noise_rate=0.05
    )
    reconstructed = reconstruct_from_timeline(noisy_tl)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    metrics["skipped_frames"] = skips
    metrics["noisy_frames"] = noise
    results["combined_noise"] = metrics
    print(f"    Skipped: {skips}, Noisy: {noise}")
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")

    # ── Test 6: FEN timeline merge (client + server) ──────────────────────
    print("\n  Test 6: FEN timeline merge (client seeds fill server gaps)")
    # Server timeline with 20% gaps
    server_tl, _, s_skips, _ = generate_fen_timeline_with_noise(
        seconds_per_move=4, skip_rate=0.20, noise_rate=0.0
    )
    # Perfect client timeline
    client_tl = generate_fen_timeline(seconds_per_move=4)
    merged = merge_fen_timelines(client_tl, server_tl)
    reconstructed = reconstruct_from_timeline(merged)
    metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
    metrics["server_skips"] = s_skips
    metrics["merged_entries"] = len(merged)
    results["merge_client_server"] = metrics
    print(f"    Server skips: {s_skips}, Merged entries: {len(merged)}")
    print(f"    Accuracy: {metrics['accuracy_pct']}% ({metrics['correct_moves']}/{metrics['total_ground_truth']})")

    return results


def reconstruct_from_timeline(timeline):
    """
    Run the move detection pipeline on a FEN timeline.
    Mirrors the logic in cv_worker.process_video's move detection loop.
    Returns list of SAN moves.
    """
    from cv_worker import (
        detect_move_from_fens,
        fens_are_similar,
        count_piece_differences,
        fen_position_part,
        _try_resync_board,
    )

    board = chess.Board()
    moves = []

    # Deduplicate consecutive similar FENs
    deduped = [timeline[0]]
    for entry in timeline[1:]:
        if not fens_are_similar(entry[1], deduped[-1][1], threshold=0.92):
            deduped.append(entry)

    prev_fen = None
    for timestamp_ms, curr_fen, confidence in deduped:
        if prev_fen is None:
            prev_fen = curr_fen
            continue

        san_result, move_confidence = detect_move_from_fens(prev_fen, curr_fen, board)

        if san_result:
            san_list = san_result if isinstance(san_result, list) else [san_result]
            all_ok = True
            for san in san_list:
                try:
                    move = board.parse_san(san)
                    board.push(move)
                    moves.append(san)
                except Exception:
                    all_ok = False
                    break
            if all_ok:
                prev_fen = curr_fen
        else:
            # Stale prev_fen advance: prevent cascading failures.
            # Try BFS resync to find bridging moves.
            diffs = count_piece_differences(prev_fen, curr_fen)
            if diffs <= 2:
                prev_fen = curr_fen  # Minor noise
            elif diffs <= 10:
                curr_pos = fen_position_part(curr_fen)
                resync_moves = _try_resync_board(board, curr_pos, max_depth=3)
                if resync_moves:
                    for san in resync_moves:
                        try:
                            move = board.parse_san(san)
                            board.push(move)
                            moves.append(san)
                        except Exception:
                            break
                    prev_fen = curr_fen
                else:
                    prev_fen = curr_fen  # Advance without resync

    return moves


# ─── Level 2: Full CV Pipeline ──────────────────────────────────────────────

def run_level2_test(video_path):
    """
    Run the full cv_worker.py pipeline against a video file.
    Returns accuracy metrics.
    """
    import subprocess

    cv_worker_path = str(Path(__file__).parent.parent / "cv_worker.py")

    print(f"\n  Running cv_worker.py on: {video_path}")
    start = time.time()

    proc = subprocess.run(
        [sys.executable, cv_worker_path, str(video_path),
         "--fps-sample", "0.5", "--confidence", "0.45"],
        capture_output=True, text=True, timeout=300,
    )

    elapsed = time.time() - start
    print(f"    Elapsed: {elapsed:.1f}s")
    print(f"    Exit code: {proc.returncode}")

    if proc.stderr:
        for line in proc.stderr.strip().split("\n")[:5]:
            print(f"    stderr: {line}")

    result = {}
    try:
        output = json.loads(proc.stdout)
        result["cv_output"] = output
        result["elapsed_seconds"] = round(elapsed, 1)

        if output.get("pgn"):
            reconstructed = extract_moves_from_pgn(output["pgn"])
            metrics = compute_move_accuracy(reconstructed, GROUND_TRUTH_MOVES)
            result["accuracy"] = metrics
            print(f"    Reconstructed PGN: {output['pgn'][:200]}...")
            print(f"    Moves found: {metrics['total_reconstructed']}")
            print(f"    Accuracy: {metrics['accuracy_pct']}%")
        else:
            result["accuracy"] = {
                "total_ground_truth": len(GROUND_TRUTH_MOVES),
                "total_reconstructed": 0,
                "correct_moves": 0,
                "accuracy_pct": 0.0,
                "first_error_at": 0,
                "error": output.get("error", "No PGN produced"),
            }
            print(f"    No PGN produced. Error: {output.get('error', 'unknown')}")

        if output.get("warnings"):
            print(f"    Warnings ({len(output['warnings'])}):")
            for w in output["warnings"][:5]:
                print(f"      - {w[:100]}")

    except json.JSONDecodeError:
        result["error"] = "Failed to parse cv_worker output as JSON"
        result["stdout"] = proc.stdout[:500]
        print(f"    ERROR: Could not parse output")

    return result


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="OTB Chess CV Pipeline Benchmark")
    parser.add_argument("--level", type=int, choices=[1, 2], action="append",
                        help="Test level(s) to run (1=pipeline, 2=full CV). Can specify multiple.")
    parser.add_argument("--video", type=str, default=None,
                        help="Path to test video for Level 2 (auto-generated if not provided)")
    parser.add_argument("--output", type=str, default="benchmark_results.json",
                        help="Output JSON file for results")
    args = parser.parse_args()

    levels = args.level or [1, 2]
    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "ground_truth_moves": len(GROUND_TRUTH_MOVES),
        "ground_truth_pgn": GROUND_TRUTH_PGN_MOVES,
    }

    # ── Level 1 ──────────────────────────────────────────────────────────────
    if 1 in levels:
        print("=" * 60)
        print("LEVEL 1: Move Reconstruction Pipeline")
        print("=" * 60)
        report["level1"] = run_level1_tests()

        # Summary
        print("\n  ── Level 1 Summary ──")
        for name, metrics in report["level1"].items():
            acc = metrics.get("accuracy_pct", 0)
            status = "PASS" if acc >= 90 else ("WARN" if acc >= 70 else "FAIL")
            print(f"    [{status}] {name}: {acc}%")

    # ── Level 2 ──────────────────────────────────────────────────────────────
    if 2 in levels:
        print("\n" + "=" * 60)
        print("LEVEL 2: Full CV Pipeline (ONNX models)")
        print("=" * 60)

        video_path = args.video
        if not video_path:
            video_path = str(Path(__file__).parent / "test_game.mp4")
            if not Path(video_path).exists():
                # Auto-generate if not present locally.
                # A pre-generated copy is available at:
                # https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/test_game_f26c49fe.mp4
                print(f"  Generating test video: {video_path}")
                meta = generate_test_video(video_path, seconds_per_move=4)
                print(f"  Generated: {meta['total_frames']} frames, {meta['duration_seconds']:.0f}s")

        report["level2"] = run_level2_test(video_path)

    # ── Write report ─────────────────────────────────────────────────────────
    output_path = Path(__file__).parent / args.output
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to: {output_path}")

    # ── Exit code based on Level 1 accuracy ──────────────────────────────────
    if "level1" in report:
        perfect_acc = report["level1"].get("perfect_timeline", {}).get("accuracy_pct", 0)
        if perfect_acc < 100:
            print(f"\nFAIL: Perfect timeline accuracy is {perfect_acc}% (expected 100%)")
            sys.exit(1)
        else:
            print(f"\nPASS: Perfect timeline accuracy is 100%")

    sys.exit(0)


if __name__ == "__main__":
    main()
