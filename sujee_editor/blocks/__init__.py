"""Registre des types de blocs : schéma, libellés, gabarit, validation."""

from __future__ import annotations

from .catalogue import DEFAULT_BLOCKS, get_block
from .types import Block, Field, Kind
from .validate import ValidationError, validate_data, validate_field

__all__ = [
    "Block",
    "Field",
    "Kind",
    "DEFAULT_BLOCKS",
    "get_block",
    "ValidationError",
    "validate_data",
    "validate_field",
]
