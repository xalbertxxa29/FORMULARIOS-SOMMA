// Oculta todas las secciones menos la indicada
function showPage(pageId) {
    const pages = ['main', 'inspeccion', 'sst', 'ambiental', 'reportes'];
    pages.forEach(id => {
        document.getElementById(id).classList.toggle('hidden', id !== pageId);
    });

    if (pageId !== 'reportes') {
        document.getElementById('embedContainer').innerHTML = '';
    }
}

// Vuelve al menú principal
function showMain() {
    showPage('main');
}

// Carga un iframe en REPORTES y muestra esa sección (excepto LIDER RACS)
function loadIframe(url) {
    // Redirección directa si es el formulario LIDER RACS
    if (url === 'formulario-liderracs.html') {
        window.location.href = url;
        return;
    }

    const embedContainer = document.getElementById('embedContainer');
    embedContainer.innerHTML = ''; // limpia cualquier iframe previo

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.width = '100%';
    iframe.height = '600px';
    iframe.style.border = 'none';
    iframe.setAttribute('allow', 'camera; microphone'); // Permitir cámara

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        mostrarAlerta('Este navegador no soporta acceso a cámara.');
    }

    embedContainer.appendChild(iframe);
    showPage('reportes');
}

// Muestra un mensaje de alerta flotante centrado
function mostrarAlerta(mensaje) {
    const alerta = document.createElement('div');
    alerta.textContent = mensaje;
    alerta.style.position = 'fixed';
    alerta.style.top = '50%';
    alerta.style.left = '50%';
    alerta.style.transform = 'translate(-50%, -50%)';
    alerta.style.background = 'rgba(255, 0, 0, 0.85)';
    alerta.style.color = '#fff';
    alerta.style.padding = '20px 40px';
    alerta.style.fontSize = '18px';
    alerta.style.borderRadius = '10px';
    alerta.style.zIndex = '5000';
    alerta.style.textAlign = 'center';
    alerta.style.boxShadow = '0 0 10px #000';
    alerta.style.animation = 'fadeIn 0.3s ease';

    document.body.appendChild(alerta);
    setTimeout(() => alerta.remove(), 4000);
}
