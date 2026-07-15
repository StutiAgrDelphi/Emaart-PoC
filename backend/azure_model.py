import os
from agno.models.azure import AzureOpenAI


def build_azure_model() -> AzureOpenAI:
    """Build the Azure OpenAI model client, shared by chat_agent.py and
    insights_agent.py so both hit the same deployment/credentials."""
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21")

    missing = [
        name
        for name, val in [
            ("AZURE_OPENAI_DEPLOYMENT", deployment),
            ("AZURE_OPENAI_API_KEY", api_key),
            ("AZURE_OPENAI_ENDPOINT", azure_endpoint),
        ]
        if not val
    ]
    if missing:
        raise RuntimeError(
            "Missing required Azure OpenAI environment variable(s): " + ", ".join(missing)
        )

    return AzureOpenAI(
        id=deployment,
        azure_deployment=deployment,
        api_key=api_key,
        azure_endpoint=azure_endpoint,
        api_version=api_version,
    )