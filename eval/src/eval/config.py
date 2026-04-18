from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Eval server configuration."""

    host: str = "0.0.0.0"
    port: int = 8090

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "eval_db"

    model_config = {"env_prefix": "EVAL_"}
