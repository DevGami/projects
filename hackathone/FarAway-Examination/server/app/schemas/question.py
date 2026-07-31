"""Pydantic schemas for Question API request/response validation."""

from typing import Any

from pydantic import BaseModel, field_validator


class OptionsDict(BaseModel):
    """Options as A/B/C/D dict — matches frontend QuestionCreateRequest."""
    A: str
    B: str
    C: str
    D: str


class QuestionCreate(BaseModel):
    """
    Request body for creating/updating a question.

    Frontend sends:
        options: { A: str, B: str, C: str, D: str }
        correct_option: "A" | "B" | "C" | "D"

    Internally converted to list form for QuestionService.create().
    """
    subject: str
    difficulty: str                 # easy | medium | hard
    content: str                    # Plaintext — encrypted before storage
    options: OptionsDict            # { A, B, C, D }
    correct_option: str             # "A" | "B" | "C" | "D"

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, v: str) -> str:
        if v not in ("A", "B", "C", "D"):
            raise ValueError("correct_option must be A, B, C, or D")
        return v

    def options_as_list(self) -> list[str]:
        """Convert {A,B,C,D} dict to ordered list for QuestionService."""
        return [self.options.A, self.options.B, self.options.C, self.options.D]

    def correct_option_as_int(self) -> int:
        """Convert letter to 0-indexed int: A→0, B→1, C→2, D→3."""
        return ord(self.correct_option) - ord("A")


class QuestionMeta(BaseModel):
    """Question metadata returned by list endpoint — no encrypted content."""
    id: str
    subject: str
    difficulty: str
    is_encrypted: bool = True       # Always encrypted in FortisExam
    created_at: str
    updated_at: str = ""
    content_hash: str = ""
    created_by: str = ""

    model_config = {"from_attributes": True}


class QuestionListResponse(BaseModel):
    """Paginated list response — matches frontend QuestionListResponse interface."""
    items: list[QuestionMeta]
    total: int
    page: int = 1
    page_size: int = 20


class QuestionResponse(BaseModel):
    """Full question with decrypted content — returned by get_question."""
    id: str
    subject: str
    difficulty: str
    content: str
    options: dict[str, str]         # { A, B, C, D }
    correct_option: str             # "A" | "B" | "C" | "D"
    content_hash: str
    created_by: str
    is_encrypted: bool = True
    created_at: str = ""
    updated_at: str = ""

    model_config = {"from_attributes": True}
