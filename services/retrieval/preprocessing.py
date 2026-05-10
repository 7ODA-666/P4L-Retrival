import re
from typing import List, Set
import nltk
from nltk.corpus import stopwords as nltk_stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer
from nltk.tokenize import RegexpTokenizer

TOKENIZER = RegexpTokenizer(r"\w+")
STEMMER = PorterStemmer()
LEMMATIZER = WordNetLemmatizer()

try:
    import contractions
except ImportError:
    contractions = None


def _expand_contractions(text: str) -> str:
    if contractions:
        try:
            return contractions.fix(text)
        except Exception:
            pass
    return text


def _collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _tokenize_text(text: str) -> List[str]:
    return TOKENIZER.tokenize(text)


def _remove_stop_words(tokens: List[str]) -> List[str]:
    try:
        stop_words = set(nltk_stopwords.words("english"))
    except LookupError:
        stop_words = set()
    return [t for t in tokens if t not in stop_words]


def _lemmatize_token(token: str) -> str:
    return LEMMATIZER.lemmatize(token)


def _lemmatize_tokens(tokens: List[str]) -> List[str]:
    return [_lemmatize_token(t) for t in tokens]


def preprocess_pipeline(text: str) -> List[str]:
    text = text.lower()
    text = _expand_contractions(text)
    text = re.sub(r"[^A-Za-z0-9\s]", " ", text)
    text = _collapse_whitespace(text)

    tokens = _tokenize_text(text)
    tokens = _remove_stop_words(tokens)
    tokens = _lemmatize_tokens(tokens)
    return tokens
