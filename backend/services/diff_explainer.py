from openai import AsyncOpenAI

from config import OPENAI_API_KEY, OPENAI_MODEL

openai = AsyncOpenAI(api_key=OPENAI_API_KEY)

DIFF_EXPLAINER_PROMPT = """
You are an expert GitHub diff explainer. Your task is to analyze the diff of a file from a pull request and generate a clear, concise summary of the most meaningful changes.

Ignore trivial changes (e.g. formatting, comments).

Focus on:
- Key areas of focus and components affected.
- Rationale behind the changes and their impact.
- Any potential implications or follow-ups.

Keep the explanation under 50 words.
Respond with plain text only.
"""


async def explain_diff(file: str, diff: str) -> str:
    """
    Summarize the most meaningful and impactful changes made to a given file, based on its diff.
    """
    try:
        response = await openai.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": DIFF_EXPLAINER_PROMPT.strip()},
                {"role": "user", "content": f"File: {file}\n\nDiff:\n{diff.strip()}"},
            ],
        )
        return response.choices[0].message.content or ""
    except Exception:
        return ""
