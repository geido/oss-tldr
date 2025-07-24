from urllib.parse import urlparse


def parse_repo_url(url: str) -> tuple[str, str]:
    parsed = urlparse(str(url))
    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 2:
        return parts[0], parts[1]
    raise ValueError("Invalid GitHub repository URL")
