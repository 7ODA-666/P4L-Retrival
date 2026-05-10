// retrieval.js
let uploadedFiles = [];
let matrixData = null;

document.addEventListener("DOMContentLoaded", () => {
    const fileUpload = document.getElementById("fileUpload");
    const fileListEl = document.getElementById("fileList");
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

        try {
            const res = await fetch("/api/retrieval/prepare", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            if(data.error) throw new Error(data.error);

            matrixData = data;
            await renderVisualization(data);
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
            const res = await fetch("/api/retrieval/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: query,
                    matrix_data: matrixData
                })
            });
            const data = await res.json();
            if(data.error) throw new Error(data.error);
            renderSearchResults(data.results);
        } catch(e) {
            if (window.showNotification) showNotification(e.message || 'Search failed', 'error');
            else alert(e.message);
        }
    });

    document.getElementById("closeModal").addEventListener("click", () => {
        document.getElementById("docModal").classList.remove("active");
    });
});

function enablePrepare() {
    const btn = document.getElementById("prepareBtn");
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = 'Start Preparing';
}

function resetState() {
    matrixData = null;
    document.getElementById("v-original").innerHTML = '';
    document.getElementById("v-preprocessing").innerHTML = '';
    document.getElementById("v-matrix").innerHTML = '';
    document.getElementById("v-success").classList.add("hidden");
    const bottom = document.getElementById('v-success-bottom');
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
async function renderVisualization(data) {
    const speedSel = document.getElementById('viz-speed');
    const speedKey = speedSel ? speedSel.value : 'medium';
    // Adjusted speeds: medium is now a moderate paced value to match user preference
    const speedMap = { low: 900, medium: 450, high: 200 };
    const stepDelay = speedMap[speedKey] || 200;

    const vOriginal = document.getElementById('v-original');
    const vPre = document.getElementById('v-preprocessing');
    const vMatrix = document.getElementById('v-matrix');
    const topSuccess = document.getElementById('v-success');
    const bottomSuccess = document.getElementById('v-success-bottom');

    // clear existing
    vOriginal.innerHTML = '';
    vPre.innerHTML = '';
    vMatrix.innerHTML = '';
    topSuccess.classList.add('hidden');
    if (bottomSuccess) bottomSuccess.classList.add('hidden');

    // Helper sleep
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // 1. Original text cards - render progressively
    const origTitle = document.createElement('h3');
    origTitle.className = 'text-xl font-bold mb-3';
    origTitle.textContent = 'Original Text';
    vOriginal.appendChild(origTitle);

    for (let idx = 0; idx < data.docs.length; idx++) {
        const doc = data.docs[idx];
        const card = document.createElement('div');
        card.className = 'mb-4 p-4 glass-card card-anim';
        card.style.animationDelay = `${idx * 80}ms`;
        card.innerHTML = `<div class="font-bold text-cyan-400 mb-2">${doc.name}</div><div class="text-sm max-h-40 overflow-y-auto">${doc.original_text}</div>`;
        vOriginal.appendChild(card);

        // update file list word count
        const fl = document.getElementById('fileList').children[idx];
        if (fl) {
            const wordCount = doc.original_text.split(/\s+/).filter(Boolean).length;
            const meta = fl.querySelector('.text-xs');
            if (meta) meta.textContent = `Approx. Words: ${wordCount}`;
        }

        await sleep(stepDelay);
    }

    await sleep(stepDelay);

    // 2. Preprocessing pipeline cards
    const prepTitle = document.createElement('h3');
    prepTitle.className = 'text-xl font-bold mb-3 mt-8';
    prepTitle.textContent = 'Preprocessing Pipeline';
    const prepNote = document.createElement('p');
    prepNote.className = 'text-sm text-slate-400 mb-4';
    prepNote.textContent = 'Applied normalization, tokenization, stop-word removal, and lemmatization.';
    vPre.appendChild(prepTitle);
    vPre.appendChild(prepNote);

    for (let pIdx = 0; pIdx < data.docs.length; pIdx++) {
        const doc = data.docs[pIdx];
        const card = document.createElement('div');
        card.className = 'mb-4 p-4 glass-card card-anim';
        card.style.animationDelay = `${pIdx * 70}ms`;
        card.innerHTML = `<div class="font-bold text-purple-400 mb-2">${doc.name} (Tokens: ${doc.tokens.length})</div><div class="text-sm text-slate-300 break-words">${doc.tokens.join(', ')}</div>`;
        vPre.appendChild(card);
        await sleep(stepDelay);
    }

    await sleep(stepDelay);

    // 3. Term Document Matrix - build table and progressively append rows
    const matrixTitle = document.createElement('h3');
    matrixTitle.className = 'text-xl font-bold mb-3 mt-8';
    matrixTitle.textContent = 'Term Document Matrix';
    vMatrix.appendChild(matrixTitle);

    // brief description under the matrix title (English)
    const matrixDesc = document.createElement('p');
    matrixDesc.className = 'text-sm text-slate-400 mb-3';
    matrixDesc.textContent = 'The matrix is built by placing 1 when a term is present in a document and 0 when it is absent.';
    vMatrix.appendChild(matrixDesc);



    const container = document.createElement('div');
    container.className = 'matrix-container';
    const table = document.createElement('table');
    table.className = 'matrix-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const thTerm = document.createElement('th');
    thTerm.textContent = 'Term';
    headRow.appendChild(thTerm);
    for (let doc of data.docs) {
        const th = document.createElement('th');
        th.textContent = doc.name;
        headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    container.appendChild(table);
    vMatrix.appendChild(container);

    // animate rows progressively
    const rowDelay = Math.max(20, Math.floor(stepDelay / 4));
    for (let tIdx = 0; tIdx < data.vocabulary.length; tIdx++) {
        const term = data.vocabulary[tIdx];
        const tr = document.createElement('tr');
        tr.className = 'matrix-row-anim';
        tr.style.animationDelay = `${tIdx * 0.02}s`;
        const tdTerm = document.createElement('td');
        tdTerm.textContent = term;
        tr.appendChild(tdTerm);
        for (let doc of data.docs) {
            const td = document.createElement('td');
            const val = doc.term_vector[tIdx];
            td.className = val ? 'text-cyan-400 font-bold' : 'text-slate-500';
            td.textContent = val;
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
        await sleep(rowDelay);
    }

    // Show success both top and bottom and set button state
    if (topSuccess) topSuccess.classList.remove('hidden');
    if (bottomSuccess) bottomSuccess.classList.remove('hidden');
    const prepareBtn = document.getElementById('prepareBtn');
    if (prepareBtn) {
        prepareBtn.disabled = true;
        prepareBtn.style.opacity = '0.6';
        prepareBtn.textContent = 'Prepared';
    }

    // store rendered matrix data so search can use it; matrixData already set by caller
}

function renderSearchResults(results) {
    const rDiv = document.getElementById("searchResults");
    rDiv.innerHTML = '';

    if(results.length === 0) {
        rDiv.innerHTML = '<p class="text-slate-400">No results found.</p>';
        return;
    }

    results.forEach(res => {
        const div = document.createElement("div");
        div.className = "glass-card p-4 mb-3 cursor-pointer hover:border-cyan-400 transition-colors";
        div.innerHTML = `
            <div class="flex justify-between items-center mb-2">
                <span class="font-bold text-cyan-300"><i class="fa-solid fa-file-lines mr-2"></i>${res.name}</span>
                <span class="text-sm bg-cyan-900 px-2 py-1 rounded">Score: ${res.score.toFixed(2)}</span>
            </div>
            <p class="text-sm text-slate-400 italic">"...${res.snippet}..."</p>
        `;
        div.addEventListener("click", () => openModal(res));
        rDiv.appendChild(div);
    });
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

function openModal(res) {
    document.getElementById("docModal").classList.add("active");
    document.getElementById("modalTitle").textContent = res.name;

    // Highlight matching tokens roughly
    let content = escapeHtml(res.doc.original_text);
    if(res.query_tokens && res.query_tokens.length > 0) {
        res.query_tokens.forEach(qt => {
            const regex = new RegExp(`\\b${qt}\\b`, 'gi');
            content = content.replace(regex, match => `<span class="highlight-match">${match}</span>`);
        });
    }
    document.getElementById("modalBody").innerHTML = content;
}

