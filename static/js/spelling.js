document.addEventListener("DOMContentLoaded", () => {
    const word1Input = document.getElementById("word1-input");
    const word2Input = document.getElementById("word2-input");
    const methodSelect = document.getElementById("method-select");
    const startBtn = document.getElementById("start-btn");
    const speedSelect = document.getElementById("viz-speed");

    const vizContainer = document.getElementById("visualization-container");
    const explanationPanel = document.getElementById("explanation-panel");
    const resultCard = document.getElementById("result-card");
    const resultText = document.getElementById("result-text");

    let isAnimating = false;
    let abortController = null;

    const getSpeedMs = () => {
        const speed = speedSelect.value;
        if (speed === "low") return 1200;
        if (speed === "high") return 300;
        return 700; // medium
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    methodSelect.addEventListener("change", () => {
        const vizTitle = document.getElementById("viz-title");
        const vizSubtitle = document.getElementById("viz-subtitle");

        if (methodSelect.value === "edit_distance") {
            vizTitle.textContent = "Edit Distance Matrix Construction";
            vizSubtitle.textContent = "Values are calculated in real time.";
            explanationPanel.style.display = "flex";
        } else if (methodSelect.value === "jaccard") {
            vizTitle.textContent = "Jaccard Coefficient Calculation";
            vizSubtitle.textContent = "Comparing bigrams for similarity.";
            explanationPanel.style.display = "none"; // Hide panel for Jaccard
        } else if (methodSelect.value === "soundex") {
            vizTitle.textContent = "Soundex Algorithm Processing";
            vizSubtitle.textContent = "Encoding words for phonetic similarity.";
            explanationPanel.style.display = "none"; // Hide panel for Soundex
        }

        vizContainer.innerHTML = `
            <div class="text-center text-slate-500 dark:text-slate-400 mt-10">
              <i class="fa-solid fa-play text-4xl mb-3 text-cyan-500/50"></i>
              <p>Enter two words and click <strong>Start Visualization</strong>.</p>
            </div>
        `;
        explanationPanel.style.opacity = 0;
        resultCard.style.display = "none";
    });

    startBtn.addEventListener("click", async () => {
        if (isAnimating) return;

        const word1 = word1Input.value.trim();
        const word2 = word2Input.value.trim();

        if (!word1 || !word2) {
            alert("Please enter both words.");
            return;
        }

        isAnimating = true;
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing...';

        vizContainer.innerHTML = "";

        const method = methodSelect.value;
        if (method !== "jaccard" && method !== "soundex") {
            explanationPanel.style.display = "flex";
            explanationPanel.innerHTML = "Initializing...";
            explanationPanel.style.opacity = 1;
        } else {
            explanationPanel.style.display = "none";
        }
        resultCard.style.display = "none";

        try {
            const endpoint = `/api/spelling/${method}`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ word1, word2 })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to process");

            if (method === "edit_distance") {
                await animateMatrix(data);
            } else if (method === "jaccard") {
                await animateJaccard(data);
            } else if (method === "soundex") {
                await animateSoundex(data);
            }

        } catch (err) {
            vizContainer.innerHTML = `<div class="text-red-400 p-4">${err.message}</div>`;
        } finally {
            isAnimating = false;
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play mr-2"></i> Start Visualization';
        }
    });

    async function animateMatrix(data) {
        const { word1, word2, matrix, steps, final_distance } = data;
        const m = word1.length;
        const n = word2.length;

        const table = document.createElement("table");
        table.className = "edit-distance-matrix";

        // Create header row (empty cell, empty cell, then word2 chars)
        const thead = document.createElement("thead");
        const trHead = document.createElement("tr");
        trHead.appendChild(document.createElement("th"));
        const thHash = document.createElement("th");
        thHash.textContent = "#";
        trHead.appendChild(thHash);

        for (let j = 0; j < n; j++) {
            const th = document.createElement("th");
            th.textContent = word2[j];
            trHead.appendChild(th);
        }
        thead.appendChild(trHead);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        const cells = [];

        // Create matrix rows
        for (let i = 0; i <= m; i++) {
            const tr = document.createElement("tr");

            // Left character column
            const th = document.createElement("th");
            if (i === 0) th.textContent = "#";
            else th.textContent = word1[i - 1];
            tr.appendChild(th);

            cells[i] = [];

            for (let j = 0; j <= n; j++) {
                const td = document.createElement("td");
                td.className = "matrix-cell";
                td.id = `cell-${i}-${j}`;

                const info = document.createElement("div");
                info.className = "cell-info";
                info.innerHTML = `
                    <div class="cell-info-top">
                        <span class="sub-val" title="Substitution value" id="sub-${i}-${j}"></span>
                        <span class="del-val" title="Deletion value" id="del-${i}-${j}"></span>
                    </div>
                    <div class="cell-info-bottom">
                        <span class="ins-val" title="Insertion value" id="ins-${i}-${j}"></span>
                        <span></span>
                    </div>
                `;

                const mainVal = document.createElement("div");
                mainVal.className = "cell-main-val";
                mainVal.id = `val-${i}-${j}`;

                td.appendChild(info);
                td.appendChild(mainVal);
                tr.appendChild(td);
                cells[i][j] = td;
            }
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);

        const matrixContainer = document.createElement("div");
        matrixContainer.className = "matrix-container";
        matrixContainer.appendChild(table);
        vizContainer.appendChild(matrixContainer);

        // Initialize row 0 and col 0
        explanationPanel.innerHTML = "Filling initial row and column based on base penalty for empty strings.";
        for (let i = 0; i <= m; i++) {
            document.getElementById(`val-${i}-0`).textContent = i;
            cells[i][0].classList.add("filled");
        }
        for (let j = 0; j <= n; j++) {
            document.getElementById(`val-0-${j}`).textContent = j;
            cells[0][j].classList.add("filled");
        }

        await delay(getSpeedMs());

        // Animate steps
        for (const step of steps) {
            const { i, j, char1, char2, chars_match, sub_val, del_val, ins_val, min_val } = step;
            const currentSpeed = getSpeedMs();

            const cell = cells[i][j];
            cell.classList.add("active");

            document.getElementById(`sub-${i}-${j}`).textContent = sub_val;
            document.getElementById(`del-${i}-${j}`).textContent = del_val;
            document.getElementById(`ins-${i}-${j}`).textContent = ins_val;

            if (min_val === sub_val) document.getElementById(`sub-${i}-${j}`).classList.add("highlight");
            else if (min_val === del_val) document.getElementById(`del-${i}-${j}`).classList.add("highlight");
            else if (min_val === ins_val) document.getElementById(`ins-${i}-${j}`).classList.add("highlight");

            let exp = `Comparing '<b>${char1}</b>' and '<b>${char2}</b>'.<br>`;
            if (chars_match) {
                exp += `Characters match (cost 0).<br>`;
            } else {
                exp += `Characters differ (cost 1).<br>`;
            }
            exp += `Min(Sub: ${sub_val}, Del: ${del_val}, Ins: ${ins_val}) = <b>${min_val}</b>`;

            if (explanationPanel.innerHTML.includes("Initializing") || explanationPanel.innerHTML.includes("Filling")) {
                explanationPanel.innerHTML = "";
            }
            explanationPanel.innerHTML += `<div class="step-log">${exp}</div>`;
            explanationPanel.scrollTop = explanationPanel.scrollHeight;

            document.getElementById(`val-${i}-${j}`).textContent = min_val;
            cell.classList.add("filled");

            await delay(currentSpeed);
            cell.classList.remove("active");
        }

        // Show result
        cells[m][n].classList.add("final-path");
        explanationPanel.innerHTML += `<div class="step-log" style="border-left-color: #a855f7;">Matrix completed! The bottom-right cell contains the final Edit Distance.</div>`;
        explanationPanel.scrollTop = explanationPanel.scrollHeight;

        resultCard.innerHTML = `
            <h3>Result</h3>
            <p>Minimum Changes Required = <span>${final_distance}</span></p>
        `;
        resultCard.style.display = "block";
    }

    async function animateJaccard(data) {
        const { word1, word2, bigrams1, bigrams2, shared, jaccard } = data;
        let pSpeed = getSpeedMs();
        
        vizContainer.innerHTML = "";
        
        const renderBigramChips = (arr) => {
            if (arr.length === 0) return `<span class="text-slate-500 italic">None</span>`;
            return `<div class="bigram-container mt-2">` + 
                arr.map(b => `<span class="chip">"${b}"</span>`).join("") + 
                `</div>`;
        };

        const createStepCard = (number, title, desc, content) => {
            const card = document.createElement("div");
            card.className = "bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 mb-4 shadow-lg flex items-start gap-4 step-card";
            card.style.opacity = "0";
            card.style.animation = "slideIn 0.5s ease-out forwards";
            card.innerHTML = `
                <div class="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">${number}</div>
                <div class="w-full">
                    <h3 class="text-base font-bold text-slate-200">${title}</h3>
                    <p class="text-sm text-slate-400 mb-3">${desc}</p>
                    ${content}
                </div>
            `;
            return card;
        };

        // Step 1
        let card1 = createStepCard(1, `First Word Bigrams (${bigrams1.length})`, `Generated consecutive 2-character pairs from the first word '<b>${word1}</b>'.`, renderBigramChips(bigrams1));
        vizContainer.appendChild(card1);
        await delay(pSpeed * 1.5);
        
        // Step 2
        let card2 = createStepCard(2, `Second Word Bigrams (${bigrams2.length})`, `Generated consecutive 2-character pairs from the second word '<b>${word2}</b>'.`, renderBigramChips(bigrams2));
        vizContainer.appendChild(card2);
        await delay(pSpeed * 1.5);
        
        // Step 3
        let card3 = createStepCard(3, `Shared Bigrams (${shared.length})`, `Identified common bigrams shared between both words.`, renderBigramChips(shared));
        vizContainer.appendChild(card3);
        await delay(pSpeed * 1.5);

        // Step 4 & 5
        const num = shared.length;
        const den = bigrams1.length + bigrams2.length - num;
        
        const formulaHtml = `
                <div class="formula-card">
                    Jaccard Coefficient = 
                    <div class="formula-fraction">
                        <span class="formula-num">${num} (Shared)</span>
                        <span class="formula-den">${bigrams1.length} + ${bigrams2.length} - ${num} (Total Unique)</span>
                    </div>
                    = ${num} / ${den} = <strong>${jaccard}</strong>
                </div>
        `;
        
        let card4 = createStepCard(4, `Calculation`, `Substituting values into the Jaccard Coefficient formula.`, formulaHtml);
        vizContainer.appendChild(card4);
        await delay(pSpeed);

        // Final result
        const perc = (jaccard * 100).toFixed(2);
        resultCard.innerHTML = `
            <h3>Result</h3>
            <p>Similarity Percentage = <span>${perc}%</span></p>
            <div class="sim-progress-container">
                <div class="sim-progress-bar" style="width: ${perc}%"></div>
            </div>
        `;
        resultCard.style.display = "block";
    }

    async function animateSoundex(data) {
        const { word1, word2, steps1, steps2, match } = data;
        let pSpeed = getSpeedMs();

        vizContainer.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="soundex-grid"></div>';
        const grid = document.getElementById("soundex-grid");

        const col1 = document.createElement("div");
        const col2 = document.createElement("div");
        grid.appendChild(col1);
        grid.appendChild(col2);

        const createColStepCard = (colEl, number, title, desc, content) => {
            const card = document.createElement("div");
            card.className = "bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 mb-4 shadow-lg";
            card.style.opacity = "0";
            card.style.animation = "slideIn 0.5s ease-out forwards";
            card.innerHTML = `
                <div class="flex items-start gap-3 mb-3">
                    <div class="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm">${number}</div>
                    <div>
                        <h4 class="text-sm font-bold text-slate-200">${title}</h4>
                        <p class="text-xs text-slate-400 mt-1">${desc}</p>
                    </div>
                </div>
                <div class="bg-slate-900/40 p-3 rounded-lg border border-slate-600/30 font-mono text-sm text-cyan-300">
                    ${content}
                </div>
            `;
            colEl.appendChild(card);
        };

        const renderStepCards = async (col, word, stepsInfo, label) => {
            col.innerHTML = `<h3 class="text-base font-bold text-slate-300 mb-4 pb-2 border-b border-slate-700">${label}</h3>`;

            createColStepCard(col, 1, "Keep First Letter", "Preserve the first letter.", stepsInfo.step2_keep_first);
            await delay(pSpeed);

            const detailsHtml = stepsInfo.step3_details.map(d => `<div class="text-xs text-slate-300">${d}</div>`).join("");
            createColStepCard(col, 2, "Map Consonants", "Convert each letter to phonetic digit.", `<div class="space-y-1">${detailsHtml}</div><div class="border-t border-slate-600/50 mt-2 pt-2 text-emerald-400 font-bold">${stepsInfo.step3_mapped}</div>`);
            await delay(pSpeed);

            createColStepCard(col, 3, "Remove Duplicates", "Collapse adjacent same digits.", stepsInfo.step4_no_dups);
            await delay(pSpeed);

            createColStepCard(col, 4, "Remove Zeros", "Strip vowel placeholders.", stepsInfo.step5_no_zeros);
            await delay(pSpeed);

            createColStepCard(col, 5, "Final Code", "Pad/truncate to 4 chars.", `<span class="text-emerald-400 font-bold text-lg">${stepsInfo.step6_final}</span>`);
            await delay(pSpeed);
        };

        await renderStepCards(col1, word1, steps1, `Word 1: ${word1}`);
        await renderStepCards(col2, word2, steps2, `Word 2: ${word2}`);

        let resMessage = match ?
            "The two words are phonetically similar." :
            "The two words are NOT phonetically similar.";

        let resColor = match ? "text-emerald-400" : "text-rose-400";
        let cardColor = match ? "rgba(16, 185, 129, 0.05)" : "rgba(244, 63, 94, 0.05)";
        let cardBorder = match ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)";

        resultCard.style.background = cardColor;
        resultCard.style.borderColor = cardBorder;
        resultCard.style.boxShadow = `0 0 20px ${cardColor}`;

        resultCard.innerHTML = `
            <h3>Result</h3>
            <div class="flex justify-center items-center gap-4 my-3">
                <span class="soundex-box">${steps1.step6_final}</span>
                <span class="font-bold text-xl ${resColor}">${match ? "=" : "≠"}</span>
                <span class="soundex-box">${steps2.step6_final}</span>
            </div>
            <p class="text-lg mt-2 ${resColor}">${resMessage}</p>
        `;
        resultCard.style.display = "block";
    }
});
