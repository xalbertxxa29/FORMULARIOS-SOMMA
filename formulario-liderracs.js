// Inicialización de Firebase ya está hecha en firebase-config.js
const db = firebase.firestore();
const storage = firebase.storage();
const COLLECTION = 'LiderRacs';

const form = document.getElementById('racsForm');
const canvas = document.getElementById('firmaCanvas');
const ctx = canvas.getContext('2d');
const previewFoto = document.getElementById('previewFoto'); // Asumo que esto es para la previsualización de la foto
const photoBtn = document.getElementById('photo-btn'); // Botón para tomar foto
const clearFirmaBtn = document.getElementById('clearFirma'); // Botón para limpiar firma
const btnEnviar = document.getElementById('btnEnviar'); // Botón de enviar

// Elementos del overlay de cámara
const cameraOverlay = document.getElementById('capture-container'); // Usamos el ID del contenedor de la cámara
const videoStream = document.getElementById('camera-stream'); // Video donde se muestra el stream
const captureBtn = document.getElementById('capture-btn'); // Botón de capturar en el overlay
const closeCameraBtn = document.getElementById('close-camera-button'); // Botón de cerrar cámara en el overlay

let drawing = false;
let hasSigned = false;
let lastX = 0, lastY = 0;
let photoURL = ""; // URL de la foto subida a Storage
let currentStream = null; // Para guardar el stream de la cámara

// Helper para mostrar mensajes flotantes
function mostrarMensajeFlotante(texto, tipo = 'error') { // tipo puede ser 'error', 'success', etc.
    // Intenta usar el div existente si ya se creó en una llamada anterior
    let mensajeFlotanteDiv = document.getElementById('mensaje-flotante');
    if (!mensajeFlotanteDiv) {
        mensajeFlotanteDiv = document.createElement('div');
        mensajeFlotanteDiv.id = 'mensaje-flotante';
        document.body.appendChild(mensajeFlotanteDiv);
    }

    mensajeFlotanteDiv.textContent = texto;
    mensajeFlotanteDiv.style.background = tipo === 'error' ? 'rgba(231, 76, 60, 0.9)' : 'rgba(39, 174, 96, 0.9)';
    mensajeFlotanteDiv.style.color = '#fff';
    mensajeFlotanteDiv.style.padding = '20px 40px';
    mensajeFlotanteDiv.style.fontSize = '18px';
    mensajeFlotanteDiv.style.borderRadius = '10px';
    mensajeFlotanteDiv.style.zIndex = '3000';
    mensajeFlotanteDiv.style.textAlign = 'center';
    mensajeFlotanteDiv.style.animation = 'fadeIn 0.3s ease'; // Necesitará una animación CSS llamada fadeIn
    mensajeFlotanteDiv.style.display = 'block';

    setTimeout(() => {
        if (mensajeFlotanteDiv) {
            mensajeFlotanteDiv.style.display = 'none';
        }
    }, 3000);
}

// Helper para mostrar/ocultar overlay de carga
function showLoadingOverlay() {
    let loadingOverlay = document.getElementById('loading-overlay');
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.innerHTML = '<div class="spinner"></div>'; // Asegúrate de tener este CSS para .spinner
        document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
}

function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// --- Funcionalidad de Firma ---
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.strokeStyle = '#000'; // Color de la línea de firma
  ctx.lineWidth = 2; // Grosor de la línea
  ctx.lineCap = 'round'; // Estilo de la punta de la línea
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

// CAMBIOS CRUCIALES AQUÍ para la firma en móviles:
// Usaremos addEventListener con 'passive: false' para forzar el preventDefault
// Y también intentaremos bloquear el scroll del body
canvas.addEventListener('touchstart', e => {
  e.preventDefault(); // Detener el desplazamiento de la página al inicio del toque
  drawing = true;
  hasSigned = true;
  // Obtener la posición del toque
  const touch = e.touches[0];
  lastX = touch.clientX - canvas.getBoundingClientRect().left;
  lastY = touch.clientY - canvas.getBoundingClientRect().top;
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  document.body.style.overflow = 'hidden'; // Bloquear el scroll del body
}, { passive: false }); // { passive: false } es CLAVE para que preventDefault funcione en touchstart/touchmove

