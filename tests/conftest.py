import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_podcast_agent.db")
os.environ.setdefault("FIRECRAWL_API_KEY", "test-firecrawl-key")
os.environ.setdefault("ELEVEN_LABS_API_KEY", "test-elevenlabs-key")

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)
