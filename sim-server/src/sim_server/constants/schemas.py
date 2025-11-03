from math import gamma
from pydantic import BaseModel, Field
from typing import Optional, Union, Literal, Annotated

class PlanetParams(BaseModel):
    planet_name: Optional[str] = Field(None, description="Name of the planet (e.g., 'mars')")

class SphericalInitParams(BaseModel):
    """Initial conditions in spherical coordinates"""
    coord_type: Literal["spherical"] = "spherical"
    h0: float = Field(..., description="Initial altitude [m]")
    vel0: float = Field(..., description="Initial velocity [m/s]")
    theta0: float = Field(..., description="Initial longitude [rad]")
    phi0: float = Field(..., description="Initial latitude [rad]")
    gamma0: float = Field(..., description="Initial flight path angle [rad]")
    psi0: float = Field(..., description="Initial heading angle [rad]")
    start_time_s: Optional[float] = Field(0.0, description="Start time of the simulation [s]")

class CartesianInitParams(BaseModel):
    """Initial conditions in Cartesian coordinates"""
    coord_type: Literal["cartesian"] = "cartesian"
    x_m: float = Field(..., description="Initial x position [m]")
    y_m: float = Field(..., description="Initial y position [m]")
    z_m: float = Field(..., description="Initial z position [m]")
    vx_m_s: float = Field(..., description="Initial x velocity [m/s]")
    vy_m_s: float = Field(..., description="Initial y velocity [m/s]")
    vz_m_s: float = Field(..., description="Initial z velocity [m/s]")
    start_time_s: Optional[float] = Field(0.0, description="Start time of the simulation [s]")

# Discriminated union - FastAPI will automatically parse based on coord_type
InitParams = Annotated[Union[SphericalInitParams, CartesianInitParams], Field(discriminator='coord_type')]

class VehicleParams(BaseModel):
    vehicle_name: Optional[str] = Field(None, description="Name of the vehicle (e.g., 'default')")

class ControlParams(BaseModel):
    bank_angle: Optional[float] = Field(None, description="Bank angle [rad]")