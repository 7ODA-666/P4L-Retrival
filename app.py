from __future__ import annotations

import re
from typing import Any

from flask import Flask, jsonify, render_template, request

try:
    import contractions
except ImportError:  # pragma: no cover - handled gracefully at runtime
    contractions = None

import nltk
from nltk.corpus import stopwords as nltk_stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk.tokenize import RegexpTokenizer


app = Flask(__name__)

TOKENIZER = RegexpTokenizer(r"\w+")
STEMMER = PorterStemmer()
LEMMATIZER = WordNetLemmatizer()
FALLBACK_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
    "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were", "will",
    "with", "this", "these", "those", "they", "their", "you", "your", "we", "our",
    "or", "not", "have", "had", "but", "if", "than", "then", "there", "here", "about",
}


def _ensure_nltk_resource(resource: str, path: str) -> None:
    try:
        nltk.data.find(path)
    except LookupError:
        try:
            nltk.download(resource, quiet=True)
        except Exception:
            # Offline environments can still use the built-in fallbacks.
            pass


_ensure_nltk_resource("stopwords", "corpora/stopwords")
_ensure_nltk_resource("wordnet", "corpora/wordnet")
_ensure_nltk_resource("omw-1.4", "corpora/omw-1.4")


def _load_stopwords() -> set[str]:
    try:
        return set(nltk_stopwords.words("english"))
    except LookupError:
        return set(FALLBACK_STOPWORDS)


STOP_WORDS = _load_stopwords()


def _page_context(active_page: str) -> dict[str, Any]:
    return {"active_page": active_page}


def _preview_value(value: Any, max_items: int = 18) -> str:
    if isinstance(value, list):
        items = [str(item) for item in value[:max_items]]
        preview = ", ".join(items)
        if len(value) > max_items:
            preview += ", …"
        return f"[{preview}]"
    if value is None:
        return ""
    return str(value)


def _expand_contractions(text: str) -> str:
    if contractions is not None and hasattr(contractions, "fix"):
        try:
            return contractions.fix(text)
        except Exception:
            pass
    return text


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _normalize_text(text: str, selected: dict[str, bool]) -> tuple[str, list[dict[str, Any]]]:
    current = text
    stages: list[dict[str, Any]] = []

    if selected.get("case_folding"):
        before = current
        current = current.lower()
        stages.append(
            {
                "key": "case_folding",
                "title": "Case Folding",
                "icon": "fa-font",
                "before": before,
                "after": current,
            }
        )

    if selected.get("expanding_contractions"):
        before = current
        current = _expand_contractions(current)
        stages.append(
            {
                "key": "expanding_contractions",
                "title": "Expanding Contractions",
                "icon": "fa-quote-right",
                "before": before,
                "after": current,
            }
        )

    if selected.get("removing_special_characters"):
        before = current
        current = re.sub(r"[^A-Za-z0-9\s]", " ", current)
        current = _collapse_whitespace(current)
        stages.append(
            {
                "key": "removing_special_characters",
                "title": "Removing Special Characters",
                "icon": "fa-wand-magic-sparkles",
                "before": before,
                "after": current,
            }
        )

    return current, stages


def _lemmatize_token(token: str) -> str:
    try:
        return LEMMATIZER.lemmatize(token)
    except LookupError:
        suffix_rules = (
            ("ies", "y"),
            ("ing", ""),
            ("ed", ""),
            ("es", ""),
            ("s", ""),
        )
        for suffix, replacement in suffix_rules:
            if len(token) > len(suffix) + 2 and token.endswith(suffix):
                return token[: -len(suffix)] + replacement
        return token


def _tokenize_text(text: str) -> list[str]:
    return TOKENIZER.tokenize(text)


def _remove_stop_words(tokens: list[str]) -> list[str]:
    return [token for token in tokens if token.lower() not in STOP_WORDS]


def _stem_tokens(tokens: list[str]) -> list[str]:
    return [STEMMER.stem(token.lower()) for token in tokens]


