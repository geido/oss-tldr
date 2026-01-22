export const normalizeRepoIdentifier = (input: string): string => {
  const value = input.trim();

  if (!value) {
    throw new Error("Repository identifier cannot be empty");
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      const parts = url.pathname.replace(/^\/+/, "").split("/");
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    } catch {
      throw new Error(`Invalid repository URL: ${value}`);
    }
  }

  if (value.includes("/")) {
    const [owner, repo] = value.split("/", 2);
    if (owner && repo) {
      return `${owner.trim()}/${repo.trim()}`;
    }
  }

  throw new Error(`Invalid repository reference: ${value}`);
};

export const toGitHubUrl = (identifier: string): string => {
  if (identifier.startsWith("http://") || identifier.startsWith("https://")) {
    return identifier;
  }
  return `https://github.com/${identifier}`;
};
