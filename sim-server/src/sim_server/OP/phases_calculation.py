import numpy as np

def phases_calculation_entry(time: np.ndarray, states: np.ndarray, total_heat_rate: np.ndarray) -> tuple[float, float, float, float]:
    """
    This function has hardcoded user-defined values for phase transtitions
    Compute phase transition times t12, t23, t34, t45.

    Parameters
    ----------
    time : array_like
        Time history.
    states : array_like
        State history, where states[:, 0] is radius.
    total_heat_rate : array_like
        Heat-rate history.

    Returns
    -------
    t12, t23, t34, t45 : float
        Phase transition times.
    """

    # make sure sizes are good
    t = np.asarray(time).reshape(-1)
    qdot = np.asarray(total_heat_rate).reshape(-1)
    states = np.asarray(states)

    qdot_max = np.max(qdot)
    qdot_norm = qdot / qdot_max

    # User-defined thresholds
    heat_start_frac = 0.05   # 5% of peak heating
    peak_window_frac = 0.50  # 50% of peak heating
    SUFR_buffer = 20         # [s]

    # Phase 1 -> Phase 2
    idx12_candidates = np.where(qdot_norm >= heat_start_frac)[0]
    #print("idx12_candidates: ", idx12_candidates)
    idx12 = idx12_candidates[0] if idx12_candidates.size > 0 else None

    # Phase 2 -> Phase 3
    idx_peak = np.argmax(qdot_norm)
    idx23_candidates = np.where(qdot_norm >= peak_window_frac)[0]
    idx23 = idx23_candidates[0] if idx23_candidates.size > 0 else None

    # Phase 3 -> Phase 4
    idx_after_peak_candidates = np.where(qdot_norm[idx_peak:] < peak_window_frac)[0]
    idx34 = (idx_peak + idx_after_peak_candidates[0] - 1
             if idx_after_peak_candidates.size > 0 else None)

    # Phase 4 -> Phase 5
    # Straighten Up and Fly Right before parachute deployment
    time_chute = time[-1]
    t45 = time_chute - SUFR_buffer

    if idx12 is None or idx23 is None or idx34 is None:
        print("Phase calculation failed. Check user-defined thresholds.")

    t12 = t[idx12]
    t23 = t[idx23]
    t34 = t[idx34]

    return t12, t23, t34, t45