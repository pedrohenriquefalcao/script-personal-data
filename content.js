(() => {
  'use strict';

  // Evita execução em iframes (mantém um único botão flutuante na página principal)
  if (window.self !== window.top) return;

  // Evita injeção duplicada
  if (document.getElementById('autofill-vagas-root')) return;

  const STORAGE_KEY = 'autofill_vagas_profile';

  const FIELDS = [
    { key: 'fullName', label: 'Nome completo', placeholder: 'Ex: Ana Silva', type: 'text' },
    { key: 'email', label: 'E-mail', placeholder: 'Ex: ana@email.com', type: 'email' },
    { key: 'phone', label: 'Telefone com DDD', placeholder: 'Ex: (11) 99999-9999', type: 'tel' },
    { key: 'linkedin', label: 'LinkedIn', placeholder: 'Ex: https://linkedin.com/in/anasilva', type: 'url' },
    { key: 'github', label: 'GitHub', placeholder: 'Ex: https://github.com/anasilva', type: 'url' },
    { key: 'portfolio', label: 'Portfólio/Site', placeholder: 'Ex: https://anasilva.dev', type: 'url' },
    { key: 'city', label: 'Cidade', placeholder: 'Ex: São Paulo', type: 'text', rowGroup: 'location' },
    { key: 'state', label: 'Estado', placeholder: 'Ex: SP', type: 'text', rowGroup: 'location' },
    { key: 'country', label: 'País', placeholder: 'Ex: Brasil', type: 'text' },
    { key: 'salary', label: 'Pretensão Salarial', placeholder: 'Ex: R$ 8.500', type: 'text' }
  ];

  const IGNORED_INPUT_TYPES = new Set([
    'hidden',
    'file',
    'radio',
    'checkbox',
    'submit',
    'button',
    'reset',
    'image',
    'color',
    'range'
  ]);

  const NAME_EXCLUSION_PATTERNS = [
    /\b(empresa|company|organizacao|organization|empregador|employer)\b/,
    /\b(escola|school|faculdade|college|universidade|university|instituicao|institution)\b/,
    /\b(curso|course|formacao|degree|cargo|role|posicao|position|vaga|job|titulo|title)\b/,
    /\b(usuario|username|user|login|apelido|nickname|handle)\b/,
    /\b(projeto|project|arquivo|file|cartao|card|banco|bank)\b/,
    /\b(emergencia|emergency|contato de emergencia|pai|mae|mother|father|conjuge|spouse)\b/,
    /\b(referencia|reference|indicacao|referral|recrutador|recruiter)\b/
  ];

  // =========================================================================
  // Storage Cross-Browser (Chrome, Edge, Brave e Firefox MV3)
  // =========================================================================

  function getStorageArea() {
    if (typeof browser !== 'undefined' && browser.storage && browser.storage.local) {
      return browser.storage.local;
    }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    return null;
  }

  function loadProfile() {
    return new Promise((resolve) => {
      const storage = getStorageArea();
      if (!storage) {
        resolve({});
        return;
      }

      try {
        const result = storage.get(STORAGE_KEY, (items) => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve((items && items[STORAGE_KEY]) || {});
        });

        if (result && typeof result.then === 'function') {
          result
            .then((items) => resolve((items && items[STORAGE_KEY]) || {}))
            .catch(() => resolve({}));
        }
      } catch (_err) {
        resolve({});
      }
    });
  }

  function saveProfile(profile) {
    return new Promise((resolve, reject) => {
      const storage = getStorageArea();
      if (!storage) {
        reject(new Error('API de storage indisponível.'));
        return;
      }

      try {
        const payload = { [STORAGE_KEY]: profile };
        const result = storage.set(payload, () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });

        if (result && typeof result.then === 'function') {
          result.then(() => resolve()).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  function hasAnyProfileData(profile) {
    return FIELDS.some((field) => Boolean(profile[field.key] && String(profile[field.key]).trim()));
  }

  // =========================================================================
  // Utilitários de Texto, DOM e Área de Transferência
  // =========================================================================

  function normalizeText(value) {
    if (!value) return '';
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_err) {
        // Fallback abaixo para páginas sem permissão de clipboard
      }
    }

    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.top = '-9999px';
    helper.style.left = '-9999px';
    document.body.appendChild(helper);
    helper.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch (_err) {
      copied = false;
    }

    helper.remove();
    return copied;
  }

  function isElementVisible(el) {
    const win = el.ownerDocument.defaultView || window;
    const style = win.getComputedStyle(el);

    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) === 0
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getAssociatedLabelText(el, doc) {
    const texts = [];

    // 1. Propriedade nativa el.labels
    if (el.labels && el.labels.length > 0) {
      for (const label of el.labels) {
        if (label.textContent) texts.push(label.textContent);
      }
    }

    // 2. Busca explícita por label[for="id"]
    if (el.id) {
      try {
        const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(el.id) : el.id.replace(/"/g, '\\"');
        const explicitLabel = doc.querySelector(`label[for="${escapedId}"]`);
        if (explicitLabel && explicitLabel.textContent) {
          texts.push(explicitLabel.textContent);
        }
      } catch (_err) {
        // Ignora seletor inválido
      }
    }

    // 3. aria-labelledby
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((refId) => {
        const refEl = doc.getElementById(refId);
        if (refEl && refEl.textContent) texts.push(refEl.textContent);
      });
    }

    // 4. Ancestral <label>
    const closestLabel = el.closest('label');
    if (closestLabel && closestLabel.textContent) {
      texts.push(closestLabel.textContent);
    }

    // 5. Labels próximos na árvore do DOM (irmão anterior ou contêiner pai imediato)
    if (texts.length === 0) {
      const prev = el.previousElementSibling;
      if (prev && /^(LABEL|SPAN|P|DIV|STRONG|SMALL|H[1-6])$/.test(prev.tagName)) {
        const prevText = (prev.textContent || '').trim();
        if (prevText && prevText.length <= 80) {
          texts.push(prevText);
        }
      }

      const parent = el.parentElement;
      if (parent && parent !== doc.body) {
        const inputsInParent = parent.querySelectorAll('input:not([type="hidden"]), textarea');
        if (inputsInParent.length === 1) {
          const siblingLabel = parent.querySelector('label, [class*="label" i], legend');
          if (siblingLabel && siblingLabel.textContent) {
            const labelText = siblingLabel.textContent.trim();
            if (labelText && labelText.length <= 80) {
              texts.push(labelText);
            }
          }
        }
      }
    }

    return texts.join(' ');
  }

  function buildFieldDescriptor(el, doc) {
    const parts = [
      el.getAttribute('placeholder'),
      el.getAttribute('name'),
      el.getAttribute('id'),
      el.getAttribute('aria-label'),
      el.getAttribute('autocomplete'),
      getAssociatedLabelText(el, doc)
    ];

    return normalizeText(parts.filter(Boolean).join(' '));
  }

  // =========================================================================
  // Motor de Mapeamento e Preenchimento Inteligente
  // =========================================================================

  function splitFullName(fullName) {
    const cleaned = String(fullName || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return { firstName: '', lastName: '' };

    const parts = cleaned.split(' ');
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' ')
    };
  }

  function resolveValueForElement(el, descriptor, profile) {
    const inputType = (el.getAttribute('type') || 'text').toLowerCase();
    const autocomplete = normalizeText(el.getAttribute('autocomplete'));

    // 1. LinkedIn
    if (/\blinkedin\b/.test(descriptor)) {
      return profile.linkedin || '';
    }

    // 2. GitHub
    if (/\b(github|git hub)\b/.test(descriptor)) {
      return profile.github || '';
    }

    // 3. Portfólio / Site
    if (
      /\b(portfolio|portifolio|website|web site|site pessoal|personal site|homepage|blog|pagina pessoal)\b/.test(descriptor) ||
      (inputType === 'url' && !/\b(linkedin|github)\b/.test(descriptor))
    ) {
      return profile.portfolio || '';
    }

    // 4. E-mail
    if (
      inputType === 'email' ||
      autocomplete === 'email' ||
      /\b(email|e mail|correio eletronico)\b/.test(descriptor)
    ) {
      return profile.email || '';
    }

    // 5. Telefone
    if (
      inputType === 'tel' ||
      autocomplete.startsWith('tel') ||
      /\b(telefone|celular|whatsapp|phone|mobile|fone|tel)\b/.test(descriptor)
    ) {
      // Evita preencher campos exclusivos de DDI/código de país
      if (/\b(ddi|dial code|country code|codigo do pais)\b/.test(descriptor)) {
        return '';
      }
      return profile.phone || '';
    }

    // 6. Pretensão Salarial
    if (
      /\b(pretensao|salarial|salario|salary|remuneracao|compensation|expected pay|pay expectation|expectativa salarial|faixa salarial)\b/.test(descriptor)
    ) {
      return profile.salary || '';
    }

    // 7. País
    if (
      autocomplete === 'country' ||
      autocomplete === 'country name' ||
      (/\b(pais|country)\b/.test(descriptor) && !/\b(code|codigo|ddi|dial)\b/.test(descriptor))
    ) {
      return profile.country || '';
    }

    // 8. Estado / UF
    if (
      autocomplete === 'address level1' ||
      (/\b(estado|uf|state|province|provincia)\b/.test(descriptor) && !/\b(estado civil|marital)\b/.test(descriptor))
    ) {
      return profile.state || '';
    }

    // 9. Cidade
    if (
      autocomplete === 'address level2' ||
      /\b(cidade|city|municipio|localidade)\b/.test(descriptor)
    ) {
      return profile.city || '';
    }

    // 10. Nome (Sobrenome, Primeiro Nome ou Nome Completo)
    if (profile.fullName) {
      const isExcludedName = NAME_EXCLUSION_PATTERNS.some((pattern) => pattern.test(descriptor));
      if (!isExcludedName) {
        const { firstName, lastName } = splitFullName(profile.fullName);

        if (
          autocomplete === 'family name' ||
          /\b(sobrenome|ultimo nome|last name|lastname|surname|family name)\b/.test(descriptor)
        ) {
          return lastName || '';
        }

        if (
          autocomplete === 'given name' ||
          /\b(primeiro nome|first name|firstname|given name)\b/.test(descriptor)
        ) {
          return firstName || '';
        }

        if (
          autocomplete === 'name' ||
          /\b(nome completo|full name|fullname|seu nome|your name|nome do candidato|candidate name)\b/.test(descriptor) ||
          /\b(nome|name)\b/.test(descriptor)
        ) {
          return profile.fullName;
        }
      }
    }

    return '';
  }

  function setNativeValue(el, value) {
    const win = el.ownerDocument.defaultView || window;
    const proto = el.tagName === 'TEXTAREA'
      ? win.HTMLTextAreaElement.prototype
      : win.HTMLInputElement.prototype;

    const valueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

    if (valueSetter) {
      valueSetter.call(el, value);
    } else {
      el.value = value;
    }

    // Dispara sequência de eventos esperada por React, Vue, Angular e validações nativas
    let inputEvent;
    try {
      inputEvent = new win.InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: value,
        inputType: 'insertText'
      });
    } catch (_err) {
      inputEvent = new win.Event('input', { bubbles: true, cancelable: true });
    }

    el.dispatchEvent(inputEvent);
    el.dispatchEvent(new win.Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new win.Event('blur', { bubbles: true, cancelable: true }));
  }

  function highlightFilledField(el, isTopDocument) {
    if (isTopDocument) {
      el.classList.add('afv-field-filled');
      setTimeout(() => {
        el.classList.remove('afv-field-filled');
      }, 1500);
      return;
    }

    // Fallback para iframes same-origin onde styles.css não foi injetado
    const previousBorder = el.style.borderColor;
    const previousOutline = el.style.outline;
    el.style.borderColor = '#22c55e';
    el.style.outline = '2px solid rgba(34, 197, 94, 0.45)';
    setTimeout(() => {
      el.style.borderColor = previousBorder;
      el.style.outline = previousOutline;
    }, 1500);
  }

  function collectTargetDocuments() {
    const docs = [{ doc: document, isTop: true }];
    const iframes = document.querySelectorAll('iframe');

    for (const iframe of iframes) {
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          docs.push({ doc: iframe.contentDocument, isTop: false });
        }
      } catch (_err) {
        // Ignora iframes cross-origin
      }
    }

    return docs;
  }

  function fillCurrentPage(profile) {
    let filledCount = 0;
    const root = document.getElementById('autofill-vagas-root');
    const targetDocs = collectTargetDocuments();

    for (const { doc, isTop } of targetDocs) {
      const elements = doc.querySelectorAll('input, textarea');

      for (const el of elements) {
        // Ignora campos da própria extensão
        if (isTop && root && root.contains(el)) continue;

        // Ignora campos desabilitados ou somente leitura
        if (el.disabled || el.readOnly) continue;

        // Ignora tipos não textuais
        if (el.tagName === 'INPUT') {
          const type = (el.getAttribute('type') || 'text').toLowerCase();
          if (IGNORED_INPUT_TYPES.has(type)) continue;
        }

        // Ignora campos ocultos
        if (!isElementVisible(el)) continue;

        // Nunca sobrescreve valores já digitados pelo usuário
        if (el.value && el.value.trim().length > 0) continue;

        const descriptor = buildFieldDescriptor(el, doc);
        if (!descriptor && !(el.tagName === 'INPUT' && ['email', 'tel', 'url'].includes((el.getAttribute('type') || '').toLowerCase()))) {
          continue;
        }

        const matchedValue = resolveValueForElement(el, descriptor, profile);
        if (!matchedValue || !String(matchedValue).trim()) continue;

        setNativeValue(el, String(matchedValue).trim());
        highlightFilledField(el, isTop);
        filledCount += 1;
      }
    }

    return filledCount;
  }

  // =========================================================================
  // Interface Flutuante (DOM Seguro sem innerHTML para dados do usuário)
  // =========================================================================

  function createEl(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    return el;
  }

  function initUI() {
    let profile = {};
    let isOpen = false;
    let mode = 'view'; // 'view' | 'edit'
    let statusTimer = null;

    const root = createEl('div');
    root.id = 'autofill-vagas-root';

    // Botão Flutuante (apenas ícone no canto)
    const fab = createEl('button', 'afv-fab');
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Abrir Script Personal Data');
    fab.appendChild(createEl('span', 'afv-fab-icon', ''));

    // Painel
    const panel = createEl('div', 'afv-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Script Personal Data');

    // Cabeçalho
    const header = createEl('div', 'afv-header');
    const titleWrap = createEl('div', 'afv-title');
    titleWrap.appendChild(createEl('span', 'afv-title-badge', ''));
    titleWrap.appendChild(createEl('span', '', 'Script Personal Data'));

    const headerActions = createEl('div', 'afv-header-actions');
    const modeToggleBtn = createEl('button', 'afv-btn-ghost', 'Editar Dados');
    modeToggleBtn.type = 'button';

    const closeBtn = createEl('button', 'afv-btn-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Fechar painel');

    headerActions.appendChild(modeToggleBtn);
    headerActions.appendChild(closeBtn);
    header.appendChild(titleWrap);
    header.appendChild(headerActions);

    // Corpo do Painel
    const body = createEl('div', 'afv-body');
    const statusBox = createEl('div', 'afv-status');

    panel.appendChild(header);
    panel.appendChild(body);
    root.appendChild(panel);
    root.appendChild(fab);

    function showStatus(message, type = 'info') {
      if (statusTimer) clearTimeout(statusTimer);
      statusBox.textContent = message;
      statusBox.className = 'afv-status afv-visible';
      if (type === 'success') statusBox.classList.add('afv-status-success');
      if (type === 'error') statusBox.classList.add('afv-status-error');

      statusTimer = setTimeout(() => {
        statusBox.className = 'afv-status';
      }, 3200);
    }

    function clearStatus() {
      if (statusTimer) clearTimeout(statusTimer);
      statusBox.className = 'afv-status';
    }

    function setPanelOpen(nextOpen) {
      isOpen = nextOpen;
      panel.classList.toggle('afv-open', isOpen);
      if (isOpen) {
        if (!hasAnyProfileData(profile)) {
          mode = 'edit';
        }
        renderBody();
      }
    }

    function renderViewMode() {
      panel.classList.remove('afv-panel-edit');
      modeToggleBtn.textContent = 'Editar';
      body.replaceChildren();

      const fillBtn = createEl('button', 'afv-btn-primary', 'Preencher inputs');
      fillBtn.type = 'button';
      fillBtn.addEventListener('click', () => {
        if (!hasAnyProfileData(profile)) {
          mode = 'edit';
          renderBody();
          showStatus('Cadastre seus dados antes de preencher.', 'error');
          return;
        }

        const count = fillCurrentPage(profile);
        if (count > 0) {
          const label = count === 1 ? '1 campo preenchido.' : `${count} campos preenchidos.`;
          showStatus(label, 'success');
        } else {
          showStatus('Nenhum campo vazio compatível.', 'info');
        }
      });

      body.appendChild(fillBtn);
      body.appendChild(statusBox);
    }

    function buildInputGroup(field, inputMap) {
      const group = createEl('div', 'afv-field');
      const inputId = `afv-input-${field.key}`;

      const label = createEl('label', '', field.label);
      label.setAttribute('for', inputId);

      const input = createEl('input');
      input.id = inputId;
      input.type = field.type || 'text';
      input.placeholder = field.placeholder || '';
      input.value = profile[field.key] || '';
      input.autocomplete = 'off';

      inputMap[field.key] = input;
      group.appendChild(label);
      group.appendChild(input);
      return group;
    }

    function readFormValues(inputMap) {
      const next = {};
      for (const field of FIELDS) {
        next[field.key] = (inputMap[field.key].value || '').trim();
      }
      return next;
    }

    function renderEditMode() {
      panel.classList.add('afv-panel-edit');
      modeToggleBtn.textContent = 'Voltar';
      body.replaceChildren();
      body.appendChild(statusBox);

      if (!hasAnyProfileData(profile)) {
        const intro = createEl(
          'p',
          'afv-intro',
          'Configure seus dados uma única vez. Tudo fica salvo apenas localmente no seu navegador.'
        );
        body.appendChild(intro);
      }

      const form = createEl('form', 'afv-form');
      const inputMap = {};

      for (let i = 0; i < FIELDS.length; i += 1) {
        const field = FIELDS[i];

        // Agrupa Cidade e Estado lado a lado para economizar altura
        if (field.rowGroup === 'location' && FIELDS[i + 1] && FIELDS[i + 1].rowGroup === 'location') {
          const row = createEl('div', 'afv-form-row');
          row.appendChild(buildInputGroup(field, inputMap));
          row.appendChild(buildInputGroup(FIELDS[i + 1], inputMap));
          form.appendChild(row);
          i += 1;
        } else {
          form.appendChild(buildInputGroup(field, inputMap));
        }
      }

      const saveBtn = createEl('button', 'afv-btn-primary', 'Salvar Dados');
      saveBtn.type = 'submit';
      form.appendChild(saveBtn);

      // Backup: Exportar / Importar JSON
      const backupRow = createEl('div', 'afv-backup-row');

      const exportBtn = createEl('button', 'afv-btn-secondary', 'Exportar JSON');
      exportBtn.type = 'button';
      exportBtn.addEventListener('click', () => {
        const currentValues = readFormValues(inputMap);
        const blob = new Blob([JSON.stringify(currentValues, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'autofill-vagas-backup.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showStatus('Backup exportado em JSON.', 'success');
      });

      const fileInput = createEl('input', 'afv-file-input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';

      const importBtn = createEl('button', 'afv-btn-secondary', 'Importar JSON');
      importBtn.type = 'button';
      importBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });

      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const parsed = JSON.parse(String(reader.result || ''));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('Formato inválido');
            }

            const sanitized = {};
            for (const field of FIELDS) {
              const raw = parsed[field.key];
              sanitized[field.key] = typeof raw === 'string' ? raw.trim() : '';
              inputMap[field.key].value = sanitized[field.key];
            }

            await saveProfile(sanitized);
            profile = sanitized;
            showStatus('Dados importados e salvos com sucesso.', 'success');
          } catch (_err) {
            showStatus('Arquivo JSON inválido. Verifique o formato do backup.', 'error');
          }
        };
        reader.onerror = () => {
          showStatus('Erro ao ler o arquivo selecionado.', 'error');
        };
        reader.readAsText(file);
      });

      backupRow.appendChild(exportBtn);
      backupRow.appendChild(importBtn);
      backupRow.appendChild(fileInput);
      form.appendChild(backupRow);

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const nextProfile = readFormValues(inputMap);
        try {
          await saveProfile(nextProfile);
          profile = nextProfile;
          mode = 'view';
          renderBody();
          showStatus('Dados salvos localmente.', 'success');
        } catch (_err) {
          showStatus('Erro ao salvar os dados no navegador.', 'error');
        }
      });

      body.appendChild(form);
    }

    function renderBody() {
      if (mode === 'edit') {
        renderEditMode();
      } else {
        renderViewMode();
      }
    }

    // Eventos globais da interface
    fab.addEventListener('click', () => {
      clearStatus();
      setPanelOpen(!isOpen);
    });

    closeBtn.addEventListener('click', () => {
      clearStatus();
      setPanelOpen(false);
    });

    modeToggleBtn.addEventListener('click', () => {
      clearStatus();
      mode = mode === 'view' ? 'edit' : 'view';
      renderBody();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen) {
        setPanelOpen(false);
      }
    });

    // Inicialização assíncrona dos dados salvos
    loadProfile().then((saved) => {
      profile = saved || {};
      mode = hasAnyProfileData(profile) ? 'view' : 'edit';
      document.body.appendChild(root);
    });
  }

  if (document.body) {
    initUI();
  } else {
    document.addEventListener('DOMContentLoaded', initUI, { once: true });
  }
})();
