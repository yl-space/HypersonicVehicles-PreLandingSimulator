from pathlib import Path
import pandas as pd

DATA_FOLDER = Path(__file__).parent.parent / "data"

PLANETS = {
    "mars": {
        "mu": 4.2828e13, #[m^3/s^-2] ref- Curtis, H., “Appendix A - Physical Data,” Orbital Mechanics for Engineering Students, Elsevier, 2013
        "rp": 3396e3, #[m] ref- Curtis, H., “Appendix A - Physical Data,” Orbital Mechanics for Engineering Students, Elsevier, 2013
        "atmosphere_model": pd.read_csv(DATA_FOLDER / "mars-gram-avg.csv", delimiter="\t") #AMAT: Girija 2021
    }
}

def get_planet_params(planet_name: str) -> dict:
    """Retrieve planetary parameters by name."""
    planet = PLANETS.get(planet_name.lower())
    if not planet:
        raise ValueError(f"Planet '{planet_name}' not found. Available planets: {list(PLANETS.keys())}")
    return planet