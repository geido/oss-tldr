import logging
from typing import AsyncGenerator, Union

from openai import AsyncOpenAI
from openai.types.chat import (
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
)

from config import OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)
openai = AsyncOpenAI(api_key=OPENAI_API_KEY)

PROMPT_TLDR_SUMMARY = """
You are an expert TL;DR generator for GitHub repositories.

You will be given a list of summaries from GitHub pull requests and issues, mixed together.

Your job is to generate a single, short summary that clearly separates insights about **pull requests** and **issues**.

Your summary **must**:
- Clearly label when you're referring to pull requests vs. issues (e.g., “In pull requests, …” and “Issues focused on…”)
- Identify key areas of work (e.g., frontend, infra, documentation, bug fixes)
- Mention notable trends or themes in both PRs and issues
- Keep the total summary under **100 words**
- Be written in clear, natural language (as if for a changelog or team update)

Respond in plain text only. Do not use markdown or bullet points.
""".strip()


async def tldr(text: str, stream: bool = True) -> Union[str, AsyncGenerator[str, None]]:
    try:
        messages: list[
            ChatCompletionSystemMessageParam | ChatCompletionUserMessageParam
        ] = [
            {"role": "system", "content": PROMPT_TLDR_SUMMARY},
            {"role": "user", "content": text.strip()},
        ]

        if stream:
            completion_stream = await openai.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                stream=True,
            )

            async def generator() -> AsyncGenerator[str, None]:
                async for chunk in completion_stream:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content:
                        yield delta.content

            return generator()

        else:
            completion = await openai.chat.completions.create(
                model=OPENAI_MODEL,
                messages=messages,
                stream=False,
            )
            return completion.choices[0].message.content or ""

    except Exception:
        logger.exception("TL;DR generation failed.")
        if stream:

            async def error_stream() -> AsyncGenerator[str, None]:
                yield "⚠️ Error generating TL;DR summary"

            return error_stream()
        return "⚠️ Error generating TL;DR summary"
