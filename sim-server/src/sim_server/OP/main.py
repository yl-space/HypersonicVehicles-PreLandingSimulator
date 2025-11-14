import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
import time as _time

from src.sim_server.OP.entryeoms import entryeoms
from src.sim_server.OP.coordinates import Cartesian_to_Spherical

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
#def high_fidelity_simulation(planet: dict, init: dict, vehicle: dict, control: dict, verbose = False, return_states=False, input_type = "Spherical") -> dict:

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
        "dt": 0.1, # [sec] time step for the simulation
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

    t_ODE_start = _time.time()
    sol = solve_ivp(
        rhs,
        t_span=(0.0, simulation_termination["time_limit"]),
        y0=ODE_initial_cond,
        events=exitcon,
        rtol=1e-5,
        atol=1e-3,
        dense_output=True, # this is needed to evaluate the solution at the time points I need 
        method='RK45'
    )

    # resample at the defined time stamps
    t_end = sol.t[-1]
    time_array = np.arange(0.0, t_end + 1e-12, simulation_termination["dt"]) # epsilon is added to include the endpoint. specifics of np.arange
    states = sol.sol(time_array).T  # shape (N, 6)
    
    if verbose:
        #print(f"Script completed in {(_time.time() - t0):.3f} s")
        #print("final velocity is ", states[:, 3][-1] / 1000.0, "km/s" "= Mach ", states[:, 3][-1] / 236.38)
        print(f"ODE integration time = {_time.time() - t_ODE_start:.3f} s")

    # save the final state as benchmark: 
    # remove comment to save the benchmark or change the name to save other stuff 
    final_output = states[-1, :]
    #np.savez("benchmark_DOP853_1e9.npz", final_output=final_output)

    # load the benchmark data 
    benchmark_data = np.load("benchmark_DOP853_1e9.npz")
    benchmark_final_output = benchmark_data["final_output"]
    #print("benchmark final output: ", benchmark_final_output)

    if verbose:
        # print the final state
        #print("final state: ", final_output)
        # print the difference of the benchmark and final output for each state separately
        print("the output below shows the difference between the benchmark and the final output")
        print(f"difference in radius: {final_output[0] - benchmark_final_output[0]:.5g}")
        print(f"difference in longitude: {final_output[1] - benchmark_final_output[1]:.5g}")
        print(f"difference in latitude: {final_output[2] - benchmark_final_output[2]:.5g}")
        print(f"difference in velocity: {final_output[3] - benchmark_final_output[3]:.5g}")
        print(f"difference in FPA: {final_output[4] - benchmark_final_output[4]:.5g}")
        print(f"difference in heading: {final_output[5] - benchmark_final_output[5]:.5g}")


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

    # save cartesian states to a file
    #np.savez("benchmark_DOP853_1e9_cartesian.npz", x_m=pos_inertial[:, 0], y_m=pos_inertial[:, 1], z_m=pos_inertial[:, 2], vx_m_s=vel_inertial[:, 0], vy_m_s=vel_inertial[:, 1], vz_m_s=vel_inertial[:, 2])
    # Return the results

    if return_states:
        return {
            'time_s': time_array + init.get("start_time_s", 0.0),
            'states': states,
            'pos_inertial': pos_inertial,
            'vel_inertial': vel_inertial,
        }

    
    return {
        'time_s': time_array + init.get("start_time_s", 0.0),
        'x_m': pos_inertial[:, 0],
        'y_m': pos_inertial[:, 1], 
        'z_m': pos_inertial[:, 2],
        'vx_m_s': vel_inertial[:, 0],
        'vy_m_s': vel_inertial[:, 1],
        'vz_m_s': vel_inertial[:, 2],
    }




