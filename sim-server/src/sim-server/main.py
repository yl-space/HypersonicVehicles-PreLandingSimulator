
from fastapi import FastAPI
import uvicorn
from analytic_simulation import analytic_simulation
from dotenv import load_dotenv
import os

DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000

load_dotenv()
app = FastAPI()

@app.get("/analytic/")
async def analytic():
    return analytic_simulation()

if __name__ == "__main__":
    host = os.getenv("SIM_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("SIM_SERVER_PORT", DEFAULT_PORT))
    uvicorn.run("main:app", host=host, port=port, reload=True)