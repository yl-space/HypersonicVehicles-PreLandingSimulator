import numpy as np

def entryeoms(t: float, x: np.ndarray, planet: dict, vehicle: dict, control: dict) -> np.ndarray:
    """Mars entry equations of motion. Vinh's equations. Ref: Vinh Hypersonic and Planetary Entry Flight Mechanics

    State x = [radius, longitude, latitude, velocity, flight path angle, heading].
    """
    # extract states 
    r = x[0]
    #theta = x[1] # not used in the EOMs
    phi = x[2]
    V = x[3]
    gamma = x[4]
    psi = x[5]

    # extract parameters
    mu = planet["mu"]
    beta = vehicle["beta"]
    LD = vehicle["LD"]
    bank = control["bank_angle"]

    # Atmosphere density via linear interpolation of aero database 
    # table columns: H[m], T[K], P[N/m2], rho[kg/m3], a[m/s]

    h = r - planet["rp"]
    altitudes_data = planet["atmosphere_model"].iloc[:,0]
    rhos_data = planet["atmosphere_model"].iloc[:,3]
    rho = np.interp(h, altitudes_data, rhos_data)

    # Kinematics
    raddot = V * np.sin(gamma)
    thetadot = V * np.cos(gamma) * np.cos(psi) / (r * np.cos(phi))
    phidot = V * np.cos(gamma) * np.sin(psi) / r

    # Dynamics
    veldot = -rho * (V ** 2) / (2 * beta) - mu * np.sin(gamma) / (r ** 2)
    gammadot = V * np.cos(gamma) / r + rho * V * LD * np.cos(bank) / (2 * beta) - mu * np.cos(gamma) / (V * (r ** 2))
    psidot = rho * V * LD * np.sin(bank) / (2 * beta * np.cos(gamma)) - V * np.cos(gamma) * np.cos(psi) * np.tan(phi) / r
    
    return np.array([raddot, thetadot, phidot, veldot, gammadot, psidot], dtype=float)