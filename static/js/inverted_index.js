// inverted_index.js

async function renderInvertedVisualization(data, speedKey) {
    const stepDelay = window.getVisualizationDelay ? window.getVisualizationDelay(speedKey) : 900;
    const vMatrix = document.getElementById('v-matrix');
    const topSuccess = document.getElementById('v-success');
    const bottomSuccess = document.getElementById('v-success-bottom');
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (window.renderSharedStages) {
        await window.renderSharedStages(data.docs, speedKey);
    }

    // 3. Vocabulary extraction
    const vocTitle = document.createElement('h3');
    vocTitle.className = 'text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8';
    vocTitle.textContent = 'Vocabulary Extraction';
    vMatrix.appendChild(vocTitle);

    const vocabContainer = document.createElement('div');
    vocabContainer.className = 'glass-card p-4 flex flex-wrap gap-2 text-sm font-mono';
    vMatrix.appendChild(vocabContainer);

    for (let i = 0; i < data.vocabulary.length; i++) {
        const termChip = document.createElement('span');
        termChip.className = 'bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 opacity-0 transition-opacity duration-500';
        termChip.textContent = data.vocabulary[i];
        vocabContainer.appendChild(termChip);
        setTimeout(() => termChip.classList.remove('opacity-0'), 30);
        if (i % 5 === 0) await sleep(10);
    }

    await sleep(stepDelay / 2);

    // 4. Inverted index construction
    const invTitle = document.createElement('h3');
    invTitle.className = 'text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8';
    invTitle.textContent = 'Inverted Index Construction';
    vMatrix.appendChild(invTitle);

    const explain = document.createElement('p');
    explain.className = 'text-sm text-slate-400 mb-4';
    explain.textContent = 'Live build: term is highlighted, matching documents are discovered, then posting list is appended.';
    vMatrix.appendChild(explain);

    const invContainer = document.createElement('div');
    invContainer.className = 'flex flex-col gap-2';
    vMatrix.appendChild(invContainer);

    for (let i = 0; i < data.vocabulary.length; i++) {
        const term = data.vocabulary[i];
        const docList = data.index[term] || [];

        const row = document.createElement('div');
        row.className = 'glass-card p-3 border border-slate-700/50 flex items-center gap-4 transition-colors opacity-0';

        const termEl = document.createElement('div');
        termEl.className = 'w-36 font-mono text-cyan-300 font-bold';
        termEl.textContent = term + ' ->';
        row.appendChild(termEl);

        const listEl = document.createElement('div');
        listEl.className = 'flex flex-wrap gap-2';
        row.appendChild(listEl);

        invContainer.appendChild(row);
        row.classList.remove('opacity-0');
        row.classList.add('border-cyan-500/70');

        for (const docName of docList) {
            const badge = document.createElement('span');
            badge.className = 'bg-purple-900/30 text-purple-200 border border-purple-500/50 px-2 py-1 text-xs rounded shadow-sm opacity-0 transition-opacity duration-300';
            badge.textContent = docName.length > 20 ? docName.slice(0, 17) + '...' : docName;
            listEl.appendChild(badge);
            setTimeout(() => badge.classList.remove('opacity-0'), 20);
            await sleep(Math.max(40, stepDelay / 6));
        }

        row.classList.remove('border-cyan-500/70');
        if (data.vocabulary.length < 50) await sleep(Math.max(40, stepDelay / 5));
    }

    if (topSuccess) {
        topSuccess.innerHTML = '<i class="fa-solid fa-circle-check"></i> Inverted Index Ready - You can now search.';
        topSuccess.classList.remove('hidden');
    }
    if (bottomSuccess) {
        bottomSuccess.innerHTML = '<i class="fa-solid fa-circle-check"></i> Inverted Index Ready - You can now search.';
        bottomSuccess.classList.remove('hidden');
    }
}

// function was renamed and moved to end of file

