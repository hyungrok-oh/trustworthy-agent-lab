from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Agent server configuration.

    All settings can be overridden via environment variables
    with the AGENT_ prefix. Example: AGENT_LLM_BASE_URL=http://...
    """

    # Server
    host: str = "0.0.0.0"
    port: int = 8081

    # LLM Server (llm-serving vllm-mlx)
    llm_base_url: str = "http://localhost:8000"
    llm_model: str = "mlx-community/gemma-4-26B-A4B-it-4bit"
    llm_temperature: float = 0.0
    llm_timeout_seconds: int = 60

    # Eval Server (trace push destination)
    eval_base_url: str = "http://localhost:8090"
    eval_enabled: bool = True

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "agent_db"

    # Trace emitter type: "http" | "file" | "noop"
    trace_emitter: str = "http"
    trace_file_path: str = "./traces"

    model_config = {"env_prefix": "AGENT_"}
