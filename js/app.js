// CONFIGURACIÓN CENTRALIZADA CON VARIABLE DE VERSIÓN INCLUIDA
    const CONFIG = {
      title: "Documentos Vehiculares",
      brand: "TECH® | RdeG | 2026",
      version: "v5.0.0",
      logo: "img/Tech-logo.svg",
      phone: "50241084481",
      waMsg: "Hola TECH®, solicito soporte para el ID: ",
      waCommercialMsg: "Hola TECH®, deseo información de sus productos. Vengo de la aplicación de Gestión Documental Vehicular.",
      csvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZah1DN6oRs_TNYw_dScsbpDmG9PL_hxVaVWZfzejdGTNzkaIw8BhJSBVp6ygnejLr1lRUFUGfMRSu/pub?output=csv"
    };

    let currentRotation = 0;
    let targetPin = ""; 
    let globalStructure = {};
    let globalIdURL = "";

    function hexToRgb(hex) {
      if (!hex) return null;
      hex = hex.trim().replace('#', '');
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      if (hex.length !== 6) return null;
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
      return { r, g, b };
    }

    async function loadInlineLogo() {
      try {
        const resp = await fetch(CONFIG.logo);
        const svgText = await resp.text();
        const headerLogo = document.getElementById('header-logo');
        const pinLogo = document.getElementById('pin-logo');
        if (headerLogo) headerLogo.innerHTML = svgText;
        if (pinLogo) pinLogo.innerHTML = svgText;
      } catch (e) {
        console.error("No se pudo cargar el logo SVG", e);
      }
    }

    async function init() {
      try {
        document.getElementById('portal-title').textContent = CONFIG.title;
        await loadInlineLogo();
        
        document.getElementById('footer-brand').textContent = CONFIG.brand;
        
        // Renderizado dinámico de la versión desde el objeto CONFIG
        document.getElementById('footer-version-label').textContent = `PORTAL OFICIAL | ${CONFIG.version}`;

        const params = new URLSearchParams(window.location.search);
        globalIdURL = params.get('id');

        const supportUrl = `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(CONFIG.waMsg + (globalIdURL || "Desconocido"))}`;
        const commercialUrl = `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(CONFIG.waCommercialMsg)}`;
        
        if(document.getElementById('pin-wa-link')) document.getElementById('pin-wa-link').href = supportUrl;
        if(document.getElementById('wa-link')) document.getElementById('wa-link').href = supportUrl;
        if(document.getElementById('commercial-wa-link')) document.getElementById('commercial-wa-link').href = commercialUrl;

        if (!globalIdURL) {
          showErrorMessage("ID Requerido", "Por favor, utiliza un enlace con un ID de cliente válido.");
          return;
        }

        const response = await fetch(CONFIG.csvUrl);
        if (!response.ok) throw new Error("Error de Red");
        
        const text = await response.text();
        const rows = csvToJSON(text);
        
        const clientRows = rows.filter(r => r.id && r.id.trim().toUpperCase() === globalIdURL.toUpperCase());

        if (clientRows.length === 0) {
          showErrorMessage("No Registrado", `El ID "${globalIdURL}" no se encuentra en el sistema.`);
          return;
        }

        targetPin = clientRows[0].pin ? clientRows[0].pin.trim() : "";
        
        const root = document.documentElement;
        if (clientRows[0].color) {
          root.style.setProperty('--brand-color', clientRows[0].color);
          const rgb = hexToRgb(clientRows[0].color);
          if (rgb) root.style.setProperty('--brand-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }
        if (clientRows[0].fondo) root.style.setProperty('--bg-main', clientRows[0].fondo);

        globalStructure = {}; 
        clientRows.forEach(row => {
          const prop = row.propietario || "Información General";
          const placa = row.placa || "S/P";
          if (!globalStructure[prop]) globalStructure[prop] = {};
          if (!globalStructure[prop][placa]) globalStructure[prop][placa] = [];
          
          globalStructure[prop][placa].push({
            nombre: row.nombredoc || "Documento",
            img: row.urlimagen || "",
            pdf: row.urlpdf || "#",
            sat: row.urlsat || "#",
            icon: row.icono || 'bi-file-earmark-text'
          });
        });

        const pinScreen = document.getElementById('pinScreen');
        
        if (sessionStorage.getItem(`auth_${globalIdURL}`) === 'true' || targetPin === "") {
          if (pinScreen) pinScreen.style.display = "none";
          showPortal();
        } else {
          if (pinScreen) {
            pinScreen.style.display = "flex";
            document.body.style.display = "block";
            const pinInput = document.getElementById('pinInput');
            if (pinInput) pinInput.focus();
          }
        }

      } catch (e) {
        console.error(e);
        showErrorMessage("Error de Carga", "Hubo problemas de comunicación con la base de datos.");
      }
    }

    function showErrorMessage(title, subtitle) {
      const pinScreen = document.getElementById('pinScreen');
      if (pinScreen) pinScreen.style.display = "none";
      
      document.body.innerHTML = `
        <div style="padding:150px 24px; text-align:center; background:#0b0b0c; color:#fff; min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <h2 style="color: #ff4545; font-size:1.4rem; font-weight:800; margin-bottom:8px;">${title}</h2>
          <p style="color:#71717a; font-size:0.9rem;">${subtitle}</p>
        </div>`;
      document.body.style.display = "block";
    }

    const CAPTCHA_VERIFY_URL = "https://script.google.com/macros/s/AKfycbzYLC0_gw-Wf59mkPlxo272TsVk1NxfkynmwRfyFaHSJRoOjrnCiUWdkTYQ7pQDLwm1/exec";
    const UPLOAD_DOCS_URL = "https://script.google.com/macros/s/AKfycbwCcsxBDJxWKPnKmybNXQ9K-969jWOwQ2sJmbhPHf-aoR75z4mZ-BiDk8BrXrLXs5Pu/exec";

    function clearError() {
      const errorDiv = document.getElementById('pinError');
      if (errorDiv) errorDiv.style.display = 'none';
    }

    async function verifyPin() {
      const inputEv = document.getElementById('pinInput');
      const errorDiv = document.getElementById('pinError');
      if (!inputEv) return;

      const pinIngresado = inputEv.value.trim();
      if (!pinIngresado) {
        if (errorDiv) {
          errorDiv.textContent = "Por favor ingresa tu PIN de acceso.";
          errorDiv.style.display = "block";
        }
        return;
      }

      const captchaToken = (typeof grecaptcha !== 'undefined') ? grecaptcha.getResponse() : "";
      if (!captchaToken) {
        if (errorDiv) {
          errorDiv.textContent = "Por favor marca la casilla 'No soy un robot'.";
          errorDiv.style.display = "block";
        }
        return;
      }

      const unlockBtn = document.querySelector('.btn-unlock');
      if (unlockBtn) { unlockBtn.disabled = true; unlockBtn.textContent = "Verificando..."; }

      try {
        const resp = await fetch(CAPTCHA_VERIFY_URL, {
          method: "POST",
          body: JSON.stringify({ token: captchaToken })
        });
        const data = await resp.json();

        if (!data.success) {
          if (errorDiv) {
            errorDiv.textContent = "Verificación de seguridad inválida. Recuerda actualizar tu Clave Secreta en Google Apps Script.";
            errorDiv.style.display = "block";
          }
          if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
          if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = "Ingresar"; }
          return;
        }
      } catch (err) {
        console.error(err);
        if (errorDiv) {
          errorDiv.textContent = "Error al conectar con el servidor de seguridad. Revisa tu conexión.";
          errorDiv.style.display = "block";
        }
        if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = "Ingresar"; }
        return;
      }

      if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = "Ingresar"; }

      if (pinIngresado === targetPin) {
        sessionStorage.setItem(`auth_${globalIdURL}`, 'true');
        const pinScreen = document.getElementById('pinScreen');
        if (pinScreen) {
          pinScreen.style.transition = "opacity 0.3s ease";
          pinScreen.style.opacity = "0";
          setTimeout(() => {
            pinScreen.style.display = "none";
            showPortal();
          }, 300);
        } else {
          showPortal();
        }
      } else {
        if (errorDiv) {
          errorDiv.textContent = "El PIN ingresado es incorrecto. Inténtalo de nuevo.";
          errorDiv.style.display = "block";
          inputEv.style.animation = 'shake 0.3s ease';
          setTimeout(() => { inputEv.style.animation = ''; }, 300);
        }
        inputEv.value = "";
        inputEv.focus();
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
      }
    }

    function logout() {
      sessionStorage.removeItem(`auth_${globalIdURL}`);
      window.location.reload();
    }

    function showPortal() {
      renderPortal(globalStructure, globalIdURL);
    }

    function csvToJSON(csv) {
      const lines = csv.split(/\r?\n/);
      const result = [];
      if (lines.length === 0 || !lines[0]) return result;
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const currentline = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const obj = {};
        
        headers.forEach((header, index) => {
          let value = currentline[index] ? currentline[index].trim() : "";
          obj[header] = value.replace(/^"|"$/g, ''); 
        });
        result.push(obj);
      }
      return result;
    }

    // Navegación segura sin exponer URLs en la barra inferior del navegador
    function secureRedirect(url) {
      if (url && url !== '#') {
        window.open(url, '_blank');
      }
    }

    function renderPortal(structure, id) {
      document.body.style.display = "block";
      const selector = document.getElementById('vehicleSelector');
      const content = document.getElementById('content-area');
      
      if (!selector || !content) return;

      content.innerHTML = ""; 
      selector.innerHTML = '<option value="all">MOSTRAR TODOS LOS VEHÍCULOS</option>';

      let hasData = false;

      for (const propietario in structure) {
        hasData = true;
        const propContainer = document.createElement('div');
        propContainer.className = 'owner-group';
        propContainer.innerHTML = `<div class="owner-group-title">${propietario}</div>`;
        
        for (const placa in structure[propietario]) {
          const docs = structure[propietario][placa];
          let opt = document.createElement('option');
          opt.value = placa;
          opt.textContent = `🚗 ${placa} (${propietario})`;
          selector.appendChild(opt);

          const sec = document.createElement('section');
          sec.id = `view-${placa}`;
          sec.className = 'vehicle-section';
          sec.innerHTML = `
            <div class="info-header">
              <span class="owner-label">ID: ${id}</span>
              <div class="plate-display">${placa}</div>
            </div>
            <div class="document-list">${docs.map(doc => `
              <div class="document-item">
                <div class="doc-info-block">
                  <div class="doc-icon-wrapper">
                    <i class="bi ${doc.icon}"></i>
                  </div>
                  <div class="doc-texts">
                    <span class="doc-title">${doc.nombre}</span>
                    <span class="doc-action-hint">Disponible para consulta</span>
                  </div>
                </div>
                <div class="action-group">
                    <button onclick="zoom('${doc.img}')" class="btn-circle btn-circle-view" title="Ver documento"><i class="bi bi-eye-fill"></i></button>
                    <button onclick="secureRedirect('${doc.pdf}')" class="btn-circle btn-circle-pdf" title="Descargar PDF"><i class="bi bi-file-earmark-pdf"></i></button>
                    <button onclick="secureRedirect('${doc.sat}')" class="btn-circle btn-circle-sat" title="Enlace SAT"><i class="bi bi-globe"></i></button>               
                </div>
              </div>`).join('')}
            </div>`;
          propContainer.appendChild(sec);
        }
        content.appendChild(propContainer);
      }

      if (!hasData) {
        content.innerHTML = `<div style="text-align:center; padding: 50px; color: var(--text-muted);">Sin archivos activos.</div>`;
      }
    }

    function filterVehicle() {
      const val = document.getElementById('vehicleSelector').value;
      const secs = document.querySelectorAll('.vehicle-section');
      const titles = document.querySelectorAll('.owner-group-title');
      if (val === 'all') {
        secs.forEach(s => s.style.display = 'block');
        titles.forEach(t => t.style.display = 'block');
      } else {
        secs.forEach(s => s.style.display = (s.id === `view-${val}`) ? 'block' : 'none');
        titles.forEach(t => {
          const parent = t.parentElement;
          const hasVisible = Array.from(parent.querySelectorAll('.vehicle-section')).some(s => s.style.display === 'block');
          t.style.display = hasVisible ? 'block' : 'none';
        });
      }
    }

    function zoom(src) {
      currentRotation = 0;
      const img = document.getElementById('v-modal-img');
      if (!img) return;
      img.src = src; 
      img.style.transform = `rotate(0deg)`;
      const modal = document.getElementById('v-modal');
      if (modal) modal.style.display = 'flex';
    }

    function rotateImg(e) { 
      e.stopPropagation(); 
      currentRotation += 90; 
      const img = document.getElementById('v-modal-img');
      if (img) img.style.transform = `rotate(${currentRotation}deg)`; 
    }
    
    function closeModal() { 
      const modal = document.getElementById('v-modal');
      if (modal) modal.style.display = 'none'; 
    }

    // ==========================================
    // CAPA DE SEGURIDAD INTEGRAL Y MENÚS
    // ==========================================

    // Bloqueo dinámico del menú contextual (Clic derecho selectivo)
    window.addEventListener('contextmenu', function (e) {
      // Si el clic derecho proviene de la imagen de previsualización (Modal), se permite.
      if (e.target && e.target.id === 'v-modal-img') {
        return true; 
      }
      // En cualquier otra parte de la aplicación, se bloquea por completo.
      e.preventDefault();
      return false;
    }, false);

    // Bloqueo de atajos de teclado e inspección de código
    window.addEventListener('keydown', function (e) {
      // Bloquear F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }
      // Bloquear Ctrl+Shift+I (Inspeccionar)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.keyCode === 73)) {
        e.preventDefault();
        return false;
      }
      // Bloquear Ctrl+Shift+J (Consola)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.keyCode === 74)) {
        e.preventDefault();
        return false;
      }
      // Bloquear Ctrl+U (Ver código fuente)
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
        e.preventDefault();
        return false;
      }
      // Bloquear Ctrl+S (Guardar página localmente)
      if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
        e.preventDefault();
        return false;
      }
    }, false);

    // ==========================================
    // PANEL DE SUBIDA DE DOCUMENTOS DEL CLIENTE
    // ==========================================

    function toggleUploadPanel() {
      const panel = document.getElementById('uploadPanel');
      if (!panel) return;
      const isOpen = panel.style.display === 'flex';
      if (isOpen) {
        panel.style.display = 'none';
      } else {
        populateUploadPlacaSelect();
        panel.style.display = 'flex';
      }
    }

    function populateUploadPlacaSelect() {
      const sel = document.getElementById('uploadPlacaSelect');
      if (!sel) return;
      sel.innerHTML = '<option value="">Selecciona tu vehículo</option>';

      for (const propietario in globalStructure) {
        for (const placa in globalStructure[propietario]) {
          const opt = document.createElement('option');
          opt.value = placa;
          opt.textContent = `🚗 ${placa}`;
          sel.appendChild(opt);
        }
      }
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // El resultado viene como "data:tipo/mime;base64,XXXXX" — solo nos interesa la parte después de la coma
          const result = reader.result;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function submitUpload() {
      const placaSelect = document.getElementById('uploadPlacaSelect');
      const tipoDocSelect = document.getElementById('uploadTipoDoc');
      const fileInput = document.getElementById('uploadFileInput');
      const statusDiv = document.getElementById('uploadStatus');
      const submitBtn = document.querySelector('.btn-upload-submit');

      const placa = placaSelect ? placaSelect.value : "";
      const tipoDoc = tipoDocSelect ? tipoDocSelect.value : "";
      const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

      statusDiv.className = 'upload-status';

      if (!placa) {
        statusDiv.textContent = "Por favor selecciona tu vehículo.";
        statusDiv.className = 'upload-status err';
        return;
      }
      if (!file) {
        statusDiv.textContent = "Por favor selecciona un archivo (foto o PDF).";
        statusDiv.className = 'upload-status err';
        return;
      }

      // Límite razonable de tamaño (10MB) para evitar fallos de envío
      const maxSizeBytes = 10 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        statusDiv.textContent = "El archivo es muy grande. El límite es 10MB.";
        statusDiv.className = 'upload-status err';
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; }
      statusDiv.textContent = "Subiendo documento, espera un momento...";
      statusDiv.className = 'upload-status loading';

      try {
        const base64Data = await fileToBase64(file);

        const payload = {
          clienteId: globalIdURL,
          tipoDoc: tipoDoc,
          placa: placa,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64Data: base64Data
        };

        const resp = await fetch(UPLOAD_DOCS_URL, {
          method: "POST",
          body: JSON.stringify(payload)
        });
        const data = await resp.json();

        if (data.success) {
          statusDiv.textContent = "¡Documento enviado! Lo revisaremos pronto.";
          statusDiv.className = 'upload-status ok';
          if (fileInput) fileInput.value = "";
          setTimeout(() => { toggleUploadPanel(); }, 2000);
        } else {
          statusDiv.textContent = "Hubo un problema al subir el documento. Intenta de nuevo.";
          statusDiv.className = 'upload-status err';
        }
      } catch (err) {
        console.error(err);
        statusDiv.textContent = "Error de conexión. Revisa tu internet e intenta de nuevo.";
        statusDiv.className = 'upload-status err';
      }

      if (submitBtn) { submitBtn.disabled = false; }
    }

    init();