#MAIN FUNCTION STARTS HERE
def main(init=None, control=None):
    from src.sim_server.constants.defaults import DEFAULT_PLANET, DEFAULT_INIT, DEFAULT_VEHICLE, DEFAULT_CONTROL
    from src.sim_server.constants.vehicles import get_vehicle_params
    from src.sim_server.constants.planets import get_planet_params

    # Define simulation parameters
    planet = get_planet_params(DEFAULT_PLANET["planet_name"])

    # init = {
    # "h0": 124999, # [m] Critical altitude (i.e. altitude to start entry) [m] ref - 125e3 - Li ,Jiang 2014  MSL; Note- Girija 2022 is 120e3. I made I lower for the dataset
    # "vel0": 6.0836e3, # [m/s] MSL SPICE data
    # "theta0": np.deg2rad(0), #Initial longitude of probe [rad] ref: SPICE J2000 MSL initial position
    # "phi0": np.deg2rad(0), #Initial latitude of probe [rad] ref: SPICE J2000 MSL initial position
    # "gamma0": np.deg2rad(-15.5), #flight path angle [rad] (should be negative)  ref - Li ,Jiang 2014  MSL
    # "psi0": np.deg2rad(0), #Initial heading angle [rad]
    # }

    # control = {
    # "bank_angle": np.deg2rad(30), # [rad] Bank Angle 
    # }

    init = init if init is not None else DEFAULT_INIT
    vehicle = get_vehicle_params(DEFAULT_VEHICLE["vehicle_name"])
    control = control if control is not None else DEFAULT_CONTROL

    # Run the high-fidelity simulation
    results = high_fidelity_simulation(planet, init, vehicle, control, verbose=True, return_states=True)

    # Plot r vs V
    plt.figure()
    plt.plot(results['states'][:, 3] / 1000.0, results['states'][:, 0] / 1000.0, linewidth=1.5, label="Simulated")
    plt.xlabel("Velocity V [km/s]")
    plt.ylabel("Radius r [km]")
    plt.title("r vs v")
    plt.grid(True)
    plt.legend(loc="best")
    plt.show()

    # 3D plot of theta, phi and altitude 
    alt = results['states'][:, 0]/ 1000.0 - planet["rp"]/ 1000.0
    theta = np.rad2deg(results['states'][:, 1])
    phi = np.rad2deg(results['states'][:, 2])
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')  # Create 3D axes
    ax.plot(theta, phi, alt, linewidth=1.5, label="Simulated")
    ax.set_xlabel("Theta [deg]")
    ax.set_ylabel("Phi [deg]")
    ax.set_zlabel("Altitude [km]")
    ax.set_title("Theta, Phi and Altitude")
    ax.legend(loc="best")
    plt.grid(True)
    plt.show()


if __name__ == "__main__":
    main()
    # this block is just a surrogate to be replaced. The input for the recalc function will need to be repalced with real stuff
    from src.sim_server.constants.defaults import DEFAULT_PLANET
    from src.sim_server.constants.planets import get_planet_params
    planet = get_planet_params(DEFAULT_PLANET["planet_name"])
    bank_angle_changed = True
    # point_of_input = {
    # "h0": 124999, 
    # "vel0": 6.0836e3, 
    # "theta0": np.deg2rad(-78.8618), 
    # "phi0": np.deg2rad(27.1050),
    # "gamma0": np.deg2rad(-15.5), 
    # "psi0": np.deg2rad(0),
    # }
    bank_angle_input = {
        "bank_angle": np.deg2rad(30.0), # [rad] Bank Angle 
    }

    # I will use the example point along the trajectory which is approximatelly number 10000 out of 16157
    # if the bank angle input remains the same, the final error should remain the same, as documented in pptx

    point_of_input_Cartesian = {
        "x": 1.205532181396078e+06,
        "y": -2.796002637077214e+06,
        "z": 1.558152803402915e+06,
        "vx": 7.762841024785303e+02,
        "vy": 4.340321796247736e+02,
        "vz": 0.882049683132209e+02,
    }

    point_of_input_Spherical = Cartesian_to_Spherical(point_of_input_Cartesian)
    new_init = {
        "h0": point_of_input_Spherical["r"] - planet["rp"], # [m] Initial altitude us beeded as input 
        "vel0": point_of_input_Spherical["V"],
        "theta0": point_of_input_Spherical["theta"],
        "phi0": point_of_input_Spherical["phi"],
        "gamma0": point_of_input_Spherical["gamma"],
        "psi0": point_of_input_Spherical["psi"],
    }

    if bank_angle_changed == True:
        main(init=new_init, control=bank_angle_input)
   
