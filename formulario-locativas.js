// formulario.js

// — Inicializa Firestore y Storage —
const db = firebase.firestore();
const storage = firebase.storage();
const COLLECTION = 'Inspección de Instalaciones Locativas';

// — Elementos del DOM —
const form        = document.getElementById('dataForm');
const btnEnviar   = document.getElementById('btnEnviar');
const canvas      = document.getElementById('firmaCanvas');
const ctx         = canvas.getContext('2d');
const clearFirma  = document.getElementById('clearFirma');

let drawing = false;
let lastX = 0, lastY = 0;
let hasSigned = false;

// — Overlay y mensaje de éxito —
const overlay = document.createElement('div');
overlay.id = 'overlay';
Object.assign(overlay.style, {
  position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
  background: 'rgba(0,0,0,0.5)', display: 'none',
  alignItems: 'center', justifyContent: 'center', zIndex: 9999,
  color: '#fff', fontSize: '1.5rem'
});
overlay.textContent = 'Enviando datos...';
document.body.appendChild(overlay);

const successMsg = document.createElement('div');
successMsg.id = 'successMessage';
successMsg.textContent = '¡Datos enviados exitosamente!';
Object.assign(successMsg.style, {
  position: 'fixed', top: '50%', left: '50%',
  transform: 'translate(-50%,-50%)',
  background: '#fff', color: '#333',
  padding: '1rem 2rem', borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  display: 'none', zIndex: 10000,
});
document.body.appendChild(successMsg);

// 1) Ajuste del canvas al tamaño CSS
function resizeCanvas() {
  const r = canvas.getBoundingClientRect();
  canvas.width  = r.width;
  canvas.height = r.height;
}

window.addEventListener('resize', resizeCanvas);

// 2) Mapeo de coordenadas del puntero al bitmap del canvas
function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const cw = canvas.width, ch = canvas.height;
  const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
  const x = (clientX - rect.left) * (cw / rect.width);
  const y = (clientY - rect.top)  * (ch / rect.height);
  return { x, y };
}

// 3) Control de dibujo
function startDraw(e) {
  drawing = true;
  hasSigned = true;
  const pos = getPointerPos(e);
  lastX = pos.x;
  lastY = pos.y;
}
function draw(e) {
  if (!drawing) return;
  const pos = getPointerPos(e);
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  lastX = pos.x;
  lastY = pos.y;
}
function stopDraw() {
  drawing = false;
}

// Eventos ratón
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup',   stopDraw);
canvas.addEventListener('mouseout',  stopDraw);

// Eventos táctiles
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  startDraw(e);
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  draw(e);
});
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  stopDraw();
});

// Borrar firma
clearFirma.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSigned = false;
});

// 4) Validación básica
function validateForm() {
  const req = [
    { id:'cliente', msg:'Cliente / Unidad' },
    { id:'area', msg:'Área de la inspección' },
    { id:'responsable_inspeccion', msg:'Responsable de la inspección' },
    { id:'cargo_inspector', msg:'Cargo del inspector' },
    { id:'fecha_inspeccion', msg:'Fecha de la inspección' },
    { id:'conclusiones', msg:'Conclusiones' },
    { id:'nombreRegistro', msg:'Nombres y Apellidos (registro)' },
    { id:'cargoRegistroCell', msg:'Cargo (registro)' },
    { id:'fechaRegistroCell', msg:'Fecha (registro)' },
  ];
  for (const f of req) {
    const el = document.getElementById(f.id);
    if (!el || !el.value.trim()) {
      alert(`Completa el campo: ${f.msg}`);
      if (el) el.focus();
      return false;
    }
  }
  if (!hasSigned) {
    alert('Por favor firma antes de enviar.');
    return false;
  }
  return true;
}

// 5) DataURL → Blob
function dataURLtoBlob(dataURL) {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// 6) Recopilar todos los campos
function collectPayload() {
  const p = {};
  p.codigo             = document.getElementById('codigo').value;
  p.version            = document.getElementById('version').value;
  p.fechaDocumento     = document.getElementById('fechaDocumento').value;
  p.cliente            = document.getElementById('cliente').value;
  p.area               = document.getElementById('area').value;
  p.responsableInspeccion = document.getElementById('responsable_inspeccion').value;
  p.cargoInspector     = document.getElementById('cargo_inspector').value;
  const fi = document.getElementById('fecha_inspeccion').value;
  if (fi) {
    const [y,m,d] = fi.split('-');
    p.fechaInspeccion = `${d}/${m}/${y}`;
  }
  p.conclusiones         = document.getElementById('conclusiones').value;
  p.nombreRegistro       = document.getElementById('nombreRegistro').value;
  p.cargoRegistroCell    = document.getElementById('cargoRegistroCell').value;
  p.fechaRegistroCell    = document.getElementById('fechaRegistroCell').value;

  const items = [
    'pisosBuenEstado','superficiesAntideslizantes','antideslizantesBuenEstado',
    'paredesBuenEstado','marcasHumedad','sinGrietas','techosBuenEstado',
    'vidriosBuenEstado','ventanasLimpias','proteccionRompimiento',
    'puertasBuenEstado','noObstaculizadas','propiciasEmergencia',
    'sillasErgonomicas','luminariasBuenEstado','mobiliariosAnclados','equiposOficinaLimpios',
    'lugarSeguro','senalizacionDemarcacion','areasLimpias',
    'lineasEntubadas','conexionesPozoTierra','sinSobrecarga','empalmesBuenEstado'
  ];
  items.forEach(key => {
    const sel = document.querySelector(`input[name="${key}"]:checked`);
    p[`${key}Cumple`]    = sel?.value === 'Cumple';
    p[`${key}NoCumple`]  = sel?.value === 'NoCumple';
    p[`${key}NoAplica`]  = sel?.value === 'NoAplica';
    p[`${key}Observaciones`] = document.getElementById(`${key}Observaciones`).value || '';
  });

  return p;
}

// 7) Envío a Firestore + Storage y mensajes
async function handleSubmit() {
  if (!validateForm()) return;
  btnEnviar.disabled = true;
  overlay.style.display = 'flex';

  try {
    // subir firma
    const dataURL = canvas.toDataURL('image/png');
    const blob    = dataURLtoBlob(dataURL);
    const snap    = await storage
      .ref(`Inspeccion_Locativas/firma_${Date.now()}.png`)
      .put(blob);
    const firmaURL = await snap.ref.getDownloadURL();

    // payload
    const payload = collectPayload();
    payload.firma = firmaURL;

    // guardar
    await db.collection(COLLECTION).add(payload);

    // éxito
    overlay.style.display = 'none';
    successMsg.style.display = 'block';

    // limpiar formulario
    form.reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasSigned = false;

    setTimeout(() => {
      successMsg.style.display = 'none';
      btnEnviar.disabled = false;
    }, 3000);

  } catch (err) {
    console.error(err);
    overlay.style.display = 'none';
    alert('Error al guardar, revisa la consola.');
    btnEnviar.disabled = false;
  }
}

btnEnviar.addEventListener('click', handleSubmit);
