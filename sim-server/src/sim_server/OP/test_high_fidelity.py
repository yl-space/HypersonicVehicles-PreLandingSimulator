import numpy as np
import pytest
from numpy.testing import assert_allclose
from src.sim_server.OP.main import high_fidelity_simulation
from src.sim_server.constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
from src.sim_server.constants.vehicles import get_vehicle_params
from src.sim_server.constants.planets import get_planet_params

def test_high_fidelity():

    benchmark_data = np.load("benchmark_optimized_RK45_cartesian.npz")
    benchmark_x_m = benchmark_data["x_m"]
    benchmark_y_m = benchmark_data["y_m"]
    benchmark_z_m = benchmark_data["z_m"]
    benchmark_vx_m_s = benchmark_data["vx_m_s"]
    benchmark_vy_m_s = benchmark_data["vy_m_s"]
    benchmark_vz_m_s = benchmark_data["vz_m_s"]

    final_cartesian_states_benchmark = np.array([benchmark_x_m[-1], benchmark_y_m[-1], benchmark_z_m[-1], benchmark_vx_m_s[-1], benchmark_vy_m_s[-1], benchmark_vz_m_s[-1]])
    print("final cartesian states benchmark: ", final_cartesian_states_benchmark)

    abs_tolerance = 1e-7 # TODO: verify this value based on numerical precision

    # Define simulation parameters
    planet = get_planet_params(DEFAULT_PLANET["planet_name"])
    init = DEFAULT_INIT
    vehicle = get_vehicle_params(DEFAULT_VEHICLE["vehicle_name"])
    control =  DEFAULT_CONTROL

    # Run the high-fidelity simulation
    results = high_fidelity_simulation(planet, init, vehicle, control, verbose=False, return_states=False)

    x_m = results["x_m"]
    y_m = results["y_m"]
    z_m = results["z_m"]
    vx_m_s = results["vx_m_s"]
    vy_m_s = results["vy_m_s"]
    vz_m_s = results["vz_m_s"]

    final_cartesian_states_simulated = np.array([x_m[-1], y_m[-1], z_m[-1], vx_m_s[-1], vy_m_s[-1], vz_m_s[-1]])
    print("final cartesian states simulated: ", final_cartesian_states_simulated)

    # check the difference between the benchmark and the simulated states
    difference = np.abs(final_cartesian_states_benchmark - final_cartesian_states_simulated)
    print("difference: ", difference)

    assert_allclose(actual=final_cartesian_states_simulated, 
                    desired=final_cartesian_states_benchmark, 
                    atol=abs_tolerance)
    


if __name__ == "__main__":
    test_high_fidelity()