from fastapi import FastAPI, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import json, uuid
from fastapi.encoders import jsonable_encoder
import google.generativeai as genai
import traceback
from contextlib import asynccontextmanager
import asyncio
from api.tabular_review import cleanup_old_buffers, _redis_listener

# ------------ custom JSONResponse to stringify UUIDs ------------
class UUIDEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        return super().default(obj)

class UUIDJSONResponse(JSONResponse):
    def render(self, content: any) -> bytes:
        return json.dumps(
            jsonable_encoder(content),
            cls=UUIDEncoder,
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":")
        ).encode("utf-8")

# ------------ single FastAPI instantiation ------------


# @app.on_event("startup")
# async def _startup():
#     asyncio.create_task(_redis_listener())
#     asyncio.create_task(cleanup_old_buffers())
#     print("✅ background listeners started")

@asynccontextmanager
async def lifespan(app: FastAPI):
    bg1 = asyncio.create_task(_redis_listener())
    bg2 = asyncio.create_task(cleanup_old_buffers())
    yield                                   # --- application is running ---
    bg1.cancel(); bg2.cancel()              # graceful shutdown


app = FastAPI(
    title="Document Processor API",
    version="1.0.0",
    default_response_class=UUIDJSONResponse,
    lifespan=lifespan
)


# ------------ Exception handlers for better debugging ------------
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle FastAPI validation errors (422)"""
    print(f"Validation error on {request.method} {request.url}: {exc.errors()}")
    # Don't try to read request.body() as it's already consumed by FastAPI
    
    # Get more details about the validation error
    error_details = []
    for error in exc.errors():
        error_details.append({
            "field": error.get("loc", [])[-1] if error.get("loc") else "unknown",
            "message": error.get("msg", "Unknown validation error"),
            "type": error.get("type", "unknown"),
            "location": error.get("loc", [])
        })
    
    print(f"Detailed validation errors: {error_details}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation error",
            "errors": error_details,
            "message": "Request validation failed. Please check your input data."
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle any other exceptions"""
    print(f"Unexpected error on {request.method} {request.url}: {str(exc)}")
    print(f"Traceback: {traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred. Please try again."
        }
    )

# ------------ CORS (allow your front-end + SSE preflight) ------------
origins = [
    "http://localhost:3000",
    "http://localhost:3001",  # Add port 3001 where frontend is running
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    
    # add your prod domains here, e.g. "https://app.example.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # OPTIONS is crucial for preflight
    allow_headers=["*"],                                       # allow Authorization, Accept, etc.
    allow_credentials=True,                                    # if you ever move to cookie auth
    expose_headers=["Cache-Control", "Content-Type"],          # not strictly required, but safe
)

# ------------ include your routers ------------
from api import auth, files, health, tabular_review, folder

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(health.router, prefix="/api/health", tags=["health"])
app.include_router(tabular_review.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(folder.router, prefix="/api/folders", tags=["folders"])

@app.get("/")
async def root():
    return {"message": "Document Processor API"}

genai.configure(api_key="AIzaSyDy9myuyslplkPf2pM19iV9ZBDClrA675w")
# ------------ run ------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