function buildSnippet(text, terms) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    let anchor = 0;
    for (let i = 0; i < words.length; i++) {
        const token = words[i].toLowerCase().replace(/[^a-z0-9]/g, "");
        if (terms.has(token)) {
            anchor = i;
            break;
        }
    }
    const start = Math.max(0, anchor - 6);
    const end = Math.min(words.length, anchor + 14);
    return words.slice(start, end).join(" ");
}

function searchInvertedIndex(query, matrixData) {
    const preprocess = window.sharedPreprocessTokens || ((v) => String(v || "").split(/\s+/));
    const queryTokens = preprocess(query);
    const index = matrixData.index || {};
    const docs = matrixData.docs || [];

    const docScores = new Map();
    for (const token of queryTokens) {
        const posting = index[token] || [];
        for (const docName of posting) {
            if (!docScores.has(docName)) {
                docScores.set(docName, { score: 0, matched: new Set() });
            }
            const item = docScores.get(docName);
            item.score += 1;
            item.matched.add(token);
        }
    }

    const results = [];
    for (const [docName, payload] of docScores.entries()) {
        const doc = docs.find((d) => d.name === docName);
        if (!doc) continue;
        const matched = Array.from(payload.matched);
        const snippet = buildSnippet(doc.original_text, new Set(matched));
        results.push({
            name: docName,
            score: queryTokens.length ? payload.score / queryTokens.length : 0,
            matched_terms: matched,
            snippet: snippet ? `${snippet}...` : "",
            doc
        });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
}

window.renderInvertedVisualization = renderInvertedVisualization;
window.getInvertedIndexAboutHTML = function() {
    return `
        <h3 class="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Inverted Index</h3>
        
        <div class="mb-6 max-w-2xl mx-auto border border-slate-700 rounded overflow-hidden bg-black">
           <iframe
             class="w-full aspect-video"
             src="https://www.youtube.com/embed/Aeqw1GdDlwg?si=kn2BwgqeW7YoFiVK"
             title="Inverted Index Educational Video"
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
             referrerpolicy="strict-origin-when-cross-origin"
             allowfullscreen>
           </iframe>
        </div>

        <div class="glass-card p-6">
            <h4 class="text-xl font-semibold mb-3 text-cyan-300">What is an Inverted Index?</h4>
            <p class="text-slate-300 leading-relaxed mb-4">An inverted index maps each term to a posting list of documents where it appears.</p>
            <p class="text-slate-300 leading-relaxed">
                Search becomes fast because we look up terms directly in posting lists instead of scanning all documents.
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-purple-300"><i class="fa-solid fa-list"></i> Posting Lists</h4>
                <p class="text-sm text-slate-300 leading-relaxed">
                    Each term in the index points to a list of documents (or document positions) where that term appears. This structure enables rapid lookups.
                </p>
            </div>
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-emerald-300"><i class="fa-solid fa-bolt"></i> Fast Retrieval</h4>
                <p class="text-sm text-slate-300 leading-relaxed">
                    Instead of scanning every document for query terms, we directly access posting lists, making boolean and phrase queries extremely efficient.
                </p>
            </div>
        </div>

        <div class="glass-card p-6 border-l-4 border-l-cyan-500 mt-6">
            <h4 class="text-lg font-bold mb-3 text-purple-300">Example Posting Lists</h4>
            <p class="text-sm text-slate-400 mb-4">Doc1: "information retrieval" | Doc2: "retrieval systems"</p>
            <div class="space-y-2 font-mono text-sm">
                <div class="glass-card p-3 flex items-center gap-4 border border-slate-800">
                  <span class="text-cyan-300 w-28">information -></span>
                  <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">Doc1</span>
                </div>
                <div class="glass-card p-3 flex items-center gap-4 border border-slate-800">
                  <span class="text-cyan-300 w-28">retrieval -></span>
                  <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">Doc1</span>
                  <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">Doc2</span>
                </div>
                <div class="glass-card p-3 flex items-center gap-4 border border-slate-800">
                  <span class="text-cyan-300 w-28">systems -></span>
                  <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">Doc2</span>
                </div>
            </div>
        </div>
    `;
};
window.searchInvertedIndex = searchInvertedIndex;
