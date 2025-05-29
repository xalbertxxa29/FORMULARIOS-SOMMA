// formulario-aspectos-ambientales.js

// 1) Helper global (debe ir **antes** de cualquier uso de `m()`)
const m = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  // 2) Firebase
  if (!firebase.apps.length) {
    console.error('Firebase no está inicializado. Revisa firebase-config.js');
  }
  const db      = firebase.firestore();
  const storage = firebase.storage();

  // 3) Overlay de carga
  let overlay = m('overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.5)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '1.25rem',
      zIndex: 9999,
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
      position: 'fixed',
      top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      padding: '16px 24px',
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
      display: 'none',
      zIndex: 10000,
      textAlign: 'center',
      fontSize: '1.1rem',
      color: '#333',
    });
    document.body.appendChild(messageBox);
  }
  function showMessage(text, duration = 2500) {
    messageBox.textContent = text;
    messageBox.style.display = 'block';
    setTimeout(() => messageBox.style.display = 'none', duration);
  }

  // 5) Preparar canvases para dos firmas
  const canvas1 = m('firmaCanvas'),        ctx1 = canvas1.getContext('2d');
  const canvas2 = m('firmaCanvasSeguidor'),ctx2 = canvas2.getContext('2d');
  let hasSigned1 = false, hasSigned2 = false;

  function resizeCanvases() {
    [canvas1, canvas2].forEach(c => {
      c.width  = c.offsetWidth;
      c.height = c.offsetHeight;
    });
    [ctx1, ctx2].forEach(ctx => {
      ctx.lineJoin = 'round';
      ctx.lineCap  = 'round';
    });
  }
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  function attachSigner(canvas, ctx, flagSetter) {
    let drawing = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', e => {
      drawing = true; flagSetter(true);
      [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    canvas.addEventListener('pointermove', e => {
      if (!drawing) return;
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.offsetX, e.offsetY);
      ctx.stroke();
      [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    ['pointerup','pointerout'].forEach(evt =>
      canvas.addEventListener(evt, () => drawing = false)
    );
  }

  attachSigner(canvas1, ctx1, v => hasSigned1 = v);
  attachSigner(canvas2, ctx2, v => hasSigned2 = v);

  m('clearFirma').addEventListener('click', () => {
    ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
    hasSigned1 = false;
  });
  m('clearFirmaSeguidor').addEventListener('click', () => {
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);
    hasSigned2 = false;
  });

  // 6) Validación
  function validate() {
    if (!m('unidad').value.trim())                { showMessage('Unidad es requerida'); return false; }
    if (!m('puesto').value.trim())                { showMessage('Puesto es requerido'); return false; }
    if (!m('fechaInspeccion').value)              { showMessage('Fecha de inspección es requerida'); return false; }
    if (!m('inspectorNombre').value.trim())       { showMessage('Nombre/Cargo del inspector es requerido'); return false; }
    if (!hasSigned1)                              { showMessage('Por favor firme como inspector'); return false; }
    if (!m('seguidorNombre').value.trim())        { showMessage('Nombre/Cargo responsable seguimiento requerido'); return false; }
    if (!hasSigned2)                              { showMessage('Por favor firme como responsable de seguimiento'); return false; }
    if (!m('fechaSeguimiento').value)             { showMessage('Fecha de seguimiento es requerida'); return false; }
    return true;
  }

  // 7) Conversión DataURL→Blob
  function dataURLtoBlob(dataURL) {
    const [header, base64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)[1];
    const bin  = atob(base64);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  // 8) Subida de canvas
  async function uploadCanvas(canvas, folder, name) {
    const blob = dataURLtoBlob(canvas.toDataURL('image/png'));
    const path = `${folder}/${name}_${Date.now()}.png`;
    const snap = await storage.ref(path).put(blob);
    return snap.ref.getDownloadURL();
  }

  // 9) Recoger todos los campos
  function collect() {
    const p = {
      unidad:           m('unidad').value.trim(),
      puesto:           m('puesto').value.trim(),
      fechaInspeccion:  (() => {
        const [y,mo,d] = m('fechaInspeccion').value.split('-');
        return `${d}/${mo}/${y}`;
      })(),
      inspectorNombre:  m('inspectorNombre').value.trim(),
      seguidorNombre:   m('seguidorNombre').value.trim(),
      fechaSeguimiento: (() => {
        const [y,mo,d] = m('fechaSeguimiento').value.split('-');
        return `${d}/${mo}/${y}`;
      })(),
      observaciones:    m('observaciones').value.trim(),
      hallazgos:        m('hallazgos').value.trim(),
      planAccion:       m('planAccion').value.trim(),
      responsable:      m('responsable').value.trim()
    };
    function cap(pref, n) {
      for (let i = 1; i <= n; i++) {
        ['Bueno','Malo','NA'].forEach(v => {
          p[`${pref}${i}${v}`] =
            !!document.querySelector(`input[name="${pref}${i}"]:checked[value="${v}"]`);
        });
      }
    }
    cap('papel',   5);
    cap('energia', 7);
    cap('agua',    7);
    cap('resLiq',  3);
    cap('resPel',  5);
    cap('regEst',  4);
    cap('tomCo',   7);
    return p;
  }

  // 10) Envío
  async function handleSubmit() {
    if (!validate()) return;
    m('btnEnviar').disabled = true;
    overlay.style.display = 'flex';

    try {
      const [url1, url2] = await Promise.all([
        uploadCanvas(canvas1, 'aspectos_ambientales', 'firmaInspector'),
        uploadCanvas(canvas2, 'aspectos_ambientales', 'firmaSeguidor')
      ]);

      const payload = collect();
      payload.inspectorFirma = url1;
      payload.seguidorFirma  = url2;

      await db.collection('aspectos ambientales').add(payload);

      showMessage('¡Datos guardados correctamente!');
      m('dataForm').reset();
      ctx1.clearRect(0,0,canvas1.width,canvas1.height);
      ctx2.clearRect(0,0,canvas2.width,canvas2.height);
      hasSigned1 = hasSigned2 = false;
    } catch (err) {
      console.error('Error al guardar datos:', err);
      showMessage('Error al guardar: ' + err.message);
    } finally {
      overlay.style.display = 'none';
      m('btnEnviar').disabled = false;
    }
  }

  m('btnEnviar').addEventListener('click', handleSubmit);
});
