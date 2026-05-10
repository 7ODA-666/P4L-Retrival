from typing import Dict, List, Any
from .preprocessing import preprocess_pipeline, _lemmatize_token
def build_inverted_index(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    index = {}
    all_tokens_set = set()
    for doc in docs:
        tokens = doc.get("tokens", [])
        doc_id = doc.get("name")
        for token in tokens:
            all_tokens_set.add(token)
            if token not in index:
                index[token] = []
            if doc_id not in index[token]:
                index[token].append(doc_id)
    return {
        "vocabulary": sorted(list(all_tokens_set)),
        "index": index
    }
def search_inverted_index(query: str, index_data: Dict[str, Any], docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    query_tokens = preprocess_pipeline(query)
    index = index_data.get("index", {})
    # Simple counting heuristic for relevance
    doc_scores = {}
    for token in query_tokens:
        if token in index:
            for doc_id in index[token]:
                if doc_id not in doc_scores:
                    doc_scores[doc_id] = {"score": 0, "matched_terms": set()}
                doc_scores[doc_id]["score"] += 1
                doc_scores[doc_id]["matched_terms"].add(token)
    results = []
    for doc_id, data in doc_scores.items():
        score = data["score"] / len(query_tokens) if len(query_tokens) > 0 else 0
        matched_terms = list(data["matched_terms"])
        # find snippet
        original_text = ""
        for doc in docs:
            if doc["name"] == doc_id:
                original_text = doc["original_text"]
                break
        snippet = original_text[:100]
        words = original_text.split()
        for i, word in enumerate(words):
            if _lemmatize_token(word.lower().strip(",.!?()\"'")) in matched_terms:
                start = max(0, i - 5)
                end = min(len(words), i + 15)
                snippet = " ".join(words[start:end])
                break
        results.append({
            "name": doc_id,
            "score": score,
            "matched_terms": matched_terms,
            "snippet": snippet + "..."
        })
    return sorted(results, key=lambda x: x["score"], reverse=True)
