// formulario.js

// — Inicializa Firestore y Storage (firebase-config.js debe incluir firebase-app, firestore-compat y storage-compat) —
const db = firebase.firestore();
const storage = firebase.storage();
const COLLECTION = 'Verificación de Botiquines';

// — Elementos del DOM —
const btnEnviar = document.getElementById('btnEnviar');
const canvas     = document.getElementById('firmaCanvas');
const ctx        = canvas.getContext('2d');

// — Estado —
let drawing   = false;
let lastX     = 0;
let lastY     = 0;
let hasSigned = false;
const params = new URLSearchParams(location.search);
const docId  = params.get('id');

// — Ajuste del canvas —
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', () => {
  resizeCanvas();
  loadRecordIfNeeded();
});

// — Funciones de dibujo en canvas —
function startDraw(e) {
  drawing   = true;
  hasSigned = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
}
function draw(e) {
  if (!drawing) return;
  ctx.strokeStyle = '#000';
  ctx.lineWidth   = 2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  [lastX, lastY] = [e.offsetX, e.offsetY];
}
function stopDraw() {
  drawing = false;
}
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0], r = canvas.getBoundingClientRect();
  startDraw({ offsetX: t.clientX - r.left, offsetY: t.clientY - r.top });
});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0], r = canvas.getBoundingClientRect();
  draw({ offsetX: t.clientX - r.left, offsetY: t.clientY - r.top });
});
canvas.addEventListener('touchend', e => { e.preventDefault(); stopDraw(); });

// — Borrar firma —
document.getElementById('clearFirma').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSigned = false;
});

// — Carga registro si existe docId (modo edición) —
function loadRecordIfNeeded() {
  if (!docId) return;
  btnEnviar.textContent = 'Actualizar';
  db.collection(COLLECTION).doc(docId).get()
    .then(docSnap => {
      if (!docSnap.exists) throw new Error('Registro no encontrado');
      const data = docSnap.data();
      // Rellenar campos generales
      ['cliente','fecha_inspeccion','responsable_inspeccion','cargo_inspector','conclusiones']
        .forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = data[id] || '';
        });
      // Rellenar tabla
      for (let i = 1; i <= 10; i++) {
        ['n_botiquin','ubicacion','accesible','vigente','estado','leyenda','obstruidos','observacion']
          .forEach(f => {
            const el = document.getElementById(f + i);
            if (el) el.value = data[f + i] || '';
          });
      }
      // Cargar firma desde Storage URL
      if (data.firma) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.src    = data.firma;
        hasSigned  = true;
      }
    })
    .catch(console.error);
}

// — Validación de campos obligatorios —
function validateForm() {
  const required = [
    { id: 'cliente',                msg: 'Cliente / Unidad' },
    { id: 'fecha_inspeccion',       msg: 'Fecha de la Inspección' },
    { id: 'responsable_inspeccion', msg: 'Responsable de la Inspección' },
    { id: 'cargo_inspector',        msg: 'Cargo del Inspector' },
    { id: 'conclusiones',           msg: 'Conclusiones' }
  ];
  for (const field of required) {
    const el = document.getElementById(field.id);
    if (!el || !el.value.trim()) {
      alert(`Por favor completa el campo: ${field.msg}.`);
      el && el.focus();
      return false;
    }
  }
  if (!hasSigned) {
    alert('Por favor firma en el recuadro antes de enviar.');
    return false;
  }
  return true;
}

// — Convierte DataURL a Blob para Storage ---
function dataURLtoBlob(dataURL) {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    buf[i] = bytes.charCodeAt(i);
  }
  return new Blob([buf], { type: mime });
}

// — Recopila formulario excepto firma URL ---
function collectFields() {
  const p = {};
  ['codigo','version','fecha',
   'cliente','fecha_inspeccion','responsable_inspeccion','cargo_inspector','conclusiones']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) p[id] = el.value;
    });
  for (let i = 1; i <= 10; i++) {
    ['n_botiquin','ubicacion','accesible','vigente','estado','leyenda','obstruidos','observacion']
      .forEach(f => {
        const el = document.getElementById(f + i);
        if (el) p[f + i] = el.value;
      });
  }
  return p;
}

// — Muestra modal de confirmación con botón Aceptar ---
function showSuccessModal() {
  const overlay = document.createElement('div');
  overlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5); display: flex;
    align-items: center; justify-content: center;
    z-index: 1000;
  `;
  const box = document.createElement('div');
  box.style = `
    background: #fff; padding: 20px; border-radius: 8px;
    max-width: 300px; text-align: center;
  `;
  box.innerHTML = `
    <p>¡Datos guardados correctamente!</p>
    <button id="modalOk" style="
      margin-top: 12px; padding: 8px 16px; background: #1E88E5;
      color: #fff; border: none; border-radius: 6px; cursor: pointer;
    ">Aceptar</button>
  `;
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.getElementById('modalOk').addEventListener('click', () => {
    document.body.removeChild(overlay);
    clearForm();
  });
}

// — Limpia todos los campos para un nuevo registro ---
function clearForm() {
  // Campos de texto
  ['cliente','fecha_inspeccion','responsable_inspeccion','cargo_inspector','conclusiones']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  // Tabla
  for (let i = 1; i <= 10; i++) {
    ['n_botiquin','ubicacion','accesible','vigente','estado','leyenda','obstruidos','observacion']
      .forEach(f => {
        const el = document.getElementById(f + i);
        if (el) {
          if (el.tagName === 'SELECT') el.selectedIndex = 0;
          else el.value = '';
        }
      });
  }
  // Borrar firma
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSigned = false;
  // Mantener datos fijos (código, versión, fecha)
}

// — Envío o actualización en Firestore + Storage sin redirección —
btnEnviar.addEventListener('click', async () => {
  if (!validateForm()) return;

  try {
    // 1) sube firma a Storage
    const dataURL = canvas.toDataURL('image/png');
    const blob    = dataURLtoBlob(dataURL);
    const filename = `Verificación_Botiquines/firma_${Date.now()}.png`;
    const snap    = await storage.ref(filename).put(blob);
    const firmaURL = await snap.ref.getDownloadURL();

    // — 2) recopila campos y formatea la fecha en dd/mm/yyyy, luego añade URL de firma —
const payload = collectFields();
// Si existe fecha_inspeccion, la convertimos de "YYYY-MM-DD" a "DD/MM/YYYY"
if (payload.fecha_inspeccion) {
  const [year, month, day] = payload.fecha_inspeccion.split('-');
  payload.fecha_inspeccion = `${day}/${month}/${year}`;
}
payload.firma = firmaURL;

    // 3) guarda en Firestore
    const col = db.collection(COLLECTION);
    if (docId) {
      await col.doc(docId).update(payload);
    } else {
      await col.add(payload);
    }

    // 4) muestra modal de éxito
    showSuccessModal();

  } catch (err) {
    console.error('Error guardando datos:', err);
    alert('Hubo un error al guardar. Revisa la consola.');
  }
});
