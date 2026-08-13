"""Validated requests for the single-member authentication flow."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CredentialsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SignupRequest(CredentialsRequest):
    display_name: str = Field(min_length=1, max_length=50)

    @field_validator("display_name")
    @classmethod
    def trim_display_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("display_name must not be blank")
        return value
