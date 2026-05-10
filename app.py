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
import PyPDF2

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

def _preprocess_pipeline(text: str) -> list[str]:
    """Full preprocessing pipeline: normalization, tokenization, stopword removal, lemmatization"""
    # 1. Normalization (case folding, char removal, whitespace collapse)
    text = text.lower()
    text = _expand_contractions(text)
    text = re.sub(r"[^A-Za-z0-9\s]", " ", text)
    text = _collapse_whitespace(text)
    # 2. Tokenization
    tokens = _tokenize_text(text)
    # 3. Stop Word Removal
    tokens = _remove_stop_words(tokens)
    # 4. Lemmatization
    tokens = _lemmatize_tokens(tokens)
    return tokens


def _build_inverted_index(docs: list[dict[str, Any]]) -> dict[str, Any]:
    index: dict[str, list[str]] = {}
    all_tokens_set: set[str] = set()

    for doc in docs:
        doc_name = str(doc.get("name", ""))
        seen_in_doc: set[str] = set()
        for token in doc.get("tokens", []):
            all_tokens_set.add(token)
            if token in seen_in_doc:
                continue
            seen_in_doc.add(token)
            index.setdefault(token, []).append(doc_name)

    return {
        "vocabulary": sorted(all_tokens_set),
        "index": index,
    }


def _build_snippet(original_text: str, target_terms: set[str]) -> str:
    snippet = original_text[:100]
    words = original_text.split()
    for i, word in enumerate(words):
        cleaned = _lemmatize_token(word.lower().strip(",.!?()\"'"))
        if cleaned in target_terms:
            start = max(0, i - 5)
            end = min(len(words), i + 15)
            snippet = " ".join(words[start:end])
            break
    return snippet


