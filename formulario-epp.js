// formulario-epp.js

const m = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de Firebase
  if (!firebase.apps.length) {
    console.error('Firebase no está inicializado. Revisa firebase-config.js');
    return;
  }
  const db = firebase.firestore();
  const storage = firebase.storage();
  const COLLECTION_NAME = 'Inspecciones_EPP';

  const form = m('eppForm');
  const addRowBtn = m('addRowBtn');
  const eppTableBody = m('eppTableBody'); // Ahora solo un tbody
  const btnEnviar = m('btnEnviar');
  const firmaCanvas = m('firmaCanvas');
  const ctx = firmaCanvas.getContext('2d');
  const clearFirmaBtn = m('clearFirma');
  const firmaStatus = m('firmaStatus');

  let rowCounter = 0; // Contador para N° de trabajador
  let hasSigned = false; // Estado de la firma

  // Definición de los EPPs que aparecerán en la tabla y su orden.
  // Todos los EPPs ahora están en una sola lista, reflejando la única tabla.
  const EPP_TYPES = [
    { id: 'casco', name: 'Casco' },
    { id: 'chalecoReflectivo', name: 'Chaleco Reflectivo' },
    { id: 'lentesSeguridad', name: 'Lentes de Seguridad' },
    { id: 'botasSeguridad', name: 'Botas de Seguridad' },
    { id: 'protectorAuditivo', name: 'Protector Auditivo' },
    { id: 'guantesSeguridad', name: 'Guantes de Seguridad' },
    // Si añades más EPPs, agrégalos aquí.
    // { id: 'respirador', name: 'Respirador' },
    // { id: 'arnes', name: 'Arnés' },
  ];

  // --- Helpers UI ---
  function showMessage(text, type = 'error', duration = 3000) {
    let messageBox = m('mensaje-flotante');
    messageBox.textContent = text;
    messageBox.style.backgroundColor = type === 'error' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(39, 174, 96, 0.9)';
    messageBox.style.display = 'block';
    setTimeout(() => messageBox.style.display = 'none', duration);
  }

  function showLoading(show) {
    let loadingOverlay = m('loading-overlay');
    if (!loadingOverlay) { // Crear si no existe
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = show ? 'flex' : 'none';
    btnEnviar.disabled = show;
  }

  // --- Funcionalidad de Firma ---
  function resizeFirmaCanvas() {
    const ratio = window.devicePixelRatio || 1;
    firmaCanvas.width = firmaCanvas.offsetWidth * ratio;
    firmaCanvas.height = firmaCanvas.offsetHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    if (!hasSigned) {
      firmaStatus.textContent = 'No se ha firmado.';
      firmaStatus.classList.add('required-status');
      firmaStatus.classList.remove('taken-status');
    }
  }
  window.addEventListener('resize', resizeFirmaCanvas);
  resizeFirmaCanvas(); // Llamar al cargar

  let drawingFirma = false;
  let lastXFirma = 0, lastYFirma = 0;

  firmaCanvas.addEventListener('pointerdown', e => {
    e.preventDefault(); // Evitar el scroll/zoom del navegador
    drawingFirma = true;
    hasSigned = true;
    firmaStatus.textContent = 'Firma capturada.';
    firmaStatus.classList.remove('required-status');
    firmaStatus.classList.add('taken-status');

    [lastXFirma, lastYFirma] = [e.offsetX, e.offsetY];
    ctx.beginPath();
    ctx.moveTo(lastXFirma, lastYFirma);
    document.body.style.overflow = 'hidden'; // Bloquear scroll del body
  }, { passive: false });

  firmaCanvas.addEventListener('pointermove', e => {
    if (!drawingFirma) return;
    e.preventDefault(); // Evitar el scroll/zoom del navegador
    ctx.lineTo(e.offsetX, e.offsetY);
    [lastXFirma, lastYFirma] = [e.offsetX, e.offsetY];
    ctx.stroke();
  }, { passive: false });

  ['pointerup', 'pointerout', 'pointercancel'].forEach(evt => {
    firmaCanvas.addEventListener(evt, () => {
      drawingFirma = false;
      document.body.style.overflow = ''; // Restaurar scroll del body
    });
  });

  clearFirmaBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
    hasSigned = false;
    firmaStatus.textContent = 'No se ha firmado.';
    firmaStatus.classList.add('required-status');
    firmaStatus.classList.remove('taken-status');
  });

  // --- Funcionalidad Tabla de EPP (Añadir/Eliminar filas) ---
  function addEPPRow() {
    rowCounter++;
    const row = eppTableBody.insertRow();
    row.dataset.rowId = rowCounter; // Para identificar la fila

    let cellsHtml = `
      <td class="col-n">${rowCounter}</td>
      <td class="col-nombre-trabajador"><input type="text" class="worker-name-input" placeholder="Nombre Apellido" required></td>
    `;

    // Crear select de SI/NO y Estado para cada EPP
    EPP_TYPES.forEach(epp => {
        cellsHtml += `
            <td>${createYNSelect(epp.id)}</td>
            <td>${createEPPStatusSelect(epp.id)}</td>
        `;
    });

    cellsHtml += `
      <td class="col-observaciones"><textarea class="epp-obs-textarea" placeholder="Observaciones"></textarea></td>
      <td class="col-acciones"><button type="button" class="delete-row-button"><i class="fas fa-trash-alt"></i></button></td>
    `;
    row.innerHTML = cellsHtml;

    row.querySelector('.delete-row-button').addEventListener('click', function() {
      if (confirm('¿Estás seguro de que quieres eliminar este trabajador de la lista?')) {
          eppTableBody.removeChild(row);
          updateRowNumbers(); // Re-enumerar después de eliminar
          if (eppTableBody.children.length === 0) { // Si no quedan filas, añade una nueva
              addEPPRow();
          }
      }
    });
  }

  function createYNSelect(eppType) {
    const options = `
      <option value="SI">SI</option>
      <option value="NO">NO</option>
    `;
    return `<select class="epp-yn-select" data-epp-type="${eppType}_yn" required>${options}</select>`;
  }

  function createEPPStatusSelect(eppType) {
    const options = `

      <option value="B">B</option>
      <option value="R">R</option>
      <option value="M">M</option>
      <option value="CD">CD</option>
      <option value="A">A</option>
      <option value="P">P</option>
    `;
    return `<select class="epp-status-select" data-epp-type="${eppType}_estado" required>${options}</select>`;
  }

  function updateRowNumbers() {
      const rows = eppTableBody.querySelectorAll('tr');
      rows.forEach((row, index) => {
          row.cells[0].textContent = index + 1; // Actualiza el número de la primera celda
          row.dataset.rowId = index + 1; // Actualiza el ID de la fila
      });
      rowCounter = rows.length;
  }

  // Añadir la primera fila al cargar el formulario
  addEPPRow(); // Esto se ejecuta al inicio para tener al menos 1 fila.
  addRowBtn.addEventListener('click', addEPPRow); // Evento para el botón de añadir más filas.


  // --- Validación y Envío ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading(true);

    let isValid = true;
    let firstInvalidField = null;

    // 1. Validar campos generales
    const generalFields = ['clienteUnidad', 'responsableInspeccion', 'fechaInspeccion', 'cargoInspector', 'conclusionesRecomendaciones', 'nombreResponsable', 'fechaRegistro'];
    for (const id of generalFields) {
      const field = m(id);
      field.classList.remove('input-error');
      if (!field.value.trim()) {
        field.classList.add('input-error');
        if (!firstInvalidField) firstInvalidField = field;
        isValid = false;
      }
    }

    // 2. Validar tabla de EPP
    const eppRows = eppTableBody.querySelectorAll('tr');
    if (eppRows.length === 0) {
      showMessage('Debe añadir al menos un trabajador a la tabla de EPP.', 'error');
      isValid = false;
    } else {
        eppRows.forEach(row => {
            const nameInput = row.querySelector('.worker-name-input');
            nameInput.classList.remove('input-error');
            if (!nameInput.value.trim()) {
                nameInput.classList.add('input-error');
                if (!firstInvalidField) firstInvalidField = nameInput;
                isValid = false;
            }

            // Validar selects de SI/NO y Estado para cada EPP
            EPP_TYPES.forEach(epp => {
                const ynSelect = row.querySelector(`[data-epp-type="${epp.id}_yn"]`);
                const statusSelect = row.querySelector(`[data-epp-type="${epp.id}_estado"]`);
                
                ynSelect.classList.remove('input-error');
                statusSelect.classList.remove('input-error');

                if (!ynSelect.value) { 
                    ynSelect.classList.add('input-error');
                    if (!firstInvalidField) firstInvalidField = ynSelect;
                    isValid = false;
                }
                if (!statusSelect.value) { 
                    statusSelect.classList.add('input-error');
                    if (!firstInvalidField) firstInvalidField = statusSelect;
                    isValid = false;
                }
            });
            // Observaciones son opcionales, no se validan aquí como requeridas
        });
    }

    // 3. Validar Firma
    if (!hasSigned) {
      firmaStatus.classList.add('required-status');
      showMessage('La firma es obligatoria.', 'error');
      isValid = false;
    } else {
      firmaStatus.classList.remove('required-status');
    }

    if (!isValid) {
      if (firstInvalidField) firstInvalidField.focus();
      showLoading(false);
      return;
    }

    // --- Recolectar Datos ---
    const eppData = [];
    eppRows.forEach(row => {
      const workerData = {
          n: parseInt(row.cells[0].textContent), // Número de fila
          nombreTrabajador: row.querySelector('.worker-name-input').value.trim(),
      };
      
      EPP_TYPES.forEach(epp => {
          workerData[epp.id + '_yn'] = row.querySelector(`[data-epp-type="${epp.id}_yn"]`).value;
          workerData[epp.id + '_estado'] = row.querySelector(`[data-epp-type="${epp.id}_estado"]`).value;
      });

      workerData.observaciones = row.querySelector('.epp-obs-textarea').value.trim(); // Observaciones son opcionales

      eppData.push(workerData);
    });

    const formData = {
      // Datos generales
      clienteUnidad: m('clienteUnidad').value.trim(),
      responsableInspeccion: m('responsableInspeccion').value.trim(),
      fechaInspeccion: m('fechaInspeccion').value,
      cargoInspector: m('cargoInspector').value.trim(),
      
      // Datos fijos del documento (del PDF)
      codigoDocumento: 'JV-SSM-F-417',
      versionDocumento: '01',
      fechaDocumento: '10/12/2024', // Fecha del documento, no de la inspección
      pagina: 'Página 1 de 1',

      // Tabla de EPP
      eppItems: eppData,

      // Conclusiones
      conclusionesRecomendaciones: m('conclusionesRecomendaciones').value.trim(),

      // Responsable del Registro
      nombreResponsable: m('nombreResponsable').value.trim(),
      fechaRegistro: m('fechaRegistro').value,
    };

    try {
      // Subir firma
      const firmaBlob = await new Promise(resolve => firmaCanvas.toBlob(resolve, 'image/png'));
      const firmaRef = storage.ref(`inspecciones_epp_firmas/firma_${Date.now()}.png`);
      await firmaRef.put(firmaBlob);
      formData.firmaURL = await firmaRef.getDownloadURL();

      await db.collection(COLLECTION_NAME).add(formData);
      showMessage('Inspección guardada exitosamente!', 'success');
      form.reset();
      ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
      hasSigned = false;
      firmaStatus.textContent = 'No se ha firmado.';
      firmaStatus.classList.add('required-status');
      firmaStatus.classList.remove('taken-status');
      eppTableBody.innerHTML = ''; // Limpiar tabla
      rowCounter = 0; // Resetear contador
      addEPPRow(); // Añadir la primera fila vacía de nuevo

    } catch (error) {
      console.error('Error al guardar la inspección:', error);
      showMessage('Error al guardar la inspección: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  });
});