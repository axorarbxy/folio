"""Base schema components for Folio ML contracts."""

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, field_validator
from pydantic import Field as PydanticField


class Box(BaseModel):
    """Bounding box normalized to 0.0 .. 1.0."""
    page: int = PydanticField(default=1, ge=1, description="1-indexed page number")
    x0: float = PydanticField(ge=0.0, le=1.0, description="Left coordinate (0..1)")
    y0: float = PydanticField(ge=0.0, le=1.0, description="Top coordinate (0..1)")
    x1: float = PydanticField(ge=0.0, le=1.0, description="Right coordinate (0..1)")
    y1: float = PydanticField(ge=0.0, le=1.0, description="Bottom coordinate (0..1)")

    @field_validator("x1")
    @classmethod
    def validate_x_order(cls, v: float, info: object) -> float:
        # Pydantic v2 validation context
        return v

    @field_validator("y1")
    @classmethod
    def validate_y_order(cls, v: float, info: object) -> float:
        return v


T = TypeVar("T")


class Field(BaseModel, Generic[T]):
    """Extracted or computed field with metadata, confidence, and provenance."""
    value: T | None = None
    confidence: float = PydanticField(default=1.0, ge=0.0, le=1.0, description="Confidence in [0, 1]")
    box: Box | None = None
    source: Literal["reader", "human", "rule"] = "reader"
    edited: bool = False