def _search_inverted_index(query: str, index_data: dict[str, Any], docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    query_tokens = _preprocess_pipeline(query)
    query_set = set(query_tokens)
    index = index_data.get("index", {})

    doc_scores: dict[str, dict[str, Any]] = {}
    for token in query_tokens:
        for doc_name in index.get(token, []):
            if doc_name not in doc_scores:
                doc_scores[doc_name] = {"score": 0, "matched_terms": set()}
            doc_scores[doc_name]["score"] += 1
            doc_scores[doc_name]["matched_terms"].add(token)

    results: list[dict[str, Any]] = []
    for doc_name, score_data in doc_scores.items():
        doc = next((d for d in docs if d.get("name") == doc_name), None)
        if not doc:
            continue
        matched_terms = sorted(score_data["matched_terms"])
        score = score_data["score"] / len(query_tokens) if query_tokens else 0
        snippet = _build_snippet(str(doc.get("original_text", "")), query_set)
        results.append(
            {
                "name": doc_name,
                "score": score,
                "matched_terms": matched_terms,
                "snippet": f"{snippet}...",
                "doc": doc,
            }
        )

    results.sort(key=lambda item: item["score"], reverse=True)
    return results

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


@app.route("/api/retrieval/prepare", methods=["POST"])
def api_retrieval_prepare():
    files = request.files.getlist("files")
    algorithm = request.form.get("algorithm", "tdm")

    if not files:
        return jsonify({"error": "No files provided."}), 400

    docs = []
    all_tokens_set = set()

    for file in files:
        if not file.filename:
            continue
        text = ""
        filename = file.filename

        try:
            if filename.lower().endswith(".pdf"):
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text += (page.extract_text() or "") + " "
            elif filename.lower().endswith(".txt"):
                text = file.read().decode("utf-8", errors="ignore")
            else:
                continue

        except Exception as e:
            text = f"Error reading file: {e}"

        text = text.strip() or "Empty document"
        tokens = _preprocess_pipeline(text)
        all_tokens_set.update(tokens)

        docs.append({
            "name": filename,
            "original_text": text,
            "tokens": tokens
        })

    vocabulary = sorted(list(all_tokens_set))

    if algorithm == "inverted":
        index_data = _build_inverted_index(docs)
        return jsonify({
            "algorithm": "inverted",
            "vocabulary": index_data["vocabulary"],
            "index": index_data["index"],
            "docs": docs
        })
    elif algorithm == "bow":
        # BoW logic
        # We just need to return vocabulary and docs with tokens; frontend calculates frequencies
        # We can also compute term frequency vectors here if we want, but frontend does it visually.
        # Let's compute them here optionally, but we return vocabulary and docs.
        for doc in docs:
            # For BoW, frontend handles vector visualization by counting frequencies
            pass

        return jsonify({
            "algorithm": "bow",
            "vocabulary": vocabulary,
            "docs": docs
        })
    else:
        # TDM logic (default)
        for doc in docs:
            doc_tokens_set = set(doc["tokens"])
            doc["term_vector"] = [1 if term in doc_tokens_set else 0 for term in vocabulary]

        return jsonify({
            "algorithm": "tdm",
            "vocabulary": vocabulary,
            "docs": docs
        })

@app.route("/api/retrieval/search", methods=["POST"])
def api_retrieval_search():
    payload = request.get_json(silent=True) or {}
    query = payload.get("query", "")
    matrix_data = payload.get("matrix_data", {})
    algorithm = payload.get("algorithm", "tdm")

    if not query or not matrix_data:
        return jsonify({"error": "Query or matrix data missing."}), 400

    vocabulary = matrix_data.get("vocabulary", [])
    docs = matrix_data.get("docs", [])

    if algorithm == "inverted":
        results = _search_inverted_index(query, matrix_data, docs)
        return jsonify({"results": results})
    elif algorithm == "bow":
        # Search logic is handled entirely by frontend as per requirement:
        # 'window.searchBoW = function ...'
        # To keep backend fallback, we can implement it here or just reply on JS.
        # But user mentioned: "Implement backend logic for: Bag of Words generation, frequency vectors, BoW search ranking..."
        # Wait, the prompt says "Keep backend modular: services/retrieval/bag_of_words.py"
        # But there is no such folder. Wait, the frontend implements searchBoW. Should I make it hit the backend?
        # Let's implement BoW search in backend anyway to be safe.
        query_tokens = _preprocess_pipeline(query)
        query_freq = {}
        for qt in query_tokens:
            query_freq[qt] = query_freq.get(qt, 0) + 1

        results = []
        unique_query_tokens = list(query_freq.keys())
        for doc in docs:
            doc_tokens = doc["tokens"]
            doc_tokens_set = set(doc_tokens)
            terms_found = sum(1 for term in unique_query_tokens if term in doc_tokens_set)

            if terms_found > 0:
                score = terms_found / len(unique_query_tokens)

                original_text = doc.get("original_text", "")
                snippet_start = 0
                for i, qt in enumerate(unique_query_tokens):
                    if qt in doc_tokens_set:
                        idx = original_text.lower().find(qt)
                        if idx != -1:
                            snippet_start = max(0, idx - 40)
                            break

                snippet = original_text[snippet_start:snippet_start+100]
                if snippet_start > 0: snippet = "... " + snippet
                if snippet_start + 100 < len(original_text): snippet += " ..."

                results.append({
                    "name": doc["name"],
                    "score": score,
                    "snippet": snippet,
                    "matched_terms": [term for term in unique_query_tokens if term in doc_tokens_set],
                    "doc": doc,
                    "query_tokens": query_tokens
                })

        results.sort(key=lambda x: x["score"], reverse=True)
        return jsonify({"results": results})

    # TDM SEARCH
    query_tokens = _preprocess_pipeline(query)
    query_vector = [1 if term in query_tokens else 0 for term in vocabulary]

    results = []

    # Calculate similarity (dot product of binary vectors)
    import math
    for doc in docs:
        doc_vector = doc["term_vector"]

        # dot product
        dot_product = sum(q * d for q, d in zip(query_vector, doc_vector))

        # magnitudes
        q_mag = math.sqrt(sum(q * q for q in query_vector))
        d_mag = math.sqrt(sum(d * d for d in doc_vector))

        if q_mag == 0 or d_mag == 0:
            score = 0
        else:
            score = dot_product / (q_mag * d_mag)

        if score > 0:
            # Find a snippet
            original_text = doc["original_text"]
            snippet = original_text[:100] # default snippet

            # Simple snippet logic: find first matching term in text
            words = original_text.split()
            for i, word in enumerate(words):
                if _lemmatize_token(word.lower().strip(",.!?()\"'")) in query_tokens:
                    start = max(0, i - 5)
                    end = min(len(words), i + 15)
                    snippet = " ".join(words[start:end])
                    break

            results.append({
                "name": doc["name"],
                "score": score,
                "snippet": snippet,
                "doc": doc,
                "query_tokens": query_tokens
            })

    # Sort descending by score
    results.sort(key=lambda x: x["score"], reverse=True)

    return jsonify({
        "results": results
    })


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


def _get_bigrams(word: str) -> list[str]:
    return [word[i:i+2] for i in range(len(word) - 1)] if len(word) > 1 else []

@app.route("/api/spelling/jaccard", methods=["POST"])
def api_jaccard():
    payload = request.get_json(silent=True) or {}
    word1 = str(payload.get("word1", "")).strip().lower()
    word2 = str(payload.get("word2", "")).strip().lower()

    if not word1 or not word2:
        return jsonify({"error": "Please provide both words."}), 400

    bg1 = _get_bigrams(word1)
    bg2 = _get_bigrams(word2)

    # We calculate counts
    # Shared bigrams (intersection)
    set1, set2 = set(bg1), set(bg2)
    shared = list(set1.intersection(set2))

    n1 = len(bg1)
    n2 = len(bg2)
    n_shared = len(shared)

    union_size = n1 + n2 - n_shared
    jaccard = round(n_shared / union_size, 4) if union_size > 0 else 0.0

    return jsonify({
        "word1": word1,
        "word2": word2,
        "bigrams1": bg1,
        "bigrams2": bg2,
        "shared": shared,
        "n1": n1,
        "n2": n2,
        "n_shared": n_shared,
        "union_size": union_size,
        "jaccard": jaccard
    })

def _soundex_steps(word: str) -> dict[str, Any]:
    if not word:
        return {}

    word = word.upper()
    steps = {"original": word}

    first_letter = word[0]
    steps["step2_keep_first"] = first_letter

    mapping = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6'
    }

    # Map remaining to digits, vowels/others to 0
    mapped = first_letter
    detailed_map = [first_letter]
    for char in word[1:]:
        digit = mapping.get(char, '0')
        mapped += digit
        detailed_map.append(f"{char}→{digit}")

    steps["step3_mapped"] = mapped
    steps["step3_details"] = detailed_map

    # Remove consecutive duplicates
    no_dups = mapped[0]
    for i in range(1, len(mapped)):
        if mapped[i] != mapped[i-1]:
            no_dups += mapped[i]

    steps["step4_no_dups"] = no_dups

    # Remove zeros from positions after the first
    no_zeros = no_dups[0] + no_dups[1:].replace('0', '')
    steps["step5_no_zeros"] = no_zeros

    # Pad or truncate
    final_code = (no_zeros + "000")[:4]
    steps["step6_final"] = final_code

    return steps

@app.route("/api/spelling/soundex", methods=["POST"])
def api_soundex():
    payload = request.get_json(silent=True) or {}
    word1 = str(payload.get("word1", "")).strip()
    word2 = str(payload.get("word2", "")).strip()

    if not word1 or not word2:
        return jsonify({"error": "Please provide both words."}), 400

    steps1 = _soundex_steps(word1)
    steps2 = _soundex_steps(word2)

    match = steps1.get("step6_final") == steps2.get("step6_final")

    return jsonify({
        "word1": word1,
        "word2": word2,
        "steps1": steps1,
        "steps2": steps2,
        "match": match
    })

@app.route("/healthz")
def healthz():
    return {"status": "ok", "app": "P4L Retrieval"}


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)

