import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
import pandas as pd
import time as _time

from entryeoms import entryeoms

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

#MAIN FUNCTION STARTS HERE
def main():
    t0 = _time.time()
    print("Hello Mars! Starting the script...")

    # Planet parameters (Mars)
    planet = {
        "mu": 4.2828e13, #[m^3/s^-2] ref- Curtis, H., “Appendix A - Physical Data,” Orbital Mechanics for Engineering Students, Elsevier, 2013
        "rp": 3396e3, #[m] ref- Curtis, H., “Appendix A - Physical Data,” Orbital Mechanics for Engineering Students, Elsevier, 2013
        "atmosphere_model": pd.read_csv("mars-gram-avg.csv", delimiter="\t") #AMAT: Girija 2021
    }

    # Initial conditions parameters
    init = {
        "h0": 124999, # [m] Critical altitude (i.e. altitude to start entry) [m] ref - 125e3 - Li ,Jiang 2014  MSL; Note- Girija 2022 is 120e3. I made I lower for the dataset
        "vel0": 6.0836e3, # [m/s] MSL SPICE data
        "theta0": np.deg2rad(-78.8618), #Initial longitude of probe [rad] ref: SPICE J2000 MSL initial position
        "phi0": np.deg2rad(27.1050), #Initial latitude of probe [rad] ref: SPICE J2000 MSL initial position
        "gamma0": np.deg2rad(-15.5), #flight path angle [rad] (should be negative)  ref - Li ,Jiang 2014  MSL
        "psi0": np.deg2rad(0), #Initial heading angle [rad]

    }

    # Vehicle parameters
    vehicle = {
        "beta": 115, # ballistic coefficient [kg/m^2] ref - Li ,Jiang 2014  MSL
        "LD": 0.24, # lift-to-drag ratio ref - ref - Li ,Jiang 2014  MSL
    }

    # Control parameters
    control = {
        "bank_angle": np.deg2rad(30.0), # [rad] Bank Angle 
    }

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
    print("exit conditions triggered at t = ", sol.t_events[0][0])
   
    # resample at the defined time stamps
    t_end = sol.t[-1]
    time_array = np.arange(0.0, t_end + 1e-12, simulation_termination["dt"]) # epsilon is added to include the endpoint. specifics of np.arange
    states = sol.sol(time_array).T  # shape (N, 6)
    
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

    # export position data and time to a csv file

    # Create DataFrame with proper syntax
    df_position_export = pd.DataFrame({
        'time_s': time_array,
        'x_m': pos_inertial[:, 0],
        'y_m': pos_inertial[:, 1], 
        'z_m': pos_inertial[:, 2]
    })
    df_position_export.to_csv("simulation_results_position.csv", index=False)

    


    # Plot r vs V
    plt.figure()
    plt.plot(states[:, 3] / 1000.0, states[:, 0] / 1000.0, linewidth=1.5, label="Simulated")
    plt.xlabel("Velocity V [km/s]")
    plt.ylabel("Radius r [km]")
    plt.title("r vs v")
    plt.grid(True)
    plt.legend(loc="best")
    plt.show()



if __name__ == "__main__":
    main()