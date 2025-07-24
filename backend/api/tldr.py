from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.tldr_generator import tldr

router = APIRouter()


class TLDRRequest(BaseModel):
    text: str


@router.post("/tldr")
async def get_tldr_stream(payload: TLDRRequest) -> StreamingResponse:
    try:
        generator = await tldr(payload.text, stream=True)
        return StreamingResponse(generator, media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
