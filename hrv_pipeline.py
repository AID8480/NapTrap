"""
hrv_pipeline.py
HRV fatigue detection pipeline.

Input:  a plain-text file with one RR interval (ms) per line.
Output: hrv_rmssd.png  — RMSSD over time curve
        hrv_fatigue.png — fatigue level (0–3) over time

Fatigue levels based on RMSSD drop ratio vs. rolling 30-min baseline:
  0 — no fatigue      : drop < 10%
  1 — mild fatigue    : 10% <= drop < 25%
  2 — moderate fatigue: 25% <= drop < 40%
  3 — severe fatigue  : drop >= 40%

Usage:
  # Compile Java first (only needed once):
  javac HRVCalculator.java

  # Run pipeline:
  python hrv_pipeline.py rr_intervals.txt

  # Simulate fatigue on first 90 min of data:
  python hrv_pipeline.py rr_intervals.txt --simulate
"""

import subprocess
import sys
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")          # headless backend — no display required
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from scipy import stats as scipy_stats

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
WINDOW_SEC        = 60    # sliding window length in seconds
STEP_SEC          = 5     # step size in seconds
ROLLING_BASE_SEC  = 1800  # rolling baseline window: 30 minutes
SMOOTH_SEC        = 300   # fatigue smoothing window: 5 minutes

RR_MIN_MS = 300.0   # minimum valid RR interval (200 BPM)
RR_MAX_MS = 2000.0  # maximum valid RR interval (30 BPM)

JAVA_CLASS   = "HRVCalculator"
JAVA_DIR     = os.environ.get("JAVA_DIR") or os.path.dirname(os.path.abspath(__file__))

