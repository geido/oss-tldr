import os

from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
MAX_ITEMS_PER_SECTION = int(os.getenv("MAX_ITEMS_PER_SECTION", 10))
COMMON_GITHUB_BOTS = {
    # Dependency / update bots
    "dependabot[bot]",
    "renovate[bot]",
    "pyup-bot",
    "snyk-bot",
    "greenkeeper[bot]",
    # GitHub & general infra
    "github-actions[bot]",
    "github-learning-lab[bot]",
    "backport[bot]",
    "stale[bot]",
    "labeler[bot]",
    "release-drafter[bot]",
    # CI/CD tools
    "travis-ci[bot]",
    "circleci[bot]",
    "netlify[bot]",
    "vercel[bot]",
    "heroku[bot]",
    "jenkins[bot]",
    "drone-io[bot]",
    "bitrise[bot]",
    # Lint/coverage/quality
    "eslint[bot]",
    "stylelint[bot]",
    "prettier[bot]",
    "lgtm-com[bot]",
    "codecov[bot]",
    "coveralls[bot]",
    "tox-bot",
    # Reviewer/comment bots
    "reviewdog[bot]",
    "danger[bot]",
    "reviewflow[bot]",
    "pullapprove[bot]",
    "lintly[bot]",
    "mergeable[bot]",
    "code-review-bot",
    "probot[bot]",
    "allcontributors[bot]",
    # Content/translations
    "crowdin[bot]",
    "readthedocs[bot]",
    "gitter-badger[bot]",
    "imgbot[bot]",
    # AI / LLM-based bots
    "korbit-ai",
    "dosu",
    "codiumai" "gpt-engineer-bot",
    "sweep",
    "aiderbot",
    "refact-ai",
    "openai-bot",
    "anthropic-bot",
    "nabla",
}
