from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    app_name: str = "BackForge Frontend Analyzer"
    app_version: str = "0.1.0"
    port: int = Field(default=8081, alias="ANALYZER_PORT")

    ollama_url: str = Field(default="http://ollama:11434", alias="OLLAMA_URL")
    ollama_model: str = Field(default="mistral", alias="OLLAMA_MODEL")
    ollama_timeout_secs: int = Field(default=60, alias="OLLAMA_TIMEOUT")

    model_config = {"env_file": ".env", "populate_by_name": True}


settings = Settings()