FATIGUE_THRESHOLDS = [0.10, 0.25, 0.40]   # drop ratios for levels 1, 2, 3
FATIGUE_COLORS     = ["#2ecc71", "#f1c40f", "#e67e22", "#e74c3c"]
FATIGUE_LABELS     = ["No fatigue", "Mild", "Moderate", "Severe"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_rr(filepath: str) -> np.ndarray:
    """Load RR intervals from a text file (one value per line, in ms)."""
    rr = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                rr.append(float(line))
    if len(rr) < 2:
        raise ValueError("File must contain at least 2 RR intervals.")
    return np.array(rr, dtype=float)


def filter_rr(rr: np.ndarray) -> np.ndarray:
    """Remove RR intervals outside the physiologically valid range."""
    mask = (rr >= RR_MIN_MS) & (rr <= RR_MAX_MS)
    n_removed = (~mask).sum()
    if n_removed > 0:
        print(f"      Filtered {n_removed} outlier RR values "
              f"(outside {RR_MIN_MS:.0f}–{RR_MAX_MS:.0f} ms)")
    return rr[mask]


def build_windows(rr: np.ndarray, window_sec: int, step_sec: int):
    """
    Return list of (center_time_sec, rr_slice) for each sliding window.
    RR intervals are accumulated into cumulative time to locate windows.
    Each window's RR values are filtered for valid range before yielding.
    """
    cum_time = np.concatenate([[0.0], np.cumsum(rr / 1000.0)])
    total_time = cum_time[-1]

    windows = []
    t_start = 0.0
    while t_start + window_sec <= total_time:
        t_end = t_start + window_sec
        mask = (cum_time[:-1] >= t_start) & (cum_time[:-1] < t_end)
        window_rr = rr[mask]
        # Filter outliers within each window
        window_rr = window_rr[(window_rr >= RR_MIN_MS) & (window_rr <= RR_MAX_MS)]
        if len(window_rr) >= 2:
            center = t_start + window_sec / 2.0
            windows.append((center, window_rr))
        t_start += step_sec
    return windows


def batch_java_rmssd(windows) -> np.ndarray:
    """
    Send all windows to Java in a single subprocess call via stdin.
    Each line = one window's RR values (space-separated).
    Returns array of RMSSD values in the same order.
    """
    stdin_lines = []
    for _, win_rr in windows:
        stdin_lines.append(" ".join(f"{v:.4f}" for v in win_rr))
    stdin_data = "\n".join(stdin_lines) + "\n"

    result = subprocess.run(
        ["java", "-cp", JAVA_DIR, JAVA_CLASS],
        input=stdin_data,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Java RMSSD failed (exit {result.returncode})\n"
            f"  classpath: {JAVA_DIR}\n"
            f"  stderr: {result.stderr.strip()}\n"
            f"  stdout: {result.stdout.strip()}"
        )
    rmssds = []
    for line in result.stdout.strip().splitlines():
        line = line.strip()
        rmssds.append(float("nan") if line == "NaN" else float(line))
    return np.array(rmssds, dtype=float)


def rolling_baseline(times: np.ndarray, rmssds: np.ndarray,
                     window_sec: float) -> np.ndarray:
    """
    For each window i, compute the mean RMSSD of all windows whose center
    falls within [times[i] - window_sec, times[i]).
    Falls back to all available prior windows if fewer than 2 exist.
    """
    baselines = np.empty(len(times))
    for i in range(len(times)):
        t = times[i]
        mask = (times >= t - window_sec) & (times < t)
        if mask.sum() >= 2:
            baselines[i] = np.nanmean(rmssds[mask])
        elif i > 0:
            # Not enough history yet — use all prior windows
            baselines[i] = np.nanmean(rmssds[:i])
        else:
            baselines[i] = rmssds[i]  # first window: baseline = itself
    return baselines


def classify_fatigue(rmssd: float, baseline: float) -> int:
    """Return fatigue level 0–3 based on drop ratio from baseline."""
    if baseline <= 0 or np.isnan(rmssd) or np.isnan(baseline):
        return 0
    drop = (baseline - rmssd) / baseline
    if drop < FATIGUE_THRESHOLDS[0]:
        return 0
    elif drop < FATIGUE_THRESHOLDS[1]:
        return 1
    elif drop < FATIGUE_THRESHOLDS[2]:
        return 2
    else:
        return 3


def smooth_fatigue(times: np.ndarray, levels: np.ndarray,
                   smooth_sec: float) -> np.ndarray:
    """
    Apply a sliding-window mode (majority vote) over smooth_sec seconds
    to reduce per-window jitter in fatigue level output.
    """
    smoothed = np.empty(len(levels), dtype=int)
    for i in range(len(times)):
        t = times[i]
        mask = (times >= t - smooth_sec / 2) & (times <= t + smooth_sec / 2)
        window_levels = levels[mask]
        mode_result = scipy_stats.mode(window_levels, keepdims=True)
        smoothed[i] = int(mode_result.mode[0])
    return smoothed


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline(rr_file: str):
    print(f"[1/5] Loading RR intervals from '{rr_file}' ...")
    rr = load_rr(rr_file)
    rr = filter_rr(rr)
    total_sec = rr.sum() / 1000.0
    print(f"      {len(rr)} intervals, total duration {total_sec:.1f} s "
          f"({total_sec/60:.1f} min)")

    print(f"[2/5] Sliding window: {WINDOW_SEC}s window, {STEP_SEC}s step ...")
    windows = build_windows(rr, WINDOW_SEC, STEP_SEC)
    print(f"      {len(windows)} windows generated")

    print("[3/5] Computing RMSSD via Java (batch) ...")
    rmssds = batch_java_rmssd(windows)
    times  = np.array([w[0] for w in windows])
    print(f"      Done — {len(rmssds)} RMSSD values computed")

    print(f"[4/5] Rolling baseline ({ROLLING_BASE_SEC//60} min) + fatigue classification ...")
    baselines     = rolling_baseline(times, rmssds, ROLLING_BASE_SEC)
    raw_levels    = np.array([classify_fatigue(r, b)
                               for r, b in zip(rmssds, baselines)])
    fatigue_levels = smooth_fatigue(times, raw_levels, SMOOTH_SEC)
    print(f"      Baseline range: {baselines.min():.2f}–{baselines.max():.2f} ms")

    print("[5/5] Plotting ...")
    _plot_rmssd(times, rmssds, baselines)
    _plot_fatigue(times, fatigue_levels,
                  out_file="hrv_fatigue.png",
                  title="Fatigue Level over Time (5-min smoothed)")
    print("      Saved hrv_rmssd.png and hrv_fatigue.png")


def _plot_rmssd(times: np.ndarray, rmssds: np.ndarray, baselines: np.ndarray):
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(times / 60, rmssds,   color="#3498db", linewidth=1.5, label="RMSSD")
    ax.plot(times / 60, baselines, color="#e74c3c", linestyle="--", linewidth=1.2,
            label="Rolling baseline (30 min)")
    ax.set_xlabel("Time (min)")
    ax.set_ylabel("RMSSD (ms)")
    ax.set_title("HRV RMSSD over Time")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig("hrv_rmssd.png", dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Simulate mode
# ---------------------------------------------------------------------------

SIMULATE_DURATION_SEC = 5400   # 90 minutes
SIMULATE_DROP         = 0.40   # target RMSSD drop (40 %)
SIMULATE_SMOOTH_WIN   = 30     # local mean window for variability compression


def apply_fatigue_simulation(rr: np.ndarray,
                              duration_sec: float = SIMULATE_DURATION_SEC,
                              drop: float = SIMULATE_DROP,
                              smooth_win: int = SIMULATE_SMOOTH_WIN) -> np.ndarray:
    """
    Linearly compress RR variability over time so that RMSSD drops by `drop`
    fraction from start to end.

    For each sample i at cumulative time t:
      scale(t) = 1.0 - drop * (t / duration_sec)   [clamped to [1-drop, 1]]

    Each RR value is shifted toward its local mean by (1 - scale):
      rr_sim[i] = local_mean[i] + scale(t[i]) * (rr[i] - local_mean[i])

    The local mean is a centered moving average of width `smooth_win`,
    which preserves the overall heart-rate trend while only compressing
    beat-to-beat variability.
    """
    n = len(rr)
    # Cumulative time in seconds for each beat
    cum_time = np.concatenate([[0.0], np.cumsum(rr / 1000.0)])[:-1]

    # Local mean via uniform moving average (reflect padding at edges)
    half = smooth_win // 2
    padded = np.pad(rr, (half, half), mode="reflect")
    local_mean = np.convolve(padded, np.ones(smooth_win) / smooth_win, mode="valid")[:n]

    # Linear scale factor: 1.0 at t=0, (1-drop) at t=duration_sec
    scale = np.clip(1.0 - drop * (cum_time / duration_sec), 1.0 - drop, 1.0)

    rr_sim = local_mean + scale * (rr - local_mean)
    return rr_sim


def run_simulate(rr_file: str):
    print(f"[1/6] Loading RR intervals from '{rr_file}' ...")
    rr_all = load_rr(rr_file)
    rr_all = filter_rr(rr_all)

    # Trim to first 90 minutes
    cum_time = np.concatenate([[0.0], np.cumsum(rr_all / 1000.0)])
    cutoff_idx = np.searchsorted(cum_time[:-1], SIMULATE_DURATION_SEC, side="right")
    rr_raw = rr_all[:cutoff_idx]
    actual_min = rr_raw.sum() / 1000.0 / 60
    print(f"      Using first {actual_min:.1f} min ({len(rr_raw)} intervals)")

    print(f"[2/6] Applying fatigue simulation "
          f"(linear {int(SIMULATE_DROP*100)}% RMSSD drop over {SIMULATE_DURATION_SEC//60} min) ...")
    rr_sim = apply_fatigue_simulation(rr_raw)

    print(f"[3/6] Sliding window: {WINDOW_SEC}s window, {STEP_SEC}s step ...")
    windows_raw = build_windows(rr_raw, WINDOW_SEC, STEP_SEC)
    windows_sim = build_windows(rr_sim, WINDOW_SEC, STEP_SEC)
    print(f"      {len(windows_sim)} windows generated")

    print("[4/6] Computing RMSSD via Java (batch) ...")
    rmssds_raw = batch_java_rmssd(windows_raw)
    rmssds_sim = batch_java_rmssd(windows_sim)
    times = np.array([w[0] for w in windows_sim])
    print(f"      Done — {len(rmssds_sim)} RMSSD values computed")

    print(f"[5/6] Rolling baseline + fatigue classification ...")
    baselines     = rolling_baseline(times, rmssds_sim, ROLLING_BASE_SEC)
    raw_levels    = np.array([classify_fatigue(r, b)
                               for r, b in zip(rmssds_sim, baselines)])
    fatigue_levels = smooth_fatigue(times, raw_levels, SMOOTH_SEC)
    print(f"      Baseline range: {baselines.min():.2f}–{baselines.max():.2f} ms")

    print("[6/6] Plotting ...")
    _plot_rmssd_simulated(times, rmssds_raw, rmssds_sim, baselines)
    _plot_fatigue(times, fatigue_levels,
                  out_file="hrv_fatigue_simulated.png",
                  title="Fatigue Level over Time — Simulated (5-min smoothed)")
    print("      Saved hrv_rmssd_simulated.png and hrv_fatigue_simulated.png")


def _plot_rmssd_simulated(times: np.ndarray, rmssds_raw: np.ndarray,
                           rmssds_sim: np.ndarray, baselines: np.ndarray):
    fig, ax = plt.subplots(figsize=(12, 4))
    ax.plot(times / 60, rmssds_raw, color="#95a5a6", linewidth=1.0,
            linestyle=":", label="Original RMSSD")
    ax.plot(times / 60, rmssds_sim, color="#3498db", linewidth=1.5,
            label="Simulated RMSSD")
    ax.plot(times / 60, baselines,  color="#e74c3c", linestyle="--", linewidth=1.2,
            label="Rolling baseline (30 min)")
    ax.set_xlabel("Time (min)")
    ax.set_ylabel("RMSSD (ms)")
    ax.set_title("HRV RMSSD over Time — Simulated Fatigue")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig("hrv_rmssd_simulated.png", dpi=150)
    plt.close(fig)


def _plot_fatigue(times: np.ndarray, levels: np.ndarray,
                  out_file: str = "hrv_fatigue.png",
                  title: str = "Fatigue Level over Time (5-min smoothed)"):
    fig, ax = plt.subplots(figsize=(12, 3))
    t_min = times / 60

    step = (t_min[1] - t_min[0]) if len(t_min) > 1 else 1.0
    for i in range(len(t_min)):
        color = FATIGUE_COLORS[levels[i]]
        x0 = t_min[i] - step / 2 if i > 0 else t_min[0]
        x1 = t_min[i] + step / 2 if i < len(t_min) - 1 else t_min[-1]
        ax.axvspan(x0, x1, color=color, alpha=0.6)

    ax.step(t_min, levels, color="black", linewidth=1.0, where="mid")
    ax.set_yticks([0, 1, 2, 3])
    ax.set_yticklabels(FATIGUE_LABELS)
    ax.set_xlabel("Time (min)")
    ax.set_ylabel("Fatigue Level")
    ax.set_title(title)
    ax.set_ylim(-0.5, 3.5)

    patches = [mpatches.Patch(color=FATIGUE_COLORS[i], label=FATIGUE_LABELS[i])
               for i in range(4)]
    ax.legend(handles=patches, loc="upper right", fontsize=8)
    ax.grid(True, axis="x", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_file, dpi=150)
    plt.close(fig)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="HRV fatigue detection pipeline")
    parser.add_argument("rr_file", help="Text file with one RR interval (ms) per line")
    parser.add_argument("--simulate", action="store_true",
                        help="Simulate fatigue on first 90 min of data")
    args = parser.parse_args()

    if not os.path.isfile(args.rr_file):
        print(f"Error: file not found: {args.rr_file}")
        sys.exit(1)

    if args.simulate:
        run_simulate(args.rr_file)
    else:
        run_pipeline(args.rr_file)