def _lemmatize_tokens(tokens: list[str]) -> list[str]:
    return [_lemmatize_token(token.lower()) for token in tokens]


def _stage_payload(key: str, title: str, icon: str, before: Any, after: Any, *, implicit: bool = False, note: str | None = None) -> dict[str, Any]:
    return {
        "key": key,
        "title": title,
        "icon": icon,
        "implicit": implicit,
        "note": note,
        "before": before,
        "after": after,
        "before_display": _preview_value(before),
        "after_display": _preview_value(after),
    }


def _normalize_operations(payload: dict[str, Any]) -> dict[str, Any]:
    operations = payload.get("operations")
    if isinstance(operations, dict):
        normalization = operations.get("normalization", {})
        return {
            "tokenization": bool(operations.get("tokenization", False)),
            "remove_stop_words": bool(operations.get("remove_stop_words", False)),
            "normalization": {
                "enabled": bool(normalization.get("enabled", normalization.get("checked", False) or any(normalization.values()))),
                "case_folding": bool(normalization.get("case_folding", False)),
                "removing_special_characters": bool(normalization.get("removing_special_characters", False)),
                "expanding_contractions": bool(normalization.get("expanding_contractions", False)),
            },
            "stemming": bool(operations.get("stemming", False)),
            "lemmatization": bool(operations.get("lemmatization", False)),
        }

    if isinstance(operations, list):
        items = {str(item) for item in operations}
        return {
            "tokenization": "tokenization" in items,
            "remove_stop_words": "remove_stop_words" in items,
            "normalization": {
                "enabled": "normalization" in items,
                "case_folding": "case_folding" in items,
                "removing_special_characters": "removing_special_characters" in items,
                "expanding_contractions": "expanding_contractions" in items,
            },
            "stemming": "stemming" in items,
            "lemmatization": "lemmatization" in items,
        }

    return {
        "tokenization": True,
        "remove_stop_words": True,
        "normalization": {
            "enabled": True,
            "case_folding": True,
            "removing_special_characters": True,
            "expanding_contractions": True,
        },
        "stemming": True,
        "lemmatization": True,
    }


@app.route("/")
def home() -> str:
    return render_template("index.html", **_page_context("home"))


@app.route("/preprocessing")
def preprocessing_page() -> str:
    return render_template("preprocessing/visualization.html", **_page_context("preprocessing"))


@app.route("/preprocessing/about")
def preprocessing_about_page() -> str:
    return render_template("preprocessing/about.html", **_page_context("preprocessing"))


@app.route("/spelling")
def spelling_page() -> str:
    return render_template("spelling/visualization.html", **_page_context("spelling"))


@app.route("/spelling/about")
def spelling_about_page() -> str:
    return render_template("spelling/about.html", **_page_context("spelling"))


@app.route("/retrieval")
def retrieval_page() -> str:
    return render_template("retrieval/index.html", **_page_context("retrieval"))


