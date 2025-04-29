from fastapi import FastAPI, Response, status, HTTPException, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pathlib import Path

from . import models
from .database import engine, get_db
from .routers import post, user, auth, vote, chat
from .config import settings


app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(post.router)
app.include_router(user.router)
app.include_router(auth.router)
app.include_router(vote.router)
app.include_router(chat.router)

@app.get("/", response_class=HTMLResponse)
def serve_index():
    html_path = Path(r"D:\FastAPI\frontend/page.html")  
    if html_path.exists():
        return HTMLResponse(content=html_path.read_text(encoding="utf-8"))
    else:
        return HTMLResponse(content="File not found", status_code=404)
