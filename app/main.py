from fastapi import FastAPI, Response, status, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from . import models
from .database import engine, get_db
from .routers import post, user, auth, vote
from .config import settings


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.google.com"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(post.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(vote.router)

@app.get("/")
def root():
    return {"message" : "Hello world"}