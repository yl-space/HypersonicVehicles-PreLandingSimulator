# Sim Server

This folder contains all the code for LSPE's Hypersonic Vehicles' underlying simulation.

## Development

This Python server is written with `uv`. Install here: https://docs.astral.sh/uv/getting-started/installation/

From this folder, run `uv sync` to build your virtual environment.

To activate the environment in VSCode, follow these instructions: https://github.com/astral-sh/uv/issues/9637

To run the code locally enter the *sim-server* directory, and run: `uv run python src/sim_server/main.py`

To run tests, run: `uv run pytest`

To add a package, use `uv add <package-name>`. DO NOT pip install it!

**Recommended Development Pattern:**

When developing a simulation function, split it into many individual testable functions. Then, write tests cases in the test file for that function. 

Add tests for functions that combine other functions. 

Add tests for the full simulation functions.

Test cases should cover different types and values of parameters.

### Relevant Background

FastAPI usage:
https://fastapi.tiangolo.com/tutorial/path-params/

Pytest: 
https://docs.pytest.org/en/stable/getting-started.html