from pydantic import BaseModel, Field
from typing import Optional

class PlanetParams(BaseModel):
    planet_name: Optional[str] = Field(None, description="Name of the planet (e.g., 'mars')")

class InitParams(BaseModel):
    h0: Optional[float] = Field(None, description="Initial altitude [m]")
    vel0: Optional[float] = Field(None, description="Initial velocity [m/s]")
    theta0: Optional[float] = Field(None, description="Initial longitude [rad]")
    phi0: Optional[float] = Field(None, description="Initial latitude [rad]")
    gamma0: Optional[float] = Field(None, description="Flight path angle [rad]")
    psi0: Optional[float] = Field(None, description="Initial heading angle [rad]")

class VehicleParams(BaseModel):
    vehicle_name: Optional[str] = Field(None, description="Name of the vehicle (e.g., 'default')")

class ControlParams(BaseModel):
    bank_angle: Optional[float] = Field(None, description="Bank angle [rad]")