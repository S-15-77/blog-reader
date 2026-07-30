from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    firecrawl_api_key: str = ""
    ollama_model: str = "qwen2.5:3b-instruct"
    ollama_host: str = "http://localhost:11434"
    database_url: str = "sqlite:///./podcast_agent.db"
    audio_dir: str = "audio_generations"
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