@app.route("/api/preprocess", methods=["POST"])
def api_preprocess():
    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")

    if not isinstance(text, str):
        return jsonify({"error": "Text must be provided as a string."}), 400

    text = text.strip()
    if not text:
        return jsonify({"error": "Please provide text to preprocess."}), 400

    operations = _normalize_operations(payload)
    stages: list[dict[str, Any]] = [_stage_payload("original", "Original Text", "fa-file-lines", text, text)]

    current_text = text
    token_stream: list[str] | None = None
    tokenization_selected = operations["tokenization"]
    token_based_enabled = tokenization_selected or operations["remove_stop_words"] or operations["stemming"] or operations["lemmatization"]

    if operations["normalization"]["enabled"]:
        normalized_text, normalization_stages = _normalize_text(current_text, operations["normalization"])
        stages.append(
            _stage_payload(
                "normalization",
                "Normalization",
                "fa-wand-magic-sparkles",
                current_text,
                normalized_text,
                note="Case folding, contraction expansion, and special-character cleanup."
            )
        )
        current_text = normalized_text
        if normalization_stages:
            stages[-1]["substeps"] = normalization_stages

    if token_based_enabled:
        token_stream = _tokenize_text(current_text)
        stages.append(
            _stage_payload(
                "tokenization",
                "Tokenization",
                "fa-code-branch",
                current_text,
                token_stream,
                implicit=not tokenization_selected,
                note="Text is split into lexical units for downstream processing."
            )
        )
        current_tokens = token_stream
    else:
        current_tokens = []

    if operations["remove_stop_words"]:
        before_tokens = list(current_tokens)
        after_tokens = _remove_stop_words(before_tokens)
        stages.append(
            _stage_payload(
                "remove_stop_words",
                "Stop Word Removal",
                "fa-filter-circle-xmark",
                before_tokens,
                after_tokens,
                note="Low-value function words are removed from the token stream."
            )
        )
        current_tokens = after_tokens

    if operations["stemming"]:
        before_tokens = list(current_tokens)
        after_tokens = _stem_tokens(before_tokens)
        stages.append(
            _stage_payload(
                "stemming",
                "Stemming",
                "fa-scissors",
                before_tokens,
                after_tokens,
                note="Words are reduced to compact stem forms."
            )
        )
        current_tokens = after_tokens

    if operations["lemmatization"]:
        before_tokens = list(current_tokens)
        after_tokens = _lemmatize_tokens(before_tokens)
        stages.append(
            _stage_payload(
                "lemmatization",
                "Lemmatization",
                "fa-spell-check",
                before_tokens,
                after_tokens,
                note="Words are mapped to dictionary-friendly forms."
            )
        )
        current_tokens = after_tokens

    final_output: Any
    if current_tokens:
        final_output = current_tokens
    else:
        final_output = current_text

    stages.append(
        _stage_payload(
            "final_output",
            "Final Output",
            "fa-bolt",
            current_tokens if current_tokens else current_text,
            final_output,
            note="The cleaned representation is ready for indexing or analysis."
        )
    )

    return jsonify(
        {
            "input_text": text,
            "selected_operations": operations,
            "steps": stages,
            "final_output": final_output,
            "final_output_display": _preview_value(final_output),
            "summary": {
                "steps_executed": max(0, len(stages) - 2),
                "token_count": len(final_output) if isinstance(final_output, list) else len(_tokenize_text(final_output)),
            },
        }
    )


@app.route("/api/spelling/edit_distance", methods=["POST"])
def api_edit_distance():
    payload = request.get_json(silent=True) or {}
    word1 = str(payload.get("word1", "")).strip().lower()
    word2 = str(payload.get("word2", "")).strip().lower()

    if not word1 or not word2:
        return jsonify({"error": "Please provide both words."}), 400
        
    m, n = len(word1), len(word2)
    matrix = [[0] * (n + 1) for _ in range(m + 1)]
    
    # Initialize first column
    for i in range(m + 1):
        matrix[i][0] = i
        
    # Initialize first row
    for j in range(n + 1):
        matrix[0][j] = j
        
    steps = []
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            chars_match = word1[i - 1] == word2[j - 1]
            sub_cost = 0 if chars_match else 1
            
            sub_val = matrix[i - 1][j - 1] + sub_cost
            del_val = matrix[i - 1][j] + 1
            ins_val = matrix[i][j - 1] + 1
            
            min_val = min(sub_val, del_val, ins_val)
            matrix[i][j] = min_val
            
            steps.append({
                "i": i,
                "j": j,
                "char1": word1[i - 1],
                "char2": word2[j - 1],
                "chars_match": chars_match,
                "sub_val": sub_val,
                "del_val": del_val,
                "ins_val": ins_val,
                "min_val": min_val
            })
            
    return jsonify({
        "word1": word1,
        "word2": word2,
        "matrix": matrix,
        "steps": steps,
        "final_distance": matrix[m][n]
    })


@app.route("/healthz")
def healthz():
    return {"status": "ok", "app": "P4L Retrieval"}


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)