canvas.addEventListener('touchmove', e => {
  if (!drawing) return;
  e.preventDefault(); // Detener el desplazamiento de la página durante el movimiento del toque
  const touch = e.touches[0];
  const currentX = touch.clientX - canvas.getBoundingClientRect().left;
  const currentY = touch.clientY - canvas.getBoundingClientRect().top;
  ctx.lineTo(currentX, currentY);
  ctx.stroke();
  lastX = currentX;
  lastY = currentY;
}, { passive: false }); // { passive: false } es CLAVE

['touchend', 'touchcancel'].forEach(evt => {
  canvas.addEventListener(evt, () => {
    drawing = false;
    document.body.style.overflow = ''; // Restaurar el scroll del body
  });
});

// También mantenemos pointer events para mouse/stylus y como fallback, aunque touch events son prioritarios para dedos
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return; // Si es un toque, los touch events ya lo manejan
  e.preventDefault();
  drawing = true;
  hasSigned = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
});
canvas.addEventListener('pointermove', e => {
  if (!drawing || e.pointerType === 'touch') return; // Si es un toque, los touch events ya lo manejan
  e.preventDefault();
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
['pointerup', 'pointerout', 'pointercancel'].forEach(evt => {
  canvas.addEventListener(evt, () => drawing = false);
});


clearFirmaBtn.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSigned = false;
});

// --- Funcionalidad de Cámara ---
photoBtn.addEventListener('click', async () => {
  try {
    // Pedir cámara trasera preferentemente
    currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    videoStream.srcObject = currentStream;
    cameraOverlay.style.display = 'flex'; // Mostrar el overlay de la cámara
    document.body.style.overflow = 'hidden'; // Bloquear el scroll del body al abrir la cámara
  } catch (err) {
    console.error('Error al acceder a la cámara:', err);
    mostrarMensajeFlotante('No se pudo acceder a la cámara. Revisa los permisos o intenta de nuevo.', 'error');
  }
});

captureBtn.addEventListener('click', async () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = videoStream.videoWidth;
  tempCanvas.height = videoStream.videoHeight;
  const context = tempCanvas.getContext('2d');
  context.drawImage(videoStream, 0, 0, tempCanvas.width, tempCanvas.height);

  const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 0.9)); // Calidad JPEG 0.9
  const nombre = `liderracs_fotos/${Date.now()}.jpg`;
  const ref = storage.ref(nombre);
  await ref.put(blob);
  photoURL = await ref.getDownloadURL(); // Guardar la URL de la foto

  previewFoto.src = photoURL;
  previewFoto.style.display = 'block'; // Mostrar la previsualización

  closeCamera(); // Cierra la cámara después de capturar
});

// Botón para cerrar la cámara sin capturar
if (closeCameraBtn) { // Asegurarse de que el botón existe
    closeCameraBtn.addEventListener('click', closeCamera);
}


function closeCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop()); // Detener todas las pistas (video, audio)
  }
  cameraOverlay.style.display = 'none'; // Ocultar el overlay de la cámara
  document.body.style.overflow = ''; // Restaurar el scroll del body al cerrar la cámara
}

