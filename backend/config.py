import os
from pydantic_settings import BaseSettings

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_default_db_url = f"sqlite+aiosqlite:///{os.path.join(_project_root, 'naptrap.db')}"


class Settings(BaseSettings):
    DATABASE_URL: str = _default_db_url
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    JAVA_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DEMO_RR_FILE: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "000.txt"
    )

    class Config:
        env_file = ".env"


settings = Settings()
