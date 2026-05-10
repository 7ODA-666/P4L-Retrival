// bag_of_words.js

window.renderBoWVisualization = async function (data, speedKey) {
    if (!data || !data.docs || !data.vocabulary) {
        console.error("Invalid BoW data:", data);
        return;
    }

    const vMatrix = document.getElementById("v-matrix");
    vMatrix.innerHTML = "";
    document.getElementById("v-success").classList.add("hidden");
    const bottom = document.getElementById("v-success-bottom");
    if (bottom) bottom.classList.add("hidden");

    await window.renderSharedStages(data.docs, speedKey);
    const delay = window.getVisualizationDelay(speedKey);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Vocabulary Extraction
    const titleVocab = document.createElement("h3");
    titleVocab.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8";
    titleVocab.textContent = "Vocabulary Extraction";
    vMatrix.appendChild(titleVocab);

    const vocabCard = document.createElement("div");
    vocabCard.className = "glass-card p-4 border border-blue-500/20";
    const vocabTitle = document.createElement("h4");
    vocabTitle.className = "text-md font-bold text-blue-300 mb-2";
    vocabTitle.textContent = "Extracted Vocabulary (" + data.vocabulary.length + " terms)";
    vocabCard.appendChild(vocabTitle);

    const vocabContainer = document.createElement("div");
    vocabContainer.className = "flex flex-wrap gap-2 text-sm font-mono text-cyan-200 mt-2";
    vocabCard.appendChild(vocabContainer);
    vMatrix.appendChild(vocabCard);

    for (const term of data.vocabulary) {
        const span = document.createElement("span");
        span.className = "bg-blue-900/30 text-blue-100 px-2 py-1 rounded mb-1 inline-block border border-blue-800/50";
        span.textContent = term;
        vocabContainer.appendChild(span);
        await sleep(Math.max(10, delay / 10)); // render progressively quickly
    }

    // Vectors representation
    const titleVec = document.createElement("h3");
    titleVec.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8 flex justify-between items-center";
    titleVec.innerHTML = `<span>Bag of Words Frequency Vectors</span> <span class="text-sm font-normal text-slate-400">Rows: Documents, Cols: Terms</span>`;
    vMatrix.appendChild(titleVec);

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "overflow-x-auto glass-card rounded-lg border border-slate-700/50";

    const table = document.createElement("table");
    table.className = "w-full text-left border-collapse text-sm whitespace-nowrap";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const docTh = document.createElement("th");
    docTh.className = "sticky top-0 bg-slate-900 p-3 text-emerald-300 border-b border-slate-700 font-bold z-10 sticky left-0";
    docTh.textContent = "Document";
    headerRow.appendChild(docTh);

    data.vocabulary.forEach(term => {
        const th = document.createElement("th");
        th.className = "sticky top-0 bg-slate-900 p-3 text-slate-300 border-b border-l border-slate-700 font-medium z-0";
        th.textContent = term;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    vMatrix.appendChild(tableWrapper);

    for (const doc of data.docs) {
        // Build array incrementally in UI
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-800/50 transition-colors border-b border-slate-800 last:border-0 opacity-0 transform translate-y-2 transition-all duration-300";

        const docTd = document.createElement("td");
        docTd.className = "p-3 font-semibold text-cyan-300 border-r border-slate-800 sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10";
        docTd.textContent = doc.name;
        row.appendChild(docTd);

        const freqMap = {};
        doc.tokens.forEach(t => { freqMap[t] = (freqMap[t] || 0) + 1; });

        data.vocabulary.forEach(term => {
            const td = document.createElement("td");
            td.className = "p-3 border-l border-slate-800 text-center";
            const val = freqMap[term] || 0;
            if (val > 0) {
                td.innerHTML = `<span class="bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-800/50">${val}</span>`;
            } else {
                td.innerHTML = `<span class="text-slate-600 font-mono">0</span>`;
            }
            row.appendChild(td);
        });

        tbody.appendChild(row);

        // Let browser render
        await sleep(50);
        row.classList.remove("opacity-0", "translate-y-2");
        await sleep(Math.max(200, delay / 2));
    }

    document.getElementById("v-success").classList.remove("hidden");
    const bottomMsg = document.getElementById("v-success-bottom");
    if (bottomMsg) {
        bottomMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> Bag of Words Representation Ready — You can now search.';
        bottomMsg.classList.remove("hidden");
    }
};

window.searchBoW = function (query, matrixData) {
    if (!query || !matrixData || !matrixData.docs) return [];

    // 1. preprocess query
    const queryTokens = window.sharedPreprocessTokens(query);
    if (queryTokens.length === 0) return [];

    const queryFrq = {};
    queryTokens.forEach(t => queryFrq[t] = (queryFrq[t] || 0) + 1);

    const results = [];

    // 3. compare query terms with document vectors
    matrixData.docs.forEach((doc) => {
        let score = 0;
        let matchedTerms = new Set();
        let totalQueryTerms = queryTokens.length;

        // Calculate ranking score
        // Depending on: Number of query words found in each document
        // Let's count how many query terms exist in the document
        // Example: Query "information retrieval" -> [information, retrieval]
        // Doc1 contains both -> score 2/2 = 1.0 (or similar)
        let termsFound = 0;

        // To handle term duplication, we will match unique terms in query against document tokens
        const uniqueQueryTokens = Object.keys(queryFrq);
        const docTokensSet = new Set(doc.tokens);

        uniqueQueryTokens.forEach(term => {
            if (docTokensSet.has(term)) {
                termsFound += 1; // Count of unique query terms found
                matchedTerms.add(term);
            }
        });

        if (termsFound > 0) {
            // normalized score based on unique query terms
            score = termsFound / uniqueQueryTokens.length;

            // Build snippet
            const docContent = String(doc.original_text || "");
            const snippetLength = 100;
            let snippet = docContent;

            // Find first matched term to center snippet
            let firstMatchIdx = -1;
            const matchesArr = Array.from(matchedTerms);
            if (matchesArr.length > 0) {
                 const pattern = window.escapeRegExp(matchesArr[0]);
                 const regex = new RegExp(`\\b${pattern}\\b`, "i");
                 const match = regex.exec(docContent);
                 if (match) {
                     firstMatchIdx = match.index;
                 }
            }

            if (firstMatchIdx > -1) {
                const start = Math.max(0, firstMatchIdx - 40);
                const end = Math.min(docContent.length, start + snippetLength);
                snippet = (start > 0 ? "... " : "") + docContent.slice(start, end) + (end < docContent.length ? " ..." : "");
            } else {
                snippet = docContent.slice(0, snippetLength) + "...";
            }

            // Highlight the snippet safely using shared function
            const highlightedSnippet = window.highlightContent(snippet, Array.from(matchedTerms));

            results.push({
                name: doc.name,
                score: score,
                matched_terms: Array.from(matchedTerms),
                snippet: highlightedSnippet,
                doc: doc,
                query_tokens: queryTokens
            });
        }
    });

    results.sort((a, b) => b.score - a.score);
    return results;
};

window.getBoWAboutHTML = function() {
    return `
    <div class="space-y-6">
        <h3 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Bag of Words (BoW) Representation</h3>
        
        <div class="aspect-video bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center relative shadow-inner">
            <div class="text-center">
                <i class="fa-solid fa-play text-4xl text-cyan-500 mb-3 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"></i>
                <p class="text-slate-400 text-sm">Educational Video: Understanding Bag of Words (Placeholder)</p>
            </div>
        </div>

        <div class="glass-card p-6">
            <h4 class="text-xl font-semibold mb-3 text-cyan-300">What is Bag of Words?</h4>
            <p class="text-slate-300 leading-relaxed mb-4">
                The <strong>Bag of Words (BoW)</strong> model is a simplifying representation used in natural language processing and information retrieval. In this model, a text (such as a sentence or a document) is represented as the bag (multiset) of its words, disregarding grammar and even word order but keeping multiplicity.
            </p>
            <p class="text-slate-300 leading-relaxed">
                Before applying BoW, the text undergoes strict <strong>preprocessing</strong> (case folding, special character removal, tokenization, stop-word removal, and lemmatization). This ensures that variations of the same underlying term are grouped together, preventing matrix sparsity and improving search matches.
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-purple-300"><i class="fa-solid fa-book-open"></i> Vocabulary</h4>
                <p class="text-sm text-slate-300 leading-relaxed">
                    The vocabulary is the collection of all unique, preprocessed words found across all uploaded documents. It defines the "dimensions" of our feature space.
                </p>
                <div class="mt-3 p-3 bg-slate-900 rounded font-mono text-xs text-blue-200">
                    Vocabulary = ["retrieval", "system"]
                </div>
            </div>
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-emerald-300"><i class="fa-solid fa-table"></i> Frequency Vectors</h4>
                <p class="text-sm text-slate-300 leading-relaxed">
                    Each document is represented by a numerical vector indicating the count of each vocabulary term appearing in it. 
                </p>
                <div class="mt-3 p-3 bg-slate-900 rounded font-mono text-xs text-emerald-200 block">
                    Doc: "retrieval retrieval system"<br/>
                    Vector: [2, 1]
                </div>
            </div>
        </div>
        
        <div class="glass-card p-6 border-l-4 border-l-cyan-500">
            <h4 class="text-xl font-semibold mb-3 text-cyan-300">How Search Ranking Works</h4>
            <p class="text-slate-300 leading-relaxed mb-3">
                In this implementation, search ranking is based on the <strong>Number of query words found</strong> in each document. Documents containing a higher variety of the search terms receive a higher score.
            </p>
            <ul class="list-disc list-inside text-slate-300 text-sm space-y-2">
                <li>Query terms are cross-referenced with the document's vocabulary usage.</li>
                <li>The score represents the percentage of unique query terms present in the document.</li>
                <li>A document matching 2 out of 2 terms ranks higher (100%) than one matching only 1 out of 2 (50%).</li>
            </ul>
        </div>
    </div>
    `;
};

