// term_document.js

async function renderTDMVisualization(data, speedKey, skipSharedStages) {
    const stepDelay = window.getVisualizationDelay ? window.getVisualizationDelay(speedKey) : 900;

    const vMatrix = document.getElementById('v-matrix');
    const topSuccess = document.getElementById('v-success');
    const bottomSuccess = document.getElementById('v-success-bottom');

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    if (!skipSharedStages) {
        await (window.renderSharedStages
            ? window.renderSharedStages(data.docs, speedKey)
            : Promise.resolve());
    }

    // 3. Matrix Building
    const matTitle = document.createElement('h3');
    matTitle.className = 'text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8';
    matTitle.innerHTML = 'Term Document Matrix Construction <span class="text-sm font-normal text-slate-400 ml-2">(Binary weights)</span>';
    vMatrix.appendChild(matTitle);

    const wrap = document.createElement('div');
    wrap.className = 'overflow-x-auto';

    const table = document.createElement('table');
    table.className = 'w-full text-left text-sm border-collapse bg-slate-900/50 shadow-lg';

    // Header
    let thead = `<thead><tr class="bg-slate-800 text-slate-200 border-b border-slate-600">`;
    thead += `<th class="p-3 border-r border-slate-700 font-mono text-cyan-200 whitespace-nowrap">Term <span class="text-xs text-slate-500 normal-case">(${data.vocabulary.length})</span></th>`;

    const docNames = data.docs.map(d => {
        let n = d.name;
        if(n.length > 12) n = n.slice(0, 10) + '..';
        return n;
    });

    for(let docName of docNames) {
        thead += `<th class="p-3 text-center border-r border-slate-700 min-w-[80px]" title="${docName}">${docName}</th>`;
    }
    thead += `</tr></thead>`;
    table.innerHTML = thead;

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-700/50';
    table.appendChild(tbody);
    wrap.appendChild(table);
    vMatrix.appendChild(wrap);

    await sleep(stepDelay / 2);

    for (let termIdx = 0; termIdx < data.vocabulary.length; termIdx++) {
        const term = data.vocabulary[termIdx];
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50 transition-colors group';

        // term cell
        const tdTerm = document.createElement('td');
        tdTerm.className = 'p-2 pl-3 border-r border-slate-700 font-mono text-cyan-100 bg-slate-900/80 group-hover:bg-cyan-900/20';
        tdTerm.textContent = term;
        tr.appendChild(tdTerm);

        tbody.appendChild(tr);

        for (let docIdx = 0; docIdx < data.docs.length; docIdx++) {
            const tdDoc = document.createElement('td');
            tdDoc.className = 'p-2 text-center border-r border-slate-700/50 font-mono transition-all duration-300';

            const cellValue = data.docs[docIdx].term_vector[termIdx];

            if (cellValue > 0) {
                tdDoc.innerHTML = `<span class="bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded font-bold shadow-[0_0_8px_rgba(34,211,238,0.2)]">1</span>`;
            } else {
                tdDoc.innerHTML = `<span class="text-slate-600">0</span>`;
            }

            tr.appendChild(tdDoc);
        }

        if (data.vocabulary.length < 50) {
            await sleep(Math.max(stepDelay / 5, 20)); // faster for matrix rows
        } else if (termIdx % 5 === 0) {
            await sleep(10); // bulk render for large vocab
        }
    }

    if (topSuccess) topSuccess.classList.remove('hidden');
    if (bottomSuccess) bottomSuccess.classList.remove('hidden');
}

window.renderTDMVisualization = renderTDMVisualization;

window.getTDMAboutHTML = function() {
    return `
        <div class="space-y-6">
            <h3 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Term Document Matrix</h3>
            
            <div class="mb-6 max-w-2xl mx-auto border border-slate-700 rounded overflow-hidden bg-black">
               <iframe
                 class="w-full aspect-video"
                 src="https://www.youtube.com/embed/CRPoXUPeYtw?si=j8KZnTQELPT1SLW6"
                 title="Term Document Matrix Educational Video"
                 allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                 referrerpolicy="strict-origin-when-cross-origin"
                 allowfullscreen>
               </iframe>
            </div>
            
            <div class="glass-card p-6">
                <h4 class="text-xl font-semibold mb-3 text-cyan-300">What is a Term Document Matrix?</h4>
                <p class="text-slate-300 leading-relaxed mb-4">
                    A <strong>Term-Document Matrix (TDM)</strong> is a mathematical matrix that describes the frequency of terms that occur in a collection of documents. In this basic implementation, we use binary weights (1 or 0) to represent whether a term is present in a document.
                </p>
                <p class="text-slate-300 leading-relaxed">
                    The rows of the matrix correspond to documents, and the columns correspond to the terms in the vocabulary. 
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="glass-card p-5">
                    <h4 class="text-lg font-bold mb-2 text-purple-300"><i class="fa-solid fa-list-ol"></i> Boolean Retrieval</h4>
                    <p class="text-sm text-slate-300 leading-relaxed">
                        This simple TDM uses boolean weights (1 for presence, 0 for absence). This is the foundation of Boolean Information Retrieval models where queries are evaluated using set operations.
                    </p>
                </div>
                <div class="glass-card p-5">
                    <h4 class="text-lg font-bold mb-2 text-emerald-300"><i class="fa-solid fa-compress"></i> Sparsity</h4>
                    <p class="text-sm text-slate-300 leading-relaxed">
                        A typical Term-Document Matrix is highly sparse, meaning most entries are 0 because any single document only contains a small fraction of the total vocabulary.
                    </p>
                </div>
            </div>
        </div>
    `;
};