function dataURLtoBlob(dataURL) {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function formatDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// --- Validación y Envío del Formulario ---
form.addEventListener('submit', async e => {
  e.preventDefault();
  btnEnviar.disabled = true; // Deshabilita el botón para evitar envíos múltiples
  showLoadingOverlay(); // Muestra el overlay de carga

  const categoriasSeleccionadas = [...document.querySelectorAll('input[name="categoria"]:checked')].map(el => el.value);

  // Array de IDs de todos los campos que deben ser obligatorios.
  const allRequiredFields = [
    'fecha_actual', 'razon_social', 'cliente', 'unidad',
    'lider_zonal', 'fecha_reporte', 'hora_reporte', 'tipo_reporte',
    'descripcion', 'accion', 'reportado_por', 'cargo', 'contacto'
  ];

  // Restablecer estilos de error y verificar campos
  let isValid = true;
  let firstInvalidField = null;

  for (let id of allRequiredFields) {
    const field = document.getElementById(id);
    // Remover clase de error de cualquier campo
    field.classList.remove('input-error');

    // Validar si el campo está vacío
    if (!field.value.trim()) {
      field.classList.add('input-error');
      if (!firstInvalidField) { // Solo guarda el primer campo inválido para enfocar
        firstInvalidField = field;
      }
      isValid = false;
    }
  }

  // Validación condicional de Macrozona
  const macrozonaGroup = document.getElementById('macrozona-group');
  const macrozona = document.getElementById('macrozona');
  macrozona.classList.remove('input-error');
  if (macrozonaGroup && macrozonaGroup.style.display !== 'none') {
    if (!macrozona.value.trim()) {
      macrozona.classList.add('input-error');
      if (!firstInvalidField) {
        firstInvalidField = macrozona;
      }
      isValid = false;
    }
  }

  // Validación de Categorías (al menos una seleccionada)
  if (categoriasSeleccionadas.length === 0) {
    // Solo mostramos el mensaje si no hay otros errores de campos de texto/select primero
    if (isValid) {
      mostrarMensajeFlotante('Debes seleccionar al menos una categoría de la condición o acto inseguro.', 'error');
    }
    isValid = false;
  }

  // Validación de Fotografía (obligatoria)
  if (!photoURL) {
    if (isValid) {
      mostrarMensajeFlotante('La Fotografía del Reporte es obligatoria.', 'error');
    }
    isValid = false;
  }

  // Validación de Firma (obligatoria)
  if (!hasSigned) {
    if (isValid) {
      mostrarMensajeFlotante('La Firma del Reportante es obligatoria.', 'error');
    }
    isValid = false;
  }

  // Si no es válido, detiene el envío y enfoca el primer campo inválido
  if (!isValid) {
    if (firstInvalidField) {
      firstInvalidField.focus();
    }
    btnEnviar.disabled = false;
    hideLoadingOverlay();
    return;
  }

  // Si todas las validaciones pasan, procede con el envío
  const data = {
    fecha_actual: formatDate(document.getElementById('fecha_actual').value),
    razon_social: document.getElementById('razon_social').value,
    macrozona: macrozonaGroup && macrozonaGroup.style.display !== 'none' ? macrozona.value : '', // Solo incluye si es visible
    cliente: document.getElementById('cliente').value,
    unidad: document.getElementById('unidad').value,
    lider_zonal: document.getElementById('lider_zonal').value,
    fecha_reporte: formatDate(document.getElementById('fecha_reporte').value),
    hora_reporte: document.getElementById('hora_reporte').value,
    tipo_reporte: document.getElementById('tipo_reporte').value,
    categoria: categoriasSeleccionadas,
    descripcion: document.getElementById('descripcion').value,
    accion: document.getElementById('accion').value,
    reportado_por: document.getElementById('reportado_por').value,
    cargo: document.getElementById('cargo').value,
    contacto: document.getElementById('contacto').value
  };

  try {
    // La foto ya está subida y photoURL tiene su URL
    data.foto = photoURL;

    // Subir la firma
    const firmaDataURL = canvas.toDataURL('image/png'); // Asegurarse de exportar como PNG
    const blobFirma = dataURLtoBlob(firmaDataURL);
    const firmaRef = storage.ref(`liderracs_firmas/firma_${Date.now()}.png`);
    const snapFirma = await firmaRef.put(blobFirma);
    data.firma = await snapFirma.ref.getDownloadURL();

    await db.collection(COLLECTION).add(data);
    mostrarMensajeFlotante('✅ Reporte enviado exitosamente', 'success');
    form.reset(); // Resetea el formulario después del envío exitoso
    
    // Limpiar firma y foto
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigned = false;
    photoURL = "";
    previewFoto.style.display = 'none';
    previewFoto.src = ''; // Limpiar la fuente de la imagen de previsualización

  } catch (error) {
    console.error('Error al enviar reporte:', error);
    mostrarMensajeFlotante('Error al enviar el reporte. Intenta nuevamente.', 'error');
  } finally {
    hideLoadingOverlay(); // Oculta el overlay de carga
    btnEnviar.disabled = false; // Rehabilita el botón de envío
  }
});