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

    startBtn.addEventListener("click", async () => {
        if (isAnimating) return;

        const word1 = word1Input.value.trim();
        const word2 = word2Input.value.trim();

        if (!word1 || !word2) {
            alert("Please enter both words.");
            return;
        }

        if (methodSelect.value !== "edit_distance") {
            alert("Only Edit Distance is currently implemented.");
            return;
        }

        isAnimating = true;
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing...';

        vizContainer.innerHTML = "";
        explanationPanel.innerHTML = "Initializing matrix...";
        explanationPanel.style.opacity = 1;
        resultCard.style.display = "none";

        try {
            const response = await fetch("/api/spelling/edit_distance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ word1, word2 })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to process");

            await animateMatrix(data);

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

        resultText.textContent = final_distance;
        resultCard.style.display = "block";
    }
});
