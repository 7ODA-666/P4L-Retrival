// tfidf.js

window.renderTFIDFVisualization = async function (data, speedKey) {
    if (!data || !data.docs || !data.vocabulary || !data.idf) {
        console.error("Invalid TF-IDF data:", data);
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

    // Term Frequency (TF)
    const titleTF = document.createElement("h3");
    titleTF.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8";
    titleTF.innerHTML = "Term Frequency (TF) <span class='text-sm font-normal text-slate-400 block mt-1'>Formula: TF = 1 + log₁₀(count) if count > 0</span>";
    vMatrix.appendChild(titleTF);

    const tfWrapper = document.createElement("div");
    tfWrapper.className = "grid grid-cols-1 gap-4 text-sm";
    vMatrix.appendChild(tfWrapper);

    for (const doc of data.docs) {
        const tfCard = document.createElement("div");
        tfCard.className = "glass-card p-4 border border-purple-500/20 opacity-0 transform translate-y-2 transition-all duration-300";
        const tfTitle = document.createElement("h4");
        tfTitle.className = "font-bold text-purple-300 mb-2 truncate";
        tfTitle.textContent = doc.name;
        tfCard.appendChild(tfTitle);

        const tfContent = document.createElement("div");
        tfContent.className = "flex flex-wrap gap-2 font-mono text-xs";

        for (const [term, val] of Object.entries(doc.tf || {})) {
            const tfSpan = document.createElement("span");
            tfSpan.className = "bg-purple-900/30 text-purple-200 px-2 py-1 rounded border border-purple-800/50 block";
            tfSpan.innerHTML = `TF(${window.escapeHtml(term)}) = <br/> <b class="text-white">${val.toFixed(4)}</b>`;
            tfContent.appendChild(tfSpan);
        }

        tfCard.appendChild(tfContent);
        tfWrapper.appendChild(tfCard);

        await sleep(50);
        tfCard.classList.remove("opacity-0", "translate-y-2");
        await sleep(Math.max(100, delay / 2));
    }

    // Inverse Document Frequency (IDF)
    const titleIDF = document.createElement("h3");
    titleIDF.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8";
    titleIDF.innerHTML = "Inverse Document Frequency (IDF) <span class='text-sm font-normal text-slate-400 block mt-1'>Formula: IDF = log₁₀(Total Docs / Docs with Term)</span>";
    vMatrix.appendChild(titleIDF);

    const idfCard = document.createElement("div");
    idfCard.className = "glass-card p-4 border border-emerald-500/20 opacity-0 transform translate-y-2 transition-all duration-300";
    const idfContent = document.createElement("div");
    idfContent.className = "flex flex-wrap gap-2 font-mono text-xs";

    for (const [term, val] of Object.entries(data.idf || {})) {
        const idfSpan = document.createElement("span");
        idfSpan.className = "bg-emerald-900/30 text-emerald-200 px-2 py-1 rounded border border-emerald-800/50 block";
        idfSpan.innerHTML = `IDF(${window.escapeHtml(term)}) = <br/> <b class="text-white">${val.toFixed(4)}</b>`;
        idfContent.appendChild(idfSpan);
    }

    idfCard.appendChild(idfContent);
    vMatrix.appendChild(idfCard);

    await sleep(50);
    idfCard.classList.remove("opacity-0", "translate-y-2");
    await sleep(Math.max(200, delay / 2));


    // TF-IDF Matrix
    const titleMat = document.createElement("h3");
    titleMat.className = "text-xl font-bold mb-3 mt-8 border-t border-slate-700/50 pt-8 flex justify-between items-center";
    titleMat.innerHTML = `<div><span>TF-IDF Weight Matrix</span><span class='text-sm font-normal text-slate-400 block mt-1'>Formula: TF-IDF = TF × IDF</span></div> <span class="text-sm font-normal text-slate-400 text-right">Rows: Documents<br>Cols: Terms</span>`;
    vMatrix.appendChild(titleMat);

    const tableWrapper = document.createElement("div");
    tableWrapper.className = "overflow-x-auto glass-card rounded-lg border border-slate-700/50 custom-scrollbar-table";

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
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-800/50 transition-colors border-b border-slate-800 last:border-0 opacity-0 transform translate-y-2 transition-all duration-300";

        const docTd = document.createElement("td");
        docTd.className = "p-3 font-semibold text-cyan-300 border-r border-slate-800 sticky left-0 bg-slate-900/90 backdrop-blur-sm z-10";
        docTd.textContent = doc.name;
        row.appendChild(docTd);

        data.vocabulary.forEach((term, idx) => {
            const td = document.createElement("td");
            td.className = "p-3 border-l border-slate-800 text-center";
            const val = doc.tfidf_vector[idx];

            if (val > 0) {
                td.innerHTML = `<span class="bg-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded font-mono border border-cyan-800/50">${val.toFixed(4)}</span>`;
            } else {
                td.innerHTML = `<span class="text-slate-600 font-mono">0.0000</span>`;
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
        bottomMsg.innerHTML = '<i class="fa-solid fa-circle-check"></i> TF-IDF Weight Matrix Ready — You can now search.';
        bottomMsg.classList.remove("hidden");
    }
};

window.getTFIDFAboutHTML = function() {
    return `
    <div class="space-y-6">
        <h3 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">TF-IDF Weight Matrix</h3>

        <div class="mb-6 max-w-2xl mx-auto border border-slate-700 rounded overflow-hidden bg-black">
           <iframe
             class="w-full aspect-video"
             src="https://www.youtube.com/embed/qxFT1TMdcAQ?si=_AD3NHUDKq9gyzKz"
             title="TF-IDF Educational Video"
             allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
             referrerpolicy="strict-origin-when-cross-origin"
             allowfullscreen>
           </iframe>
        </div>

        <div class="glass-card p-6">
            <h4 class="text-xl font-semibold mb-3 text-cyan-300">What is TF-IDF?</h4>
            <p class="text-slate-300 leading-relaxed mb-4">
                <strong>TF-IDF (Term Frequency - Inverse Document Frequency)</strong> is a numerical statistic that reflects how important a word is to a document in a collection or corpus. It is often used as a weighting factor in searches of information retrieval, text mining, and user modeling.
            </p>
            <p class="text-slate-300 leading-relaxed">
                The TF-IDF value increases proportionally to the number of times a word appears in the document and is offset by the number of documents in the corpus that contain the word. This helps to adjust for the fact that some words appear more frequently in general.
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-purple-300"><i class="fa-solid fa-chart-bar"></i> TF (Term Frequency)</h4>
                <p class="text-sm text-slate-300 leading-relaxed mb-3">
                    Measures how frequently a term occurs in a document. To prevent bias towards terms occurring very frequently, we apply Logarithmic Normalization.
                </p>
                <div class="p-3 bg-slate-900 rounded font-mono text-xs text-purple-200">
                    TF(t) = 1 + log₁₀(Count of t in doc) (if Count > 0)
                </div>
            </div>
            <div class="glass-card p-5">
                <h4 class="text-lg font-bold mb-2 text-emerald-300"><i class="fa-solid fa-chart-line"></i> IDF (Inverse Document Frequency)</h4>
                <p class="text-sm text-slate-300 leading-relaxed mb-3">
                    Measures how important a term is. While computing TF, all terms are considered equally important. However, certain terms (like "is", "of") may appear lots of times but have little importance. IDF weighs down the frequent terms while scaling up the rare ones.
                </p>
                <div class="p-3 bg-slate-900 rounded font-mono text-xs text-emerald-200">
                    IDF(t) = log₁₀(Total documents / Docs containing t)
                </div>
            </div>
        </div>

        <div class="glass-card p-6 border-l-4 border-l-cyan-500">
            <h4 class="text-xl font-semibold mb-3 text-cyan-300">Evaluating Importance</h4>
            <p class="text-slate-300 leading-relaxed mb-3">
                The overall TF-IDF weight is the product of TF and IDF. Important terms get higher weights, improving search relevance.
            </p>
            <div class="p-3 bg-slate-900 rounded font-mono text-xs text-blue-200 text-center mb-3">
                TF-IDF = TF × IDF
            </div>
            
            <h4 class="text-xl font-semibold mt-6 mb-3 text-purple-300">Searching with Cosine Similarity</h4>
            <p class="text-slate-300 leading-relaxed mb-3">
                When searching, the query is vectorized similarly to the documents. The <strong>Cosine Similarity</strong> between the query vector (A) and document vector (B) is calculated to determine rank. Cosine similarity measures the cosine of the angle between the two vectors, which represents how closely they point in the same direction in the feature space.
            </p>
            <div class="p-3 bg-slate-900 rounded font-mono text-xs text-purple-200 text-center">
                Cosine Similarity = (A · B) / (|A| × |B|)
            </div>
        </div>
    </div>
    `;
};
