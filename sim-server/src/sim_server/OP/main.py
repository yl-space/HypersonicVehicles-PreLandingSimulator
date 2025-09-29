import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
import time as _time

from src.sim_server.OP.entryeoms import entryeoms

#secondary functions: I need to move them to seprate files and import for calrity probably


def make_event(ind: int, term: float):
    """Create a SciPy event function with terminal and direction attributes.

    The event triggers when x[ind] - term crosses zero from positive to negative.
    """

    def event(t: float, x: np.ndarray):
        return x[ind] - term

    # terminal stop and decreasing direction only
    event.terminal = True
    event.direction = -1.0
    return event

def high_fidelity_simulation(planet: dict, init: dict, vehicle: dict, control: dict, verbose = False, return_states=False) -> dict:
    """Run a high-fidelity simulation of atmospheric entry.

    Args:
        planet: Dictionary containing planetary parameters.
        init: Dictionary containing initial conditions.
        vehicle: Dictionary containing vehicle parameters.
        control: Dictionary containing control parameters.
    Returns:
        Dictionary with simulation results including time, position, and velocity arrays.
    """
    t0 = _time.time()
    
    ODE_terminal_index = 0

    if ODE_terminal_index == 0:
        terminal_condition = planet["rp"] + 6500 #ODE Terminal value. Terminating at 6.5 km Li ,Jiang 2014  MSL - parachute deployment altitude
    elif ODE_terminal_index == 3:
        terminal_condition = 236.38 #[m/s] Mach = 1. ref: mars-gram-avg.csv
    else:
        raise ValueError("Invalid ODE terminal index")

    simulation_termination = {
        "ind": ODE_terminal_index, # ODE terminal index (0=radius, 1=longitude, 2=latitude, 3=velocity, 4=FPA, 5=heading, 6=downrange, 7=heat load) ref: Sarag Saikia (c) 2014
        "term": terminal_condition,
        "time_limit": 1000.0, # [s] Simulation time limit 
        "dt": 0.02, # [sec] time step for the simulation
    }

    # initial conditions for ODE integration in a form: [radius, longitude, latitude, velocity, FPA, heading]

    ODE_initial_cond = np.array([
        planet["rp"] + init["h0"],
        init["theta0"],
        init["phi0"],
        init["vel0"],
        init["gamma0"],
        init["psi0"],
    ], dtype=float)

    # ODE integration
    exitcon = make_event(simulation_termination["ind"], simulation_termination["term"])

    def rhs(t, x):
        """Right-hand side wrapper function for Mars entry ODE integration.
        
        Args:
            t: Time (not used in this autonomous system)
            x: State vector [r, theta(longitude), phi(latitude), V, gamma(FPA), psi(heading)]
        
        Returns:
            State derivative vector
        """
        return entryeoms(t, x, planet, vehicle, control)

    sol = solve_ivp(
        rhs,
        t_span=(0.0, simulation_termination["time_limit"]),
        y0=ODE_initial_cond,
        events=exitcon,
        rtol=1e-9,
        atol=1e-9,
        dense_output=True, # this is needed to evaluate the solution at the time points I need 
        method='DOP853'
    )
    if verbose:
        print("exit conditions triggered at t = ", sol.t_events[0][0])
   
    # resample at the defined time stamps
    t_end = sol.t[-1]
    time_array = np.arange(0.0, t_end + 1e-12, simulation_termination["dt"]) # epsilon is added to include the endpoint. specifics of np.arange
    states = sol.sol(time_array).T  # shape (N, 6)
    
    if verbose:
        print(f"Script completed in {(_time.time() - t0):.3f} s")
        print("final velocity is ", states[:, 3][-1] / 1000.0, "km/s" "= Mach ", states[:, 3][-1] / 236.38)

    # Convert spherical to inertial Cartesian position
    # ref - L1b. Nav. class notes and iPad notebook board
    # vectorized instead of the loop as in my MATLAB
    r = states[:, 0]
    theta = states[:, 1]
    phi = states[:, 2]
    co_latitude = np.pi / 2 - phi
    pos_inertial = np.empty((time_array.size, 3), dtype=float)
    pos_inertial[:, 0] = r * np.sin(co_latitude) * np.cos(theta)
    pos_inertial[:, 1] = r * np.sin(co_latitude) * np.sin(theta)
    pos_inertial[:, 2] = r * np.cos(co_latitude)

    #Calculate velocities using central difference
    vel_inertial = np.zeros_like(pos_inertial)
    vel_inertial[1:-1,:] = (pos_inertial[2:,:] - pos_inertial[:-2,:]) / (2 * simulation_termination["dt"])
    # endpoints are treated differently
    vel_inertial[0,:] = (pos_inertial[1,:] - pos_inertial[0,:]) / simulation_termination["dt"]
    vel_inertial[-1,:] = (pos_inertial[-1,:] - pos_inertial[-2,:]) / simulation_termination["dt"]

    # trim the data to exclude the endpoints. just in case beacuse I had issues with them when working on navigation
    pos_inertial = pos_inertial[1:-1,:]
    vel_inertial = vel_inertial[1:-1,:]
    time_array = time_array[1:-1]

    if return_states:
        return {
            'time_s': time_array,
            'states': states,
            'pos_inertial': pos_inertial,
            'vel_inertial': vel_inertial,
        }

    # Return the results
    return {
        'time_s': time_array,
        'x_m': pos_inertial[:, 0],
        'y_m': pos_inertial[:, 1], 
        'z_m': pos_inertial[:, 2],
        'vx_m_s': vel_inertial[:, 0],
        'vy_m_s': vel_inertial[:, 1],
        'vz_m_s': vel_inertial[:, 2],
    }

#MAIN FUNCTION STARTS HERE
def main():
    from src.sim_server.constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
    from src.sim_server.constants.vehicles import get_vehicle_params
    from src.sim_server.constants.planets import get_planet_params

    # Define simulation parameters
    planet = get_planet_params(DEFAULT_PLANET["planet_name"])
    init = DEFAULT_INIT
    vehicle = get_vehicle_params(DEFAULT_VEHICLE["vehicle_name"])
    control = DEFAULT_CONTROL

    # Run the high-fidelity simulation
    results = high_fidelity_simulation(planet, init, vehicle, control, verbose=True, return_states=True)

    # Plot r vs V
    # plt.figure()
    # plt.plot(results['states'][:, 3] / 1000.0, results['states'][:, 0] / 1000.0, linewidth=1.5, label="Simulated")
    # plt.xlabel("Velocity V [km/s]")
    # plt.ylabel("Radius r [km]")
    # plt.title("r vs v")
    # plt.grid(True)
    # plt.legend(loc="best")
    # plt.show()


if __name__ == "__main__":
    main()