from lightrag.utils import Tokenizer


class _CharTokenizer:
    """
    A simple UTF-8 byte tokenizer.
    LightRAG only uses tokenization for chunk-size estimation,
    so a char-level tokenizer is perfectly adequate.
    This avoids tiktoken downloading vocabulary files from OpenAI CDN.
    """

    def encode(self, text: str) -> list[int]:
        return list(text.encode("utf-8"))

    def decode(self, tokens: list[int]) -> str:
        return bytes(tokens).decode("utf-8", errors="replace")


def make_tokenizer() -> Tokenizer:
    return Tokenizer(model_name="char-utf8", tokenizer=_CharTokenizer())
