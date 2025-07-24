import asyncio
import json
import logging
from typing import Sequence

from openai import AsyncOpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL
from models.github import GitHubItem

logger = logging.getLogger(__name__)

openai = AsyncOpenAI(api_key=OPENAI_API_KEY)

PROMPT_ISSUE_SUMMARY = """
You are an expert TL;DR generator that can summarize GitHub issues and PRs.

Include the following details in your summary:
- Key points, decisions, and any important context.
- Any action items or next steps.

Keep it short and engaging, ideally under 50 words.
Respond in plain text only.
""".strip()


async def fetch_and_summarize_item(item: GitHubItem) -> GitHubItem:
    context = {
        "title": item.title,
        "body": item.body or "",
    }
    try:
        response = await openai.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": PROMPT_ISSUE_SUMMARY},
                {"role": "user", "content": json.dumps(context)},
            ],
        )
        summary = response.choices[0].message.content or ""
    except Exception:
        logger.exception("Failed to summarize item: %s", item.title)
        summary = ""

    return item.model_copy(update={"summary": summary})


async def summarize_items(items: Sequence[GitHubItem]) -> list[GitHubItem]:
    tasks = [fetch_and_summarize_item(item) for item in items]
    return await asyncio.gather(*tasks)
