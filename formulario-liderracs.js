// Inicialización de Firebase ya está hecha en firebase-config.js
const db = firebase.firestore();
const storage = firebase.storage();
const COLLECTION = 'LiderRacs';

const form = document.getElementById('racsForm');
const canvas = document.getElementById('firmaCanvas');
const ctx = canvas.getContext('2d');
const previewFoto = document.getElementById('previewFoto');

let drawing = false;
let hasSigned = false;
let lastX = 0, lastY = 0;
let photoURL = "";

function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('load', resizeCanvas);
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousedown', e => {
  drawing = true;
  hasSigned = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  [lastX, lastY] = [e.offsetX, e.offsetY];
});
canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

document.getElementById('clearFirma').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSigned = false;
});

// Captura desde cámara
const abrirCamara = document.getElementById('photo-btn');
const cameraView = document.getElementById('capture-container');
const video = document.getElementById('camera-stream');
const tomarFoto = document.getElementById('capture-btn');
let stream = null;

abrirCamara.addEventListener('click', async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    cameraView.style.display = 'flex';
  } catch (err) {
    console.error('Error al acceder a la cámara:', err);
    alert('No se pudo acceder a la cámara. Verifica los permisos del navegador.');
  }
});

tomarFoto.addEventListener('click', async () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const context = tempCanvas.getContext('2d');
  context.drawImage(video, 0, 0);

  const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg'));
  const nombre = `liderracs_fotos/${Date.now()}.jpg`;
  const ref = storage.ref(nombre);
  await ref.put(blob);
  photoURL = await ref.getDownloadURL();

  previewFoto.src = photoURL;
  previewFoto.style.display = 'block';

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
  cameraView.style.display = 'none';
});

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

function mostrarMensajeCentrado(texto) {
  const div = document.createElement('div');
  div.id = 'mensaje-flotante';
  div.textContent = texto;
  div.style.position = 'fixed';
  div.style.top = '50%';
  div.style.left = '50%';
  div.style.transform = 'translate(-50%, -50%)';
  div.style.background = 'rgba(0,0,0,0.85)';
  div.style.color = '#fff';
  div.style.padding = '20px 40px';
  div.style.fontSize = '18px';
  div.style.borderRadius = '10px';
  div.style.zIndex = '3000';
  div.style.textAlign = 'center';
  div.style.animation = 'fadeIn 0.3s ease';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  const categoriasSeleccionadas = [...document.querySelectorAll('input[name="categoria"]:checked')].map(el => el.value);

  const requiredFields = [
    'fecha_actual', 'razon_social', 'cliente', 'unidad',
    'lider_zonal', 'fecha_reporte', 'hora_reporte', 'tipo_reporte',
    'descripcion', 'accion', 'reportado_por', 'cargo', 'contacto'
  ];

  for (let id of requiredFields) {
    const field = document.getElementById(id);
    field.classList.remove('input-error');
    if (!field.value.trim()) {
      field.classList.add('input-error');
      alert('Por favor completa todos los campos obligatorios.');
      field.focus();
      return;
    }
  }

  const macrozonaGroup = document.getElementById('macrozona-group');
  const macrozona = document.getElementById('macrozona');
  macrozona.classList.remove('input-error');
  if (macrozonaGroup && macrozonaGroup.style.display !== 'none') {
    if (!macrozona.value.trim()) {
      macrozona.classList.add('input-error');
      alert('Por favor selecciona una macrozona.');
      macrozona.focus();
      return;
    }
  }

  if (categoriasSeleccionadas.length === 0) {
    alert('Debes seleccionar al menos una categoría de la condición o acto inseguro.');
    return;
  }

  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading-overlay';
  loadingOverlay.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(loadingOverlay);

  const data = {
    fecha_actual: formatDate(document.getElementById('fecha_actual').value),
    razon_social: document.getElementById('razon_social').value,
    macrozona: macrozona ? macrozona.value : '',
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
    if (photoURL) {
      data.foto = photoURL;
    }

    if (hasSigned) {
      const dataURL = canvas.toDataURL();
      const blob = dataURLtoBlob(dataURL);
      const firmaRef = storage.ref(`liderracs_firmas/firma_${Date.now()}.png`);
      const snap = await firmaRef.put(blob);
      data.firma = await snap.ref.getDownloadURL();
    }

    await db.collection(COLLECTION).add(data);
    mostrarMensajeCentrado('✅ Reporte enviado exitosamente');
    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    previewFoto.style.display = 'none';
  } catch (error) {
    console.error('Error al enviar reporte:', error);
    alert('Error al enviar el reporte. Intenta nuevamente.');
  } finally {
    document.body.removeChild(loadingOverlay);
  }
});
