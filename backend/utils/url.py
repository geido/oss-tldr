from urllib.parse import urlparse


def parse_repo_url(url: str) -> tuple[str, str]:
    parsed = urlparse(str(url))
    parts = parsed.path.strip("/").split("/")
    if len(parts) >= 2:
        return parts[0], parts[1]
    raise ValueError("Invalid GitHub repository URL")


def normalize_repo_reference(value: str) -> tuple[str, str]:
    value = value.strip()
    if not value:
        raise ValueError("Repository identifier cannot be empty")

    if value.startswith("http://") or value.startswith("https://"):
        return parse_repo_url(value)

    if "/" in value:
        owner, repo = value.split("/", 1)
        owner = owner.strip()
        repo = repo.strip()
        if owner and repo:
            return owner, repo

    raise ValueError(f"Invalid repository reference: {value}")
