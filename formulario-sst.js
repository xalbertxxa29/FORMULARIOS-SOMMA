// formulario-sst.js

// 1) Helper global
const m = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  // 2) Firebase
  if (!firebase.apps.length) {
    console.error('Firebase no está inicializado. Revisa firebase-config.js');
    return;
  }
  const db      = firebase.firestore();
  const storage = firebase.storage();

  // 3) Overlay de carga
  let overlay = m('overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    Object.assign(overlay.style, {
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)', display: 'none', alignItems: 'center',
      justifyContent: 'center', color: '#fff', fontSize: '1.25rem', zIndex: 9999,
    });
    overlay.textContent = 'Enviando datos…';
    document.body.appendChild(overlay);
  }

  // 4) Caja de mensaje centrada
  let messageBox = m('messageBox');
  if (!messageBox) {
    messageBox = document.createElement('div');
    messageBox.id = 'messageBox';
    Object.assign(messageBox.style, {
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      padding: '16px 24px', background: '#fff', borderRadius: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)', display: 'none', zIndex: 10000,
      textAlign: 'center', fontSize: '1.1rem', color: '#333',
    });
    document.body.appendChild(messageBox);
  }
  function showMessage(text, duration = 2500) {
    messageBox.textContent = text;
    messageBox.style.display = 'block';
    setTimeout(() => messageBox.style.display = 'none', duration);
  }

  // --- Funcionalidad de Firma ---
  const canvasResponsableRegistro = m('firmaResponsableRegistro'),
        ctxResponsableRegistro = canvasResponsableRegistro.getContext('2d');
  let hasSignedResponsableRegistro = false;
  const firmaStatusText = m('firmaStatus');

  function resizeCanvas() {
    canvasResponsableRegistro.width  = canvasResponsableRegistro.offsetWidth;
    canvasResponsableRegistro.height = canvasResponsableRegistro.offsetHeight;
    ctxResponsableRegistro.lineJoin = 'round';
    ctxResponsableRegistro.lineCap  = 'round';
    ctxResponsableRegistro.lineWidth = 2;
    ctxResponsableRegistro.strokeStyle = '#000';
    if (!hasSignedResponsableRegistro) {
        firmaStatusText.textContent = 'No se ha firmado.';
        firmaStatusText.classList.add('required-status');
        firmaStatusText.classList.remove('taken-status');
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let drawing = false, lastX = 0, lastY = 0;
  canvasResponsableRegistro.addEventListener('pointerdown', e => {
    drawing = true;
    hasSignedResponsableRegistro = true;
    firmaStatusText.textContent = 'Firma capturada.';
    firmaStatusText.classList.remove('required-status');
    firmaStatusText.classList.add('taken-status');

    [lastX, lastY] = [e.offsetX, e.offsetY];
    ctxResponsableRegistro.beginPath();
    ctxResponsableRegistro.moveTo(lastX, lastY);
  });
  canvasResponsableRegistro.addEventListener('pointermove', e => {
    if (!drawing) return;
    ctxResponsableRegistro.lineTo(e.offsetX, e.offsetY);
    ctxResponsableRegistro.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });
  ['pointerup','pointerout'].forEach(evt =>
    canvasResponsableRegistro.addEventListener(evt, () => drawing = false)
  );

  m('clearFirmaResponsableRegistro').addEventListener('click', () => {
    ctxResponsableRegistro.clearRect(0, 0, canvasResponsableRegistro.width, canvasResponsableRegistro.height);
    hasSignedResponsableRegistro = false;
    firmaStatusText.textContent = 'No se ha firmado.';
    firmaStatusText.classList.add('required-status');
    firmaStatusText.classList.remove('taken-status');
  });

  // --- Funcionalidad de Cámara Directa ---
  const cameraOverlay = m('camera-overlay');
  const cameraStreamVideo = m('camera-stream');
  const capturePhotoButton = m('capture-photo-button');
  const closeCameraButton = m('close-camera-button');
  let currentStream; // Para guardar el stream de la cámara
  let currentPhotoBlob = null; // Para almacenar el Blob de la foto capturada
  let currentPhotoTarget = null; // 'fotoArea' o 'fotoListaVerificacion'

  const fotoAreaStatus = m('fotoAreaStatus');
  const previewFotoArea = m('previewFotoArea');
  const imgFotoArea = m('imgFotoArea');
  const btnFotoArea = m('btnFotoArea');
  let fotoAreaBlob = null;

  const fotoListaVerificacionStatus = m('fotoListaVerificacionStatus');
  const previewFotoListaVerificacion = m('previewFotoListaVerificacion');
  const imgFotoListaVerificacion = m('imgFotoListaVerificacion');
  const btnFotoListaVerificacion = m('btnFotoListaVerificacion');
  let fotoListaVerificacionBlob = null;

  // Función para abrir la cámara
  async function openCamera(target) {
      currentPhotoTarget = target;
      try {
          // Solicitar acceso a la cámara trasera preferentemente
          currentStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'environment' }
          });
          cameraStreamVideo.srcObject = currentStream;
          cameraOverlay.style.display = 'flex'; // Mostrar el overlay de la cámara
      } catch (err) {
          console.error('Error al acceder a la cámara:', err);
          showMessage('No se pudo acceder a la cámara. Revisa los permisos o intenta de nuevo.', 5000);
      }
  }

  // Función para cerrar la cámara
  function closeCamera() {
      if (currentStream) {
          currentStream.getTracks().forEach(track => track.stop());
      }
      cameraOverlay.style.display = 'none'; // Ocultar el overlay de la cámara
  }

  // Event listeners para abrir la cámara
  m('btnFotoArea').addEventListener('click', () => openCamera('fotoArea'));
  m('btnFotoListaVerificacion').addEventListener('click', () => openCamera('fotoListaVerificacion'));

  // Event listener para capturar la foto
  capturePhotoButton.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      // Asegurar que el canvas tenga el mismo tamaño que el stream de video
      canvas.width = cameraStreamVideo.videoWidth;
      canvas.height = cameraStreamVideo.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(cameraStreamVideo, 0, 0, canvas.width, canvas.height);

      // Obtener la imagen como Blob
      canvas.toBlob(function(blob) {
          currentPhotoBlob = blob; // Guardar el blob capturado temporalmente

          // Mostrar previsualización
          const reader = new FileReader();
          reader.onload = function(e) {
              if (currentPhotoTarget === 'fotoArea') {
                  imgFotoArea.src = e.target.result;
                  previewFotoArea.style.display = 'block';
                  btnFotoArea.style.display = 'none';
                  fotoAreaStatus.textContent = 'Foto tomada.';
                  fotoAreaStatus.classList.remove('required-status');
                  fotoAreaStatus.classList.add('taken-status');
                  fotoAreaBlob = currentPhotoBlob; // Asignar al blob específico del campo
              } else if (currentPhotoTarget === 'fotoListaVerificacion') {
                  imgFotoListaVerificacion.src = e.target.result;
                  previewFotoListaVerificacion.style.display = 'block';
                  btnFotoListaVerificacion.style.display = 'none';
                  fotoListaVerificacionStatus.textContent = 'Foto tomada.';
                  fotoListaVerificacionStatus.classList.remove('optional-status');
                  fotoListaVerificacionStatus.classList.add('taken-status');
                  fotoListaVerificacionBlob = currentPhotoBlob; // Asignar al blob específico del campo
              }
          };
          reader.readAsDataURL(blob);

          closeCamera(); // Cierra la cámara después de capturar
      }, 'image/jpeg', 0.9); // Calidad JPEG
  });

  // Event listener para cerrar la cámara sin capturar
  closeCameraButton.addEventListener('click', closeCamera);

  // Funciones para eliminar foto
  document.querySelectorAll('.delete-photo-button').forEach(button => {
      button.addEventListener('click', (e) => {
          const type = e.target.dataset.type || e.target.closest('button').dataset.type;
          if (type === 'area') {
              fotoAreaBlob = null;
              imgFotoArea.src = '';
              previewFotoArea.style.display = 'none';
              btnFotoArea.style.display = 'block';
              fotoAreaStatus.textContent = 'No se ha tomado ninguna foto.';
              fotoAreaStatus.classList.remove('taken-status');
              fotoAreaStatus.classList.add('required-status');
          } else if (type === 'lista') {
              fotoListaVerificacionBlob = null;
              imgFotoListaVerificacion.src = '';
              previewFotoListaVerificacion.style.display = 'none';
              btnFotoListaVerificacion.style.display = 'block';
              fotoListaVerificacionStatus.textContent = 'No se ha tomado ninguna foto.';
              fotoListaVerificacionStatus.classList.remove('taken-status');
              fotoListaVerificacionStatus.classList.add('optional-status');
          }
      });
  });

  // --- Validación ---
  function validate() {
    const requiredTextInputs = [
      'razonSocial', 'ruc', 'domicilio', 'actividadEconomica',
      'numTrabajadores', 'fechaInspeccion', 'horaInspeccion', 'areaInspeccionada',
      'responsableInspeccion', 'objetivoInspeccion', 'resultadoInspeccion',
      'descripcionCausa', 'conclusionesRecomendaciones', 'nombreResponsableRegistro',
      'cargoResponsableRegistro', 'fechaResponsableRegistro'
    ];

    // Resetear estilos de error
    requiredTextInputs.forEach(id => {
      const field = m(id);
      if (field) field.classList.remove('input-error');
    });
    const radioGroup = document.querySelector('input[name="tipoInspeccion"]');
    if (radioGroup) {
      document.querySelectorAll('input[name="tipoInspeccion"]').forEach(radio => radio.classList.remove('input-error'));
    }

    // Validación de campos de texto/número/fecha/hora/textarea
    for (const id of requiredTextInputs) {
      const field = m(id);
      if (!field.value.trim()) {
        field.classList.add('input-error');
        showMessage(`El campo "${field.previousElementSibling ? field.previousElementSibling.textContent.replace(':', '').trim() : field.id}" es requerido.`, 3500);
        field.focus();
        return false;
      }
    }
    // Validación específica para número de trabajadores
    if (m('numTrabajadores').value === '' || m('numTrabajadores').value < 0) {
      m('numTrabajadores').classList.add('input-error');
      showMessage('El campo "N° Trabajadores" es requerido y debe ser un número no negativo.', 3500);
      m('numTrabajadores').focus();
      return false;
    }


    // Validación de radios para Tipo de Inspección
    if (!document.querySelector('input[name="tipoInspeccion"]:checked')) {
      document.querySelectorAll('input[name="tipoInspeccion"]').forEach(radio => radio.classList.add('input-error'));
      showMessage('El campo "Tipo de Inspección" es requerido.', 3500);
      return false;
    }

    // Validación de foto de área inspeccionada (obligatoria)
    if (!fotoAreaBlob) {
      showMessage('La "Fotografía del Área Inspeccionada" es obligatoria.', 3500);
      return false;
    }

    // Validación de firma (obligatoria)
    if (!hasSignedResponsableRegistro) {
      showMessage('Por favor, firme como Responsable del Registro.', 3500);
      return false;
    }

    return true;
  }

  // --- Subida de archivos (firma y foto) ---
  function dataURLtoBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bin  = atob(base64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function uploadFile(fileOrBlob, folder, name) {
    let blobToUpload;
    let fileExtension = 'png'; // Default for canvas

    if (fileOrBlob instanceof HTMLCanvasElement) {
      blobToUpload = dataURLtoBlob(fileOrBlob.toDataURL('image/png'));
    } else if (fileOrBlob instanceof File || fileOrBlob instanceof Blob) { // Ahora acepta File o Blob
      blobToUpload = fileOrBlob;
      fileExtension = blobToUpload.type.split('/')[1];
    } else {
      throw new Error('Tipo de archivo no soportado para subir.');
    }

    const path = `${folder}/${name}_${Date.now()}.${fileExtension}`;
    const snap = await storage.ref(path).put(blobToUpload);
    return snap.ref.getDownloadURL();
  }

  // --- Recoger todos los campos ---
  function collect() {
    const data = {
      // Datos del Documento (fijos)
      codigoDocumento: "JV-SSM-F-018",
      versionDocumento: "03",
      fechaFormato: "27/12/2021",

      // Datos Generales de la Inspección
      razonSocial: m('razonSocial').value.trim(),
      ruc: m('ruc').value.trim(),
      domicilio: m('domicilio').value.trim(),
      actividadEconomica: m('actividadEconomica').value.trim(),
      numTrabajadores: parseInt(m('numTrabajadores').value, 10),
      fechaInspeccion: (() => {
        const [y,mo,d] = m('fechaInspeccion').value.split('-');
        return `${d}/${mo}/${y}`;
      })(),
      horaInspeccion: m('horaInspeccion').value,
      areaInspeccionada: m('areaInspeccionada').value.trim(),
      responsableInspeccion: m('responsableInspeccion').value.trim(),
      tipoInspeccion: document.querySelector('input[name="tipoInspeccion"]:checked').value,
      objetivoInspeccion: m('objetivoInspeccion').value.trim(),

      // Resultado de la Inspección
      resultadoInspeccion: m('resultadoInspeccion').value.trim(),

      // Descripción de la Causa
      descripcionCausa: m('descripcionCausa').value.trim(),

      // Conclusiones y Recomendaciones
      conclusionesRecomendaciones: m('conclusionesRecomendaciones').value.trim(),

      // Responsable del Registro
      nombreResponsableRegistro: m('nombreResponsableRegistro').value.trim(),
      cargoResponsableRegistro: m('cargoResponsableRegistro').value.trim(),
      fechaResponsableRegistro: (() => {
        const [y,mo,d] = m('fechaResponsableRegistro').value.split('-');
        return `${d}/${mo}/${y}`;
      })(),
    };
    return data;
  }

  // --- Envío ---
  async function handleSubmit() {
    if (!validate()) return;
    m('btnEnviarSST').disabled = true;
    overlay.style.display = 'flex';

    try {
      const payload = collect();

      // Subir firma del responsable del registro (obligatoria)
      const urlFirmaResponsableRegistro = await uploadFile(canvasResponsableRegistro, 'inspecciones_sst_firmas', 'firmaResponsableRegistro');
      payload.firmaResponsableRegistro = urlFirmaResponsableRegistro;

      // Subir foto del área inspeccionada (obligatoria)
      if (fotoAreaBlob) { // Doble chequeo aunque la validación ya lo hizo
          const urlFotoArea = await uploadFile(fotoAreaBlob, 'inspecciones_sst_fotos', 'fotoAreaInspeccionada');
          payload.fotoAreaInspeccionada = urlFotoArea;
      }

      // Subir foto de la lista de verificación (opcional)
      if (fotoListaVerificacionBlob) {
        const urlFotoListaVerificacion = await uploadFile(fotoListaVerificacionBlob, 'inspecciones_sst_fotos', 'fotoListaVerificacion');
        payload.fotoListaVerificacion = urlFotoListaVerificacion;
      }

      await db.collection('Inspecciones_SST').add(payload);

      showMessage('¡Registro de Inspección SST guardado correctamente!', 3500);
      m('dataFormSST').reset();
      
      // Resetear campos de firma
      ctxResponsableRegistro.clearRect(0,0,canvasResponsableRegistro.width,canvasResponsableRegistro.height);
      hasSignedResponsableRegistro = false;
      firmaStatusText.textContent = 'No se ha firmado.';
      firmaStatusText.classList.add('required-status');
      firmaStatusText.classList.remove('taken-status');

      // Resetear campos de foto de área
      fotoAreaBlob = null;
      m('previewFotoArea').style.display = 'none';
      m('btnFotoArea').style.display = 'block';
      m('imgFotoArea').src = ''; // Limpiar src de la imagen
      m('fotoAreaStatus').textContent = 'No se ha tomado ninguna foto.';
      m('fotoAreaStatus').classList.add('required-status');
      m('fotoAreaStatus').classList.remove('taken-status');

      // Resetear campos de foto de lista de verificación
      fotoListaVerificacionBlob = null;
      m('previewFotoListaVerificacion').style.display = 'none';
      m('btnFotoListaVerificacion').style.display = 'block';
      m('imgFotoListaVerificacion').src = ''; // Limpiar src de la imagen
      m('fotoListaVerificacionStatus').textContent = 'No se ha tomado ninguna foto.';
      m('fotoListaVerificacionStatus').classList.add('optional-status');
      m('fotoListaVerificacionStatus').classList.remove('taken-status');


    } catch (err) {
      console.error('Error al guardar registro de Inspección SST:', err);
      showMessage('Error al guardar: ' + err.message, 5000);
    } finally {
      overlay.style.display = 'none';
      m('btnEnviarSST').disabled = false;
    }
  }

  m('btnEnviarSST').addEventListener('click', handleSubmit);
});