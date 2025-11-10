import numpy as np

def DCM_ENU_2_ECEF(theta: float, phi: float) -> np.ndarray:
        """Calculate the Direction Cosine Matrix from ENU to ECEF.
        
        Args:
            theta: Longitude [rad]
            phi: Latitude [rad]
        Returns:
            Direction Cosine Matrix from ENU to ECEF
        """
        return np.array([[-np.sin(theta), -np.cos(theta)*np.sin(phi), np.cos(theta)*np.cos(phi)],
                         [np.cos(theta), -np.sin(theta)*np.sin(phi), np.cos(phi)*np.sin(theta)],
                         [0, np.cos(phi), np.sin(phi)]])

def Cartesian_to_Spherical(Cartesian_point: dict) -> dict:
    """Convert Cartesian coordinates to spherical coordinates with the velocity direction components.
    
    Args:
        Cartesian_point: Dictionary containing Cartesian coordinates [x, y, z] and velocity components [vx, vy, vz]
    Returns:
        Dictionary containing spherical coordinates [r, theta, phi] and velocity components [V, psi, gamma]
    """

    r = np.sqrt(Cartesian_point["x"]**2 + Cartesian_point["y"]**2 + Cartesian_point["z"]**2)
    theta = np.arctan2(Cartesian_point["y"], Cartesian_point["x"])
    phi = np.pi/2 - np.acos(Cartesian_point["z"] / r)
    V_mag = np.sqrt(Cartesian_point["vx"]**2 + Cartesian_point["vy"]**2 + Cartesian_point["vz"]**2)
    r_hat = np.array([Cartesian_point["x"], Cartesian_point["y"], Cartesian_point["z"]]) / r
    V_r = np.dot(np.array([Cartesian_point["vx"], Cartesian_point["vy"], Cartesian_point["vz"]]), r_hat)
    V_theta = np.sqrt(V_mag**2 - V_r**2)
    gamma = np.arctan2(V_r, V_theta)
    DCM_ENU_2_ECEF_value = DCM_ENU_2_ECEF(theta, phi)
    V_ENU = DCM_ENU_2_ECEF_value.T @ np.array([Cartesian_point["vx"], Cartesian_point["vy"], Cartesian_point["vz"]])
    psi = np.arctan2(V_ENU[1], V_ENU[0])
    return {
        "r": r,
        "theta": theta,
        "phi": phi,
        "V": V_mag,
        "psi": psi,
        "gamma": gamma,
    }