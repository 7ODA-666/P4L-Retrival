// P4L Retrieval frontend interactions

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const darkIcon = document.querySelector('.theme-icon-dark');
  const lightIcon = document.querySelector('.theme-icon-light');
  const mobileMenuButton = document.getElementById('mobileMenuButton');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = Array.from(document.querySelectorAll('[data-nav-link]'));
  const tabButtons = Array.from(document.querySelectorAll('[data-right-tab]'));
  const tabPanels = Array.from(document.querySelectorAll('[data-right-panel]'));
  const preprocessForm = document.getElementById('preprocessForm');
  const preprocessInput = document.getElementById('preprocessInput');
  const startButton = document.querySelector('[data-preprocess-start]');
  const resetButton = document.querySelector('[data-preprocess-reset]');
  const resultContainer = document.getElementById('preprocessResults');
  const emptyState = document.getElementById('preprocessEmptyState');
  const outputMeta = document.getElementById('preprocessOutputMeta');
  const normalizationParent = document.querySelector('[data-normalization-parent]');
  const normalizationChildren = Array.from(document.querySelectorAll('[data-normalization-child]'));
  const operationCheckboxes = Array.from(document.querySelectorAll('[data-operation]'));

  const defaultState = {
    text: preprocessInput?.value ?? '',
    operations: operationCheckboxes.reduce((acc, checkbox) => {
      acc[checkbox.dataset.operation] = checkbox.checked;
      return acc;
    }, {}),
    normalization: normalizationChildren.reduce((acc, checkbox) => {
      acc[checkbox.dataset.normalizationChild] = checkbox.checked;
      return acc;
    }, {}),
  };

  const safeStorage = {
    get(key, fallback) {
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Ignore storage failures in restricted environments.
      }
    },
  };

  const setTheme = (mode) => {
    const isLight = mode === 'light';
    root.classList.toggle('light', isLight);
    root.classList.toggle('dark', !isLight);
    safeStorage.set('p4l-theme', mode);

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isLight));
    }

    darkIcon?.classList.toggle('hidden', isLight);
    lightIcon?.classList.toggle('hidden', !isLight);
  };

  const toggleMobileMenu = (open) => {
    if (!mobileMenu || !mobileMenuButton) return;
    const shouldOpen = typeof open === 'boolean' ? open : mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden', !shouldOpen);
    mobileMenuButton.setAttribute('aria-expanded', String(shouldOpen));
    mobileMenuButton.innerHTML = shouldOpen
      ? '<i class="fa-solid fa-xmark"></i>'
      : '<i class="fa-solid fa-bars"></i>';
  };

  const activateTabs = (tabId) => {
    tabButtons.forEach((button) => {
      const isActive = button.dataset.rightTab === tabId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.rightPanel === tabId);
    });
  };

  const formatValue = (value) => {
    if (Array.isArray(value)) {
      return escapeHtml(`[${value.join(', ')}]`);
    }

    if (value === null || value === undefined) {
      return '';
    }

    return escapeHtml(String(value)).replace(/\n/g, '<br>');
  };

  const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const syncNormalizationChildren = (checked) => {
    normalizationChildren.forEach((child) => {
      child.checked = checked;
    });
    syncNormalizationParent();
  };

  const syncNormalizationParent = () => {
    if (!normalizationParent || normalizationChildren.length === 0) return;
    const checkedCount = normalizationChildren.filter((child) => child.checked).length;
    normalizationParent.checked = checkedCount === normalizationChildren.length;
    normalizationParent.indeterminate = checkedCount > 0 && checkedCount < normalizationChildren.length;
  };

  const collectOperations = () => ({
    tokenization: preprocessForm?.querySelector('[data-operation="tokenization"]')?.checked ?? true,
    remove_stop_words: preprocessForm?.querySelector('[data-operation="remove_stop_words"]')?.checked ?? true,
    normalization: {
      enabled: normalizationParent?.checked || normalizationParent?.indeterminate || false,
      case_folding: preprocessForm?.querySelector('[data-normalization-child="case_folding"]')?.checked ?? true,
      removing_special_characters: preprocessForm?.querySelector('[data-normalization-child="removing_special_characters"]')?.checked ?? true,
      expanding_contractions: preprocessForm?.querySelector('[data-normalization-child="expanding_contractions"]')?.checked ?? true,
    },
    stemming: preprocessForm?.querySelector('[data-operation="stemming"]')?.checked ?? true,
    lemmatization: preprocessForm?.querySelector('[data-operation="lemmatization"]')?.checked ?? true,
  });

  const buildStepCard = (step, index) => {
    const card = document.createElement('article');
    card.className = `pipeline-card preprocess-result-card ${index === 0 ? 'pipeline-card-primary' : ''} ${step.key === 'final_output' ? 'pipeline-card-final' : ''}`.trim();
    card.style.setProperty('--card-delay', `${index * 90}ms`);

    const chipLabel = step.implicit ? 'Implicit' : `Stage ${String(index).padStart(2, '0')}`;

    const substepColumns = Math.min(step.substeps?.length || 0, 3) || 1;
    const substeps = Array.isArray(step.substeps) && step.substeps.length > 0
      ? `<div class="mt-4 grid gap-3" style="grid-template-columns: repeat(${substepColumns}, minmax(0, 1fr));">${step.substeps.map((substep) => `
          <div class="mini-board">
            <p class="result-value-label"><i class="fa-solid ${substep.icon || 'fa-circle-nodes'}"></i> ${escapeHtml(substep.title)}</p>
            <div class="grid gap-2">
              <div>
                <span class="result-value-label">Before</span>
                <strong>${formatValue(substep.before_display ?? substep.before)}</strong>
              </div>
              <div>
                <span class="result-value-label">After</span>
                <strong>${formatValue(substep.after_display ?? substep.after)}</strong>
              </div>
            </div>
          </div>`).join('')}</div>`
      : '';

    card.innerHTML = `
      <div class="pipeline-card-top">
        <div class="pipeline-icon"><i class="fa-solid ${escapeHtml(step.icon || 'fa-layer-group')}"></i></div>
        <div>
          <h4>${escapeHtml(step.title)}</h4>
          <p>${escapeHtml(step.note || 'Processing step in the current pipeline.')}</p>
        </div>
        <span class="stage-chip">${chipLabel}</span>
      </div>
      <div class="mini-split mt-4">
        <div class="result-before">
          <span class="result-value-label">Before</span>
          <strong>${formatValue(step.before_display ?? step.before)}</strong>
        </div>
        <div class="result-after">
          <span class="result-value-label">After</span>
          <strong>${formatValue(step.after_display ?? step.after)}</strong>
        </div>
      </div>
      ${substeps}
    `;

    if (step.implicit) {
      card.style.opacity = '0.92';
    }

    return card;
  };

  const renderResults = (data) => {
    if (!resultContainer || !emptyState || !outputMeta) return;

    emptyState.classList.add('hidden');
    resultContainer.classList.remove('hidden');
    resultContainer.innerHTML = '';

    const summary = data.summary || {};
    outputMeta.innerHTML = `
      <div class="mini-metric">
        <span class="mini-metric-label">Status</span>
        <strong>Processed successfully</strong>
      </div>
      <div class="mini-metric">
        <span class="mini-metric-label">Steps</span>
        <strong>${summary.steps_executed ?? data.steps?.length ?? 0}</strong>
      </div>
      <div class="mini-metric">
        <span class="mini-metric-label">Final tokens</span>
        <strong>${summary.token_count ?? 0}</strong>
      </div>
    `;

    (data.steps || []).forEach((step, index) => {
      resultContainer.appendChild(buildStepCard(step, index));
    });
  };

  const renderEmptyState = (title, message) => {
    if (!resultContainer || !emptyState || !outputMeta) return;

    emptyState.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    resultContainer.innerHTML = '';
    outputMeta.innerHTML = `
      <div class="mini-metric">
        <span class="mini-metric-label">Status</span>
        <strong>Awaiting input</strong>
      </div>
      <div class="mini-metric">
        <span class="mini-metric-label">Pipeline</span>
        <strong>Original → Final</strong>
      </div>
      <div class="mini-metric">
        <span class="mini-metric-label">Mode</span>
        <strong>Visualization tab</strong>
      </div>
    `;

    if (title) {
      emptyState.querySelector('h3').textContent = title;
    }
    if (message) {
      emptyState.querySelector('p').textContent = message;
    }
  };

  const setButtonLoading = (isLoading) => {
    if (!startButton) return;

    if (isLoading) {
      startButton.dataset.originalHtml = startButton.innerHTML;
      startButton.disabled = true;
      startButton.classList.add('opacity-90', 'cursor-wait');
      startButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
      return;
    }

    startButton.disabled = false;
    startButton.classList.remove('opacity-90', 'cursor-wait');
    startButton.innerHTML = startButton.dataset.originalHtml || '<i class="fa-solid fa-play"></i> Start Preprocessing';
  };

  const resetForm = () => {
    if (preprocessInput) {
      preprocessInput.value = defaultState.text;
      preprocessInput.focus();
    }

    operationCheckboxes.forEach((checkbox) => {
      checkbox.checked = defaultState.operations[checkbox.dataset.operation] ?? true;
    });

    normalizationChildren.forEach((checkbox) => {
      checkbox.checked = defaultState.normalization[checkbox.dataset.normalizationChild] ?? true;
    });

    if (normalizationParent) {
      normalizationParent.checked = true;
      normalizationParent.indeterminate = false;
    }

    syncNormalizationParent();
    activateTabs('visualization');
    renderEmptyState('Run preprocessing to generate the timeline', 'Cards will appear here with before/after states, smooth transitions, and a glowing workflow connection.');
  };

  const preprocess = async () => {
    if (!preprocessInput) return;

    const text = preprocessInput.value.trim();
    if (!text) {
      renderEmptyState('Please enter some text first', 'The visualization tab needs input text before it can render the preprocessing workflow.');
      activateTabs('visualization');
      return;
    }

    setButtonLoading(true);
    activateTabs('visualization');

    try {
      const response = await fetch('/api/preprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, operations: collectOperations() }),
      });

      const data = await response.json();
      if (!response.ok) {
        renderEmptyState('Something went wrong', data.error || 'Preprocessing failed.');
        return;
      }

      renderResults(data);
    } catch (error) {
      renderEmptyState('Something went wrong', error.message || 'Unable to process the request right now.');
    } finally {
      setButtonLoading(false);
    }
  };

  // Theme persistence
  setTheme(safeStorage.get('p4l-theme', 'dark'));

  themeToggle?.addEventListener('click', () => {
    const nextTheme = root.classList.contains('light') ? 'dark' : 'light';
    setTheme(nextTheme);
  });

  // Right panel tabs
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => activateTabs(button.dataset.rightTab));
  });

  // Nav interactions
  navLinks.forEach((link) => {
    link.addEventListener('click', () => toggleMobileMenu(false));
  });

  mobileMenuButton?.addEventListener('click', () => toggleMobileMenu());

  // Preprocessing controls
  startButton?.addEventListener('click', preprocess);
  resetButton?.addEventListener('click', resetForm);

  preprocessForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    preprocess();
  });

  normalizationParent?.addEventListener('change', () => {
    syncNormalizationChildren(Boolean(normalizationParent.checked));
  });

  normalizationChildren.forEach((child) => {
    child.addEventListener('change', syncNormalizationParent);
  });

  // Activate defaults when the preprocessing page is loaded.
  if (tabButtons.length > 0 && tabPanels.length > 0) {
    activateTabs('visualization');
  }

  if (resultContainer && emptyState && outputMeta) {
    renderEmptyState('Run preprocessing to generate the timeline', 'Cards will appear here with before/after states, smooth transitions, and a glowing workflow connection.');
  }

  // Close the menu when the viewport grows to desktop width.
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      toggleMobileMenu(false);
    }
  });
});

// Scroll to top button functionality
document.addEventListener('DOMContentLoaded', () => {
  const scrollBtn = document.getElementById('scrollToTop');

  if (!scrollBtn) return;

  // Show/hide button based on scroll position
  window.addEventListener('scroll', () => {
    const shouldShow = window.scrollY > 300;
    scrollBtn.classList.toggle('show', shouldShow);
  });

  // Scroll to top on click
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
});

