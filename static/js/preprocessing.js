document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const clearBtn = document.getElementById('clear-btn');
    const inputText = document.getElementById('input-text');
    const visualizationContainer = document.getElementById('visualization-container');

    if (!startBtn) return;

    startBtn.addEventListener('click', async () => {
        const text = inputText.value.trim();
        if (!text) {
            alert('Please enter some text to preprocess.');
            return;
        }

        const operations = collectOperations();

        // Add loading state
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Processing...';
        visualizationContainer.innerHTML = '';

        try {
            const response = await fetch('/api/preprocess', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    operations: operations
                })
            });

            const data = await response.json();
            if (data.error) {
                alert(data.error);
                return;
            }

            const expandedSteps = normalizeVisualizationSteps(data.steps);
            renderVisualizationSteps(expandedSteps);
        } catch (error) {
            console.error('Error fetching preprocessing data:', error);
            alert('An error occurred during preprocessing.');
        } finally {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fa-solid fa-play mr-2"></i> Start';
        }
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            inputText.value = '';
            visualizationContainer.innerHTML = `
                <div class="viz-placeholder">
                    <i class="fa-solid fa-diagram-project text-cyan-500"></i>
                    <p>Enter text and click <strong>Start</strong> to visualize preprocessing.</p>
                </div>
            `;
            inputText.focus();
        });
    }

    const normParent = document.getElementById('cb-normalization');
    if (normParent) {
        const normChildren = [
            document.getElementById('cb-case_folding'),
            document.getElementById('cb-removing_special_characters'),
            document.getElementById('cb-expanding_contractions')
        ];

        normParent.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            normChildren.forEach(child => {
                if (child) {
                    child.disabled = !isChecked;
                    if (isChecked && !child.checked) {
                        child.checked = true;
                    }
                }
            });
        });

        normChildren.forEach(child => {
            if (child) {
                child.addEventListener('change', () => {
                   const anyChecked = normChildren.some(c => c && c.checked);
                   normParent.checked = anyChecked;
                });
            }
        });

        normParent.dispatchEvent(new Event('change'));
    }

    function collectOperations() {
        const getChecked = (id) => {
            const element = document.getElementById(id);
            return Boolean(element && element.checked);
        };

        return {
            tokenization: getChecked('cb-tokenization'),
            remove_stop_words: getChecked('cb-remove_stop_words'),
            normalization: {
                enabled: getChecked('cb-normalization'),
                case_folding: getChecked('cb-normalization') && getChecked('cb-case_folding'),
                removing_special_characters: getChecked('cb-normalization') && getChecked('cb-removing_special_characters'),
                expanding_contractions: getChecked('cb-normalization') && getChecked('cb-expanding_contractions')
            },
            stemming: getChecked('cb-stemming'),
            lemmatization: getChecked('cb-lemmatization')
        };
    }

    function normalizeVisualizationSteps(steps) {
        const normalized = [];

        steps.forEach((step) => {
            if (step.key === 'normalization') {
                const substeps = Array.isArray(step.substeps) ? step.substeps : [];
                substeps.forEach((substep) => {
                    normalized.push({
                        key: substep.key,
                        title: substep.title,
                        icon: substep.icon || 'fa-wand-magic-sparkles',
                        after: substep.after
                    });
                });
                return;
            }

            if (step.key !== 'final_output') {
                normalized.push(step);
            }
        });

        return normalized;
    }

    function formatTokenCount(value) {
        if (Array.isArray(value)) {
            return value.length;
        }
        if (typeof value !== 'string') {
            return null;
        }

        const tokens = value.match(/\b\w+\b/g);
        return tokens ? tokens.length : 0;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderTokensInline(tokens) {
        const pieces = tokens.map((token, idx) => {
            const comma = idx < tokens.length - 1 ? ',' : '';
            return `<span class="token">&quot;${escapeHtml(token)}&quot;${comma}</span>`;
        });

        return `<div class="token-line">[ ${pieces.join(' ')} ]</div>`;
    }

    function renderVisualizationSteps(steps) {
        // Determine speed settings from selector
        const speedSel = document.getElementById('viz-speed');
        const speed = speedSel ? (speedSel.value || 'medium') : 'medium';
        let delay = 0;
        let stepDelay = 700; // default medium
        let animMs = 350;
        if (speed === 'low') { stepDelay = 1200; animMs = 500; }
        if (speed === 'high') { stepDelay = 250; animMs = 180; }

        if (!steps.length) {
            visualizationContainer.innerHTML = `
                <div class="viz-placeholder">
                    <i class="fa-solid fa-circle-info text-cyan-500"></i>
                    <p>No steps to display. Select at least one operation.</p>
                </div>
            `;
            return;
        }

        steps.forEach((step, index) => {
            setTimeout(() => {
                const stepEl = document.createElement('div');
                stepEl.className = 'step-card step-enter';
                const tokenCount = formatTokenCount(step.after);
                const tokenMeta = tokenCount === null ? '' : `${tokenCount}`;

                const contentHtml = Array.isArray(step.after)
                    ? renderTokensInline(step.after)
                    : `<div>${escapeHtml(step.after)}</div>`;

                // description mapping for educational text (fallback to step.note)
                const descriptionMap = {
                    tokenization: 'Split the text into individual tokens.',
                    remove_stop_words: 'Removed common words that do not add important meaning.',
                    case_folding: 'Converted all words to lowercase.',
                    removing_special_characters: 'Removed punctuation and special symbols from the text.',
                    expanding_contractions: 'Expanded shortened words into their full forms.',
                    stemming: 'Reduced words to their root form.',
                    lemmatization: 'Converted words into their dictionary base form.'
                };

                const desc = descriptionMap[step.key] || step.note || '';

                stepEl.innerHTML = `
                    <div class="step-header" style="flex-direction:column; gap:0.5rem; align-items:stretch;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="step-left" style="display:flex;align-items:center;gap:.6rem;">
                          <i class="fa-solid ${step.icon} step-icon" aria-hidden="true"></i>
                          <span class="step-title">${escapeHtml(step.title)}</span>
                        </div>
                        <div class="step-right" style="display:flex;align-items:center;gap:.5rem;">
                          <span class="step-badge pill">Step ${index + 1}</span>
                          ${tokenMeta ? `<span class="tokens-badge">Tokens: ${tokenMeta}</span>` : ''}
                        </div>
                      </div>
                      ${desc ? `<div class="step-desc" style="color:var(--text-muted, #94a3b8); font-size:0.85rem; padding-left:1.8rem; margin-top:-0.2rem;">${escapeHtml(desc)}</div>` : ''}
                    </div>
                    <div class="step-content">
                        ${contentHtml}
                    </div>
                `;

                visualizationContainer.appendChild(stepEl);
                // set transition durations based on chosen speed
                stepEl.style.transition = `opacity ${animMs}ms ease, transform ${animMs}ms ease`;
                requestAnimationFrame(() => {
                    stepEl.classList.add('step-enter-visible');
                });
            }, delay);
            delay += stepDelay;
        });
    }
});
