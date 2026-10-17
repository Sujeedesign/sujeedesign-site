"""Registre des types de blocs : schéma, libellés, gabarit, validation."""

from __future__ import annotations

from .catalogue import DEFAULT_BLOCKS, get_block
from .types import Block, Field, Kind, default_data
from .validate import ValidationError, validate_data, validate_field

__all__ = [
    "Block",
    "Field",
    "Kind",
    "DEFAULT_BLOCKS",
    "get_block",
    "default_data",
    "ValidationError",
    "validate_data",
    "validate_field",
]
