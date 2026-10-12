"""FastAPI application main entrypoint."""

import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from folio_ml.api.routes_explain import router as explain_router
from folio_ml.api.routes_guardrails import router as guardrails_router
from folio_ml.api.routes_health import router as health_router
from folio_ml.api.routes_invoices import router as invoices_router
from folio_ml.api.routes_metrics import router as metrics_router
from folio_ml.api.routes_recon import router as recon_router
from folio_ml.api.routes_review import router as review_router
from folio_ml.api.routes_signals import router as signals_router
from folio_ml.api.routes_vendors import router as vendors_router
from folio_ml.config import settings
from folio_ml.logging import logger


def create_app() -> FastAPI:
    app = FastAPI(
        title="Folio ML Engine",
        description="Machine learning and deterministic rule validation engine for GST invoices.",
        version="0.1.0",
        docs_url="/docs",
        openapi_url="/openapi.json",
    )

    # CORS configuration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.folio_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request-ID and Logging Middleware
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next: Any) -> Any:
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        return response

    # Global Exception Handlers ensuring consistent {code, message, request_id}
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.warning(f"HTTP {exc.status_code} on {request.url.path}: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "request_id": req_id,
            },
            headers={"X-Request-ID": req_id},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        req_id = getattr(request.state, "request_id", str(uuid.uuid4()))
        logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred processing the request.",
                "request_id": req_id,
            },
            headers={"X-Request-ID": req_id},
        )

    # Mount v1 routers
    v1_routers = [
        health_router,
        invoices_router,
        review_router,
        recon_router,
        vendors_router,
        explain_router,
        guardrails_router,
        metrics_router,
        signals_router,
    ]

    for router in v1_routers:
        app.include_router(router, prefix="/v1")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "folio_ml.api.main:app",
        host=settings.folio_api_host,
        port=settings.folio_api_port,
        reload=True,
    )
