from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
import structlog

log = structlog.get_logger()


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def generic_error_handler(request: Request, exc: Exception):
        log.error("Unhandled exception", path=request.url.path, error=str(exc), exc_info=exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )
