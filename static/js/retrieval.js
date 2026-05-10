// retrieval.js
let uploadedFiles = [];
let matrixData = null;

const SHARED_STOPWORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "he",
    "in", "is", "it", "its", "of", "on", "that", "the", "to", "was", "were", "will",
    "with", "this", "these", "those", "they", "their", "you", "your", "we", "our", "or"
]);

function getVisualizationDelay(speedKey) {
    const speedMap = { low: 1350, medium: 1050, high: 320 };
    return speedMap[speedKey] || 900;
}

function getSearchResultDelay(speedKey) {
    const speedMap = { low: 260, medium: 190, high: 95 };
    return speedMap[speedKey] || 190;
}

function sharedPreprocessTokens(text) {
    const normalized = String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return [];
    return normalized.split(" ").filter((token) => token && !SHARED_STOPWORDS.has(token));
}

function escapeHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escapeRegExp(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightContent(text, tokens) {
    const sourceText = String(text || "");
    const normalizedTokens = Array.from(
        new Set((tokens || []).map((t) => String(t || "").trim()).filter(Boolean))
    ).sort((a, b) => b.length - a.length);

    if (!normalizedTokens.length) {
        return escapeHtml(sourceText);
    }

    const pattern = normalizedTokens.map(escapeRegExp).join("|");
    const regex = new RegExp(`\\b(${pattern})\\b`, "gi");

    let result = "";
    let lastIndex = 0;
    sourceText.replace(regex, (match, _group, offset) => {
        result += escapeHtml(sourceText.slice(lastIndex, offset));
        result += `<mark class="bg-yellow-400/40 text-yellow-100 px-0.5 rounded">${escapeHtml(match)}</mark>`;
        lastIndex = offset + match.length;
        return match;
    });
    result += escapeHtml(sourceText.slice(lastIndex));
    return result;
}

function openDocPreview(title, docData, tokens) {
    document.getElementById("modalTitle").textContent = title;
    const content = docData ? docData.original_text : "Preview content...";
    const highlighted = highlightContent(content, tokens || []);
    document.getElementById("modalBody").innerHTML = `<p class="whitespace-pre-wrap leading-relaxed">${highlighted}</p>`;
    document.getElementById("docModal").classList.add("active");
}

async function renderOriginalCards(docs, delayMs) {
    const vOriginal = document.getElementById("v-original");
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const title = document.createElement("h3");
    title.className = "text-xl font-bold mb-3";
    title.textContent = "Original Text";
    vOriginal.appendChild(title);

    for (const doc of docs) {
        const card = document.createElement("div");
        card.className = "glass-card p-4 mb-3 border border-slate-700/50";
        card.innerHTML = `
            <h4 class="font-bold text-cyan-300 mb-2 truncate">${doc.name}</h4>
            <div class="text-sm text-slate-300 max-h-28 overflow-y-auto">${doc.original_text}</div>
        `;
        vOriginal.appendChild(card);
        await sleep(Math.max(60, delayMs / 2));
    }
}

async function renderPreprocessingCards(docs, delayMs) {
    const vPre = document.getElementById("v-preprocessing");
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const title = document.createElement("h3");
    title.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8";
    title.textContent = "After Preprocessing";
    vPre.appendChild(title);

    for (const doc of docs) {
        const card = document.createElement("div");
        card.className = "glass-card p-4 mb-3 border border-purple-500/20";
        card.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-2">
              <h4 class="font-bold text-purple-300 truncate">${doc.name}</h4>
              <span class="text-xs text-emerald-400"><i class="fa-solid fa-layer-group"></i> ${doc.tokens.length} tokens</span>
            </div>
            <div class="text-sm font-mono text-cyan-200 break-words leading-relaxed">
              ${doc.tokens.length > 0
                ? doc.tokens.map((t) => `<span class="bg-cyan-900/30 text-cyan-100 px-1 py-0.5 rounded mr-1 mb-1 inline-block">${t}</span>`).join("")
                : '<span class="text-slate-500">empty</span>'}
            </div>
        `;
        vPre.appendChild(card);
        await sleep(Math.max(80, delayMs / 2));
    }
}

async function renderSharedStages(docs, speedKey) {
    const stepDelay = getVisualizationDelay(speedKey);
    await renderOriginalCards(docs, stepDelay);
    await renderPreprocessingCards(docs, stepDelay);
}

document.addEventListener("DOMContentLoaded", () => {
    const fileUpload = document.getElementById("fileUpload");
    const prepareBtn = document.getElementById("prepareBtn");
    const clearBtn = document.getElementById("clearBtn");
    const algoSelect = document.getElementById("algoSelect");

    // Tabs
    const tabs = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            document.getElementById(tab.dataset.target).classList.add("active");
        });
    });

    fileUpload.addEventListener("change", (e) => {
        for(let file of e.target.files) {
            uploadedFiles.push(file);
        }
        renderFileList();
        enablePrepare();
    });

    clearBtn.addEventListener("click", () => {
        if (uploadedFiles.length === 0) {
            if (window.showNotification) showNotification('Already clear.', 'info');
            else alert('Already clear.');
            return;
        }
        uploadedFiles = [];
        fileUpload.value = '';
        renderFileList();
        resetState();
        enablePrepare();
        if (window.showNotification) showNotification('Cleared.', 'success');
        else alert('Cleared.');
    });

    algoSelect.addEventListener("change", () => {
        resetState();
        renderAboutContent();
        enablePrepare();
    });

    prepareBtn.addEventListener("click", async () => {
        if (uploadedFiles.length === 0) {
            if (window.showNotification) showNotification('No files to prepare.', 'warn');
            else alert('No files to prepare.');
            return;
        }
        if (prepareBtn.disabled) return;

        prepareBtn.disabled = true;
        prepareBtn.style.opacity = '0.5';
        prepareBtn.textContent = 'Preparing...';

        const formData = new FormData();
        uploadedFiles.forEach(file => formData.append("files", file));

        const algo = algoSelect.value;
        formData.append("algorithm", algo);

        try {
            const res = await fetch("/api/retrieval/prepare", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if (data.error) {
                if (window.showNotification) showNotification(data.error, 'error');
                else alert(data.error);
                enablePrepare();
                return;
            }

            matrixData = data;

            const speedSel = document.getElementById('viz-speed');
            const speedKey = speedSel ? speedSel.value : 'medium';

            if (algo === 'inverted' && window.renderInvertedVisualization) {
                await window.renderInvertedVisualization(data, speedKey);
            } else if (algo === 'bow' && window.renderBoWVisualization) {
                await window.renderBoWVisualization(data, speedKey);
            } else if (window.renderTDMVisualization) {
                await window.renderTDMVisualization(data, speedKey);
            } else if (window.renderSharedStages) {
                await window.renderSharedStages(data.docs, speedKey);
            }

            setPreparedState();
        } catch (e) {
            if (window.showNotification) showNotification(e.message || 'Preparation failed', 'error');
            else alert(e.message);
            enablePrepare();
        }
    });

    document.getElementById("searchBtn").addEventListener("click", async () => {
        const query = document.getElementById("searchInput").value;
        if(!query || !matrixData) return;

        try {
            const algo = algoSelect.value;
            if (algo === "inverted" && window.searchInvertedIndex) {
                const localResults = window.searchInvertedIndex(query, matrixData);
                renderSearchResults(localResults);
                return;
            } else if (algo === "bow" && window.searchBoW) {
                const localResults = window.searchBoW(query, matrixData);
                renderSearchResults(localResults);
                return;
            }

            const res = await fetch("/api/retrieval/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: query,
                    matrix_data: matrixData,
                    algorithm: algo
                })
            });
            const data = await res.json();
            if (data.error) {
                if (window.showNotification) showNotification(data.error, 'error');
                else alert(data.error);
                return;
            }
            renderSearchResults(data.results);
        } catch(e) {
            if (window.showNotification) showNotification(e.message || 'Search failed', 'error');
            else alert(e.message);
        }
    });

    document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("docModal").classList.remove("active");
    });

    // Initial Render of About Page
    const activeTab = document.querySelector(".tab-btn.active").getAttribute("data-target");
    if (activeTab === "tab-about") {
        renderAboutContent();
    }

    renderAboutContent();
});

function renderAboutContent() {
    const algo = document.getElementById("algoSelect").value;
    const container = document.getElementById("aboutContent");

    if (algo === "inverted" && window.getInvertedIndexAboutHTML) {
        container.innerHTML = window.getInvertedIndexAboutHTML();
    } else if (algo === "bow" && window.getBoWAboutHTML) {
        container.innerHTML = window.getBoWAboutHTML();
    } else if (window.getTDMAboutHTML) {
        container.innerHTML = window.getTDMAboutHTML();
    }
}

function enablePrepare() {
    const btn = document.getElementById("prepareBtn");
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Start Preparing';
}

function setPreparedState() {
    const btn = document.getElementById("prepareBtn");
    btn.disabled = true;
    btn.style.opacity = '0.85';
    btn.textContent = 'Prepared';
}

function resetState() {
    matrixData = null;
    document.getElementById("v-original").innerHTML = '';
    document.getElementById("v-preprocessing").innerHTML = '';
    document.getElementById("v-matrix").innerHTML = '';
    document.getElementById("v-success").innerHTML = '<i class="fa-solid fa-circle-check"></i> Preparation Complete — You can now search.';
    const bottom = document.getElementById('v-success-bottom');
    if (bottom) bottom.innerHTML = '<i class="fa-solid fa-circle-check"></i> Preparation Complete — You can now search.';
    document.getElementById("v-success").classList.add("hidden");
    if (bottom) bottom.classList.add('hidden');
    document.getElementById("searchResults").innerHTML = '';
}

function renderFileList() {
    const list = document.getElementById("fileList");
    list.innerHTML = '';
    uploadedFiles.forEach((f, idx) => {
        const div = document.createElement("div");
        div.className = "file-list-item";

        const left = document.createElement('div');
        left.className = 'flex items-center gap-3';
        left.innerHTML = `<i class="fa-solid fa-file-lines"></i>`;

        const meta = document.createElement('div');
        meta.innerHTML = `<div class="text-sm font-semibold">${f.name}</div><div class="text-xs text-slate-400 opacity-70">Word count will show after preparation</div>`;

        const btn = document.createElement('button');
        btn.className = 'file-remove-btn text-red-400 hover:text-red-200 p-1 rounded';
        btn.setAttribute('aria-label', 'Remove file');
        btn.dataset.index = idx;
        btn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            removeFile(Number(btn.dataset.index));
        });

        div.appendChild(left);
        div.appendChild(meta);
        div.appendChild(btn);
        list.appendChild(div);
    });
}

function removeFile(index) {
    if (index < 0 || index >= uploadedFiles.length) return;
    uploadedFiles.splice(index, 1);
    // update file input value to allow re-upload of same files if needed
    const fileUpload = document.getElementById('fileUpload');
    fileUpload.value = '';
    renderFileList();
    // Clearing prepared state because files changed
    resetState();
    enablePrepare();
}

function renderSearchResults(results) {
    const list = document.getElementById("searchResults");
    list.innerHTML = "";

    if (!results || results.length === 0) {
        list.innerHTML = '<p class="text-slate-500 italic">No matching documents found.</p>';
        return;
    }

    const speedSel = document.getElementById("viz-speed");
    const speedKey = speedSel ? speedSel.value : "medium";
    const cardDelay = getSearchResultDelay(speedKey);

    results.forEach((r, idx) => {
        let isInv = !!r.matched_terms; // Presence of matched terms array means inverted index
        let termsDisplay = isInv ? r.matched_terms.map(t => `<span class="bg-cyan-900/30 text-cyan-200 px-1 py-0.5 rounded text-xs ml-1 border border-cyan-800">${t}</span>`).join('') : '';
        const highlightTokens = Array.isArray(r.matched_terms)
            ? r.matched_terms
            : (Array.isArray(r.query_tokens) ? r.query_tokens : []);

        const item = document.createElement("div");
        item.className = "p-4 border-b border-slate-700/50 hover:bg-slate-800/30 transition-all duration-300 flex gap-4 cursor-pointer opacity-0 translate-y-2";
        item.innerHTML = `
            <div class="mt-1"><i class="fa-solid fa-file-pdf text-purple-400 text-xl"></i></div>
            <div class="flex-1">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="font-bold text-cyan-300">${r.name}</h4>
                    <span class="text-emerald-400 font-mono text-sm bg-emerald-900/20 px-2 py-1 rounded border border-emerald-800/50">Score: ${(r.score * 100).toFixed(1)}%</span>
                </div>
                ${isInv ? `<div class="mb-2 text-xs text-slate-400">Matched terms: ${termsDisplay}</div>` : ''}
                <p class="text-sm text-slate-400 leading-relaxed">${r.snippet}</p>
            </div>
        `;

        item.addEventListener("click", () => window.openDocPreview(r.name, r.doc || null, highlightTokens));
        list.appendChild(item);

        // Staggered reveal animation for search results
        setTimeout(() => {
            item.classList.remove("opacity-0", "translate-y-2");
        }, idx * cardDelay);
    });
}

window.getVisualizationDelay = getVisualizationDelay;
window.getSearchResultDelay = getSearchResultDelay;
window.sharedPreprocessTokens = sharedPreprocessTokens;
window.renderOriginalCards = renderOriginalCards;
window.renderPreprocessingCards = renderPreprocessingCards;
window.renderSharedStages = renderSharedStages;
window.escapeHtml = escapeHtml;
window.escapeRegExp = escapeRegExp;
window.highlightContent = highlightContent;
window.openDocPreview = openDocPreview;

