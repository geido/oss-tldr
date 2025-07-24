import json
from typing import AsyncGenerator, Optional

from github.IssueComment import IssueComment
from github.PaginatedList import PaginatedList
from github.PullRequestReview import PullRequestReview
from openai import AsyncOpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL

openai = AsyncOpenAI(api_key=OPENAI_API_KEY)

PROMPT_ISSUE_DEEPDIVE = """
You are an expert GitHub analyst.

Generate a deep dive markdown summary for a GitHub issue or pull request based on the provided metadata.

Only include sections that have relevant content based on the input. Use the following structure in this exact order, omitting any section that is not applicable:

### 📝 Summary

A concise overview of the issue or PR, including its purpose and context.

### 🧪 Reviews

Include only if review comments are present. Summarize notable approvals or suggestions.

### 💬 Comments

Include only if discussion comments are provided. Highlight the most insightful participant discussions.

### ✅ Action Items / Next Steps

Include only if there are clear resolutions or follow-ups.

Respond using Markdown only. Avoid horizontal lines, dividers, or unrelated commentary.
"""


async def generate_deep_dive(
    title: str,
    body: str,
    reviews: Optional[list[PullRequestReview]] = None,
    comments: Optional[PaginatedList[IssueComment]] = None,
) -> AsyncGenerator[str, None]:
    """Generate a deep dive markdown summary for a GitHub issue or PR using OpenAI streaming."""

    context = {
        "title": title,
        "body": body or "",
        "reviews": [
            {
                "body": getattr(review, "body", review),
                "author": getattr(getattr(review, "user", None), "login", "Unknown"),
            }
            for review in (reviews or [])
        ],
        "comments": [
            {
                "body": getattr(comment, "body", comment),
                "author": getattr(getattr(comment, "user", None), "login", "Unknown"),
            }
            for comment in (comments or [])
        ],
    }

    try:
        stream = await openai.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": PROMPT_ISSUE_DEEPDIVE.strip()},
                {"role": "user", "content": json.dumps(context)},
            ],
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta
            content = getattr(delta, "content", None)
            if content:
                yield content

    except Exception as e:
        yield f"\n⚠️ Error generating summary: {str(e)}"
