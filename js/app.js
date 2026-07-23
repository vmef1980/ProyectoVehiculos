// CONFIGURACIÓN CENTRALIZADA CON VARIABLE DE VERSIÓN INCLUIDA
    const CONFIG = {
      title: "Documentos Vehiculares",
      brand: "TECH® | RdeG | 2026",
      version: "v5.0.0",
      logo: "img/Tech-logo.svg",
      phone: "50241084481",
      waMsg: "Hola TECH®, solicito soporte para el ID: ",
      waCommercialMsg: "Hola TECH®, deseo información de sus productos. Vengo de la aplicación de Gestión Documental Vehicular."
      // NOTA: el antiguo "csvUrl" (CSV publicado del Google Sheet) se eliminó
      // a propósito. Ese CSV exponía en el navegador el PIN y los documentos
      // de TODOS los clientes, no solo del que abría el portal. Ahora esos
      // datos solo salen del servidor (Apps Script) después de un login
      // válido. Recuerda ir a tu Google Sheet > Archivo > Compartir >
      // "Publicar en la web" y DESPUBLICAR ese CSV, ya no se usa y sigue
      // siendo un riesgo mientras siga publicado.
    };

    // ==========================================
    // NOVEDADES DEL SISTEMA
    // Agrega aquí cada actualización nueva (la más reciente primero).
    // El badge rojo en la campana se muestra si hay novedades más
    // nuevas que la última que el cliente ya vio (guardado en su navegador).
    // ==========================================
    const SYSTEM_NEWS = [
      {
        date: "2026-07-22",
        icon: "bi-shield-lock-fill",
        title: "Contraseña más segura",
        desc: "Ahora puedes usar una contraseña de hasta 16 caracteres, combinando letras, números y símbolos, en lugar del PIN numérico corto."
      },
      {
        date: "2026-07-22",
        icon: "bi-key-fill",
        title: "Cambia tu contraseña tú mismo",
        desc: "Agregamos un apartado para que actualices tu propia contraseña de acceso al portal, sin depender de soporte."
      },
      {
        date: "2026-07-22",
        icon: "bi-bell-fill",
        title: "Nuevo apartado de Novedades",
        desc: "Este panel donde estás leyendo ahora: aquí publicaremos cada mejora que hagamos al portal."
      }
    ];

    let currentRotation = 0;
    let globalStructure = {};
    let globalIdURL = "";

    // Catálogo de tipos de placa de Guatemala, según el prefijo de letras.
    const PLATE_TYPES = {
      P:   { label: "Particular",  desc: "Vehículo privado de uso personal" },
      A:   { label: "Alquiler",    desc: "Vehículo de alquiler (taxi, transporte por tarifa)" },
      C:   { label: "Comercial",   desc: "Transporte extraurbano de personas, carga y escolar; vehículo de empresa" },
      U:   { label: "Urbano",      desc: "Transporte público urbano colectivo (bus urbano)" },
      M:   { label: "Motocicleta", desc: "Motocicleta o ciclomotor (placa reducida)" },
      MT:  { label: "Mototaxi",    desc: "Vehículo de tres ruedas para transporte público" },
      TC:  { label: "Remolque",    desc: "Remolque o semirremolque (vehículo de arrastre)" },
      TCR: { label: "Tractor",     desc: "Tractor agrícola, industrial o de construcción" },
      TE:  { label: "Extraurbano", desc: "Transporte extraurbano de pasajeros o carga" },
      O:   { label: "Oficial",     desc: "Vehículo del Estado" },
      CD:  { label: "Diplomático", desc: "Misión diplomática o funcionario" },
      CC:  { label: "Consular",    desc: "Misión consular" },
      MI:  { label: "Misión Int.", desc: "Organismo internacional u ONG extranjera" },
      DIS: { label: "Distribuidor",desc: "Placa de distribuidor" }
    };

    // Extrae el prefijo de letras de la placa (ej. "P123ABC" -> "P",
    // "MT1234" -> "MT") y lo busca en el catálogo de tipos.
    function getPlateTypeInfo(placa) {
      if (!placa) return null;
      const match = placa.trim().toUpperCase().match(/^[A-Z]+/);
      if (!match) return null;
      return PLATE_TYPES[match[0]] || null;
    }

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
        showLoadingScreen();

        document.getElementById('portal-title').textContent = CONFIG.title;
        document.getElementById('footer-brand').textContent = CONFIG.brand;
        document.getElementById('footer-version-label').textContent = `PORTAL OFICIAL | ${CONFIG.version}`;

        const params = new URLSearchParams(window.location.search);
        globalIdURL = params.get('id');

        const supportUrl = `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(CONFIG.waMsg + (globalIdURL || "Desconocido"))}`;
        const commercialUrl = `https://wa.me/${CONFIG.phone}?text=${encodeURIComponent(CONFIG.waCommercialMsg)}`;
        if (document.getElementById('pin-wa-link')) document.getElementById('pin-wa-link').href = supportUrl;
        if (document.getElementById('wa-link')) document.getElementById('wa-link').href = supportUrl;
        if (document.getElementById('commercial-wa-link')) document.getElementById('commercial-wa-link').href = commercialUrl;

        if (!globalIdURL) {
          showErrorMessage("ID Requerido", "Por favor, utiliza un enlace con un ID de cliente válido.");
          return;
        }

        const storedToken = sessionStorage.getItem(sessionTokenKey(globalIdURL));

        // El logo (estático, igual para todos) y el theming/sesión de ESTE
        // cliente se piden en paralelo. A diferencia de la versión anterior,
        // aquí NUNCA se descarga la información de otros clientes: cada
        // llamada al backend solo puede devolver los datos del "id" que
        // se envía, y el backend valida quién tiene derecho a verlos.
        const [, brandingResult, sessionResult] = await Promise.all([
          loadInlineLogo(),
          fetchBranding(globalIdURL),
          storedToken ? resumeSession(globalIdURL, storedToken) : Promise.resolve(null)
        ]);

        if (brandingResult && brandingResult.success) {
          applyBrandTheme(brandingResult.color, brandingResult.fondo);
        }

        hideLoadingScreen();
        const pinScreen = document.getElementById('pinScreen');

        if (sessionResult && sessionResult.success) {
          globalStructure = buildStructureFromRows(sessionResult.rows || []);
          if (sessionResult.color) applyBrandTheme(sessionResult.color, sessionResult.fondo);
          if (pinScreen) pinScreen.style.display = "none";
          showPortal();
        } else {
          if (storedToken) sessionStorage.removeItem(sessionTokenKey(globalIdURL));
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

    // Trae SOLO el color de marca del cliente (nada sensible), para que la
    // pantalla de login ya se vea con su identidad antes de autenticarse.
    async function fetchBranding(id) {
      try {
        const resp = await fetch(SECURE_BACKEND_URL, {
          method: "POST",
          body: JSON.stringify({ action: "branding", clienteId: id })
        });
        return await resp.json();
      } catch (e) {
        console.error("No se pudo cargar el theming del cliente", e);
        return null;
      }
    }

    // Intenta reanudar sesión con el token guardado en este navegador, sin
    // volver a pedir la contraseña. El backend valida el token (firma +
    // expiración) y solo entonces devuelve los documentos de este cliente.
    async function resumeSession(id, token) {
      try {
        const resp = await fetch(SECURE_BACKEND_URL, {
          method: "POST",
          body: JSON.stringify({ action: "session", clienteId: id, sessionToken: token })
        });
        return await resp.json();
      } catch (e) {
        console.error("No se pudo renovar la sesión", e);
        return null;
      }
    }

    function applyBrandTheme(color, fondo) {
      const root = document.documentElement;
      if (color) {
        root.style.setProperty('--brand-color', color);
        const rgb = hexToRgb(color);
        if (rgb) root.style.setProperty('--brand-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
      if (fondo) root.style.setProperty('--bg-main', fondo);
    }

    // Reconstruye la estructura propietario > placa > documentos a partir
    // de las filas que devuelve el backend (mismo formato que antes usaba
    // el CSV, pero ahora ya vienen filtradas y sin la columna "pin").
    function buildStructureFromRows(rows) {
      const structure = {};
      rows.forEach(row => {
        const prop = row.propietario || "Información General";
        const placa = row.placa || "S/P";
        if (!structure[prop]) structure[prop] = {};
        if (!structure[prop][placa]) structure[prop][placa] = [];
        structure[prop][placa].push({
          nombre: row.nombredoc || "Documento",
          img: row.urlimagen || "",
          pdf: row.urlpdf || "#",
          sat: row.urlsat || "#",
          icon: row.icono || 'bi-file-earmark-text'
        });
      });
      return structure;
    }

    function showLoadingScreen() {
      document.body.style.display = "block";
      const loader = document.getElementById('appLoader');
      if (loader) loader.style.display = "flex";
    }

    function hideLoadingScreen() {
      const loader = document.getElementById('appLoader');
      if (loader) loader.style.display = "none";
    }

    function showErrorMessage(title, subtitle) {
      hideLoadingScreen();
      const pinScreen = document.getElementById('pinScreen');
      if (pinScreen) pinScreen.style.display = "none";
      
      document.body.innerHTML = `
        <div style="padding:150px 24px; text-align:center; background:#0b0b0c; color:#fff; min-height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <h2 style="color: #ff4545; font-size:1.4rem; font-weight:800; margin-bottom:8px;">${title}</h2>
          <p style="color:#71717a; font-size:0.9rem;">${subtitle}</p>
        </div>`;
      document.body.style.display = "block";
    }

    const UPLOAD_DOCS_URL = "https://script.google.com/macros/s/AKfycbwCcsxBDJxWKPnKmybNXQ9K-969jWOwQ2sJmbhPHf-aoR75z4mZ-BiDk8BrXrLXs5Pu/exec";

    // ÚNICO endpoint nuevo: reemplaza a CAPTCHA_VERIFY_URL y al anterior
    // CHANGE_PASSWORD_URL. Maneja login, renovación de sesión, branding
    // pública (solo color) y cambio de contraseña. Ver "secure_backend.gs".
    // TODO: reemplaza esta URL por la de tu propio despliegue.
    const SECURE_BACKEND_URL = "https://script.google.com/macros/s/AKfycby4C9HGN1py7kirEuR4sCPaqP5x2Afjdj4UmZDUqMJSxEVqxJnIVwImazY4kIzVK3gU/exec";

    // Clave de sessionStorage donde se guarda el token de sesión (no la
    // contraseña) del cliente actual, para no pedir login en cada recarga.
    function sessionTokenKey(id) { return `sessionToken_${id}`; }

    function clearError() {
      const errorDiv = document.getElementById('pinError');
      if (errorDiv) errorDiv.style.display = 'none';
    }

    function togglePinVisibility() {
      const input = document.getElementById('pinInput');
      const icon = document.getElementById('pinVisibilityIcon');
      if (!input || !icon) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      icon.className = isHidden ? 'bi bi-eye-slash' : 'bi bi-eye';
    }

    async function verifyPin() {
      const inputEv = document.getElementById('pinInput');
      const errorDiv = document.getElementById('pinError');
      if (!inputEv) return;

      const passwordIngresada = inputEv.value.trim();
      if (!passwordIngresada) {
        if (errorDiv) {
          errorDiv.textContent = "Por favor ingresa tu contraseña de acceso.";
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
        // Un solo llamado al servidor: valida el captcha Y la contraseña,
        // y solo si ambos son correctos devuelve los documentos de ESTE
        // cliente (nunca los de los demás).
        const resp = await fetch(SECURE_BACKEND_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "login",
            clienteId: globalIdURL,
            password: passwordIngresada,
            captchaToken: captchaToken
          })
        });
        const data = await resp.json();

        if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = "Ingresar"; }

        if (data.success) {
          if (data.sessionToken) {
            sessionStorage.setItem(sessionTokenKey(globalIdURL), data.sessionToken);
          }
          globalStructure = buildStructureFromRows(data.rows || []);
          if (data.color) applyBrandTheme(data.color, data.fondo);

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
            errorDiv.textContent = data.message || "La contraseña ingresada es incorrecta. Inténtalo de nuevo.";
            errorDiv.style.display = "block";
            inputEv.style.animation = 'shake 0.3s ease';
            setTimeout(() => { inputEv.style.animation = ''; }, 300);
          }
          inputEv.value = "";
          inputEv.focus();
          if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
        }
      } catch (err) {
        console.error(err);
        if (errorDiv) {
          errorDiv.textContent = "Error al conectar con el servidor. Revisa tu conexión.";
          errorDiv.style.display = "block";
        }
        if (unlockBtn) { unlockBtn.disabled = false; unlockBtn.textContent = "Ingresar"; }
        if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
      }
    }

    function logout() {
      sessionStorage.removeItem(sessionTokenKey(globalIdURL));
      window.location.reload();
    }

    function showPortal() {
      renderPortal(globalStructure, globalIdURL);
    }

    // NOTA: ya no se usa en el flujo principal (el CSV público se eliminó,
    // ver comentario en CONFIG). Se deja por si en otro lado del proyecto
    // se sigue necesitando convertir un CSV a JSON.
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
          const typeInfo = getPlateTypeInfo(placa);
          const typeBadgeHtml = typeInfo
            ? `<span class="plate-type-badge" title="${typeInfo.desc}">${typeInfo.label}</span>`
            : '';
          sec.innerHTML = `
            <div class="info-header">
              <span class="owner-label">ID: ${id}</span>
              <div class="plate-group">
                ${typeBadgeHtml}
                <div class="plate-display">${placa}</div>
              </div>
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

    // ==========================================
    // PANEL DE NOVEDADES DEL SISTEMA
    // ==========================================

    function renderNews() {
      const list = document.getElementById('newsList');
      if (!list) return;

      if (!SYSTEM_NEWS || SYSTEM_NEWS.length === 0) {
        list.innerHTML = `<div class="news-empty">Aún no hay novedades publicadas.</div>`;
        return;
      }

      const sorted = [...SYSTEM_NEWS].sort((a, b) => new Date(b.date) - new Date(a.date));
      list.innerHTML = sorted.map(item => `
        <div class="news-item">
          <div class="news-item-header">
            <span class="news-title"><i class="bi ${item.icon || 'bi-stars'}"></i> ${item.title}</span>
            <span class="news-date">${formatNewsDate(item.date)}</span>
          </div>
          <div class="news-desc">${item.desc}</div>
        </div>`).join('');
    }

    function formatNewsDate(isoDate) {
      try {
        const d = new Date(isoDate + 'T00:00:00');
        return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) {
        return isoDate;
      }
    }

    function toggleNewsPanel() {
      const panel = document.getElementById('newsPanel');
      if (!panel) return;
      const isOpen = panel.style.display === 'flex';
      if (isOpen) {
        panel.style.display = 'none';
      } else {
        renderNews();
        panel.style.display = 'flex';
        markNewsAsSeen();
      }
    }

    function getLatestNewsDate() {
      if (!SYSTEM_NEWS || SYSTEM_NEWS.length === 0) return null;
      return SYSTEM_NEWS.reduce((latest, item) => (item.date > latest ? item.date : latest), SYSTEM_NEWS[0].date);
    }

    function checkUnseenNews() {
      const badge = document.getElementById('newsBadge');
      if (!badge) return;
      const latest = getLatestNewsDate();
      if (!latest) { badge.style.display = 'none'; return; }
      const lastSeen = localStorage.getItem('lastSeenNewsDate');
      badge.style.display = (!lastSeen || lastSeen < latest) ? 'block' : 'none';
    }

    function markNewsAsSeen() {
      const latest = getLatestNewsDate();
      if (latest) localStorage.setItem('lastSeenNewsDate', latest);
      const badge = document.getElementById('newsBadge');
      if (badge) badge.style.display = 'none';
    }

    // ==========================================
    // PANEL DE CAMBIO DE CONTRASEÑA
    // ==========================================

    function toggleChangePasswordPanel() {
      const panel = document.getElementById('changePasswordPanel');
      if (!panel) return;
      const isOpen = panel.style.display === 'flex';
      if (isOpen) {
        panel.style.display = 'none';
      } else {
        ['currentPasswordInput', 'newPasswordInput', 'confirmPasswordInput'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        const statusDiv = document.getElementById('changePasswordStatus');
        if (statusDiv) { statusDiv.textContent = ''; statusDiv.className = 'upload-status'; }
        panel.style.display = 'flex';
      }
    }

    async function submitPasswordChange() {
      const currentInput = document.getElementById('currentPasswordInput');
      const newInput = document.getElementById('newPasswordInput');
      const confirmInput = document.getElementById('confirmPasswordInput');
      const statusDiv = document.getElementById('changePasswordStatus');
      const submitBtn = document.querySelector('#changePasswordPanel .btn-upload-submit');

      const currentPassword = currentInput ? currentInput.value : '';
      const newPassword = newInput ? newInput.value : '';
      const confirmPassword = confirmInput ? confirmInput.value : '';

      statusDiv.className = 'upload-status';

      if (!currentPassword) {
        statusDiv.textContent = "Ingresa tu contraseña actual.";
        statusDiv.className = 'upload-status err';
        return;
      }
      // La contraseña actual ya NO se valida aquí en el navegador: el
      // cliente nunca tiene una copia local de ella (por eso el token de
      // sesión, no la contraseña, es lo que se guarda). La valida el
      // servidor y responde con el mensaje de error si no coincide.
      if (newPassword.length < 4 || newPassword.length > 16) {
        statusDiv.textContent = "La nueva contraseña debe tener entre 4 y 16 caracteres.";
        statusDiv.className = 'upload-status err';
        return;
      }
      if (newPassword !== confirmPassword) {
        statusDiv.textContent = "Las contraseñas nuevas no coinciden.";
        statusDiv.className = 'upload-status err';
        return;
      }
      if (newPassword === currentPassword) {
        statusDiv.textContent = "La nueva contraseña debe ser distinta a la actual.";
        statusDiv.className = 'upload-status err';
        return;
      }

      if (submitBtn) { submitBtn.disabled = true; }
      statusDiv.textContent = "Actualizando tu contraseña...";
      statusDiv.className = 'upload-status loading';

      try {
        const resp = await fetch(SECURE_BACKEND_URL, {
          method: "POST",
          body: JSON.stringify({
            action: "changePassword",
            clienteId: globalIdURL,
            currentPassword: currentPassword,
            newPassword: newPassword
          })
        });
        const data = await resp.json();

        if (data.success) {
          statusDiv.textContent = "¡Contraseña actualizada! Vuelve a ingresar la próxima vez con tu nueva contraseña.";
          statusDiv.className = 'upload-status ok';
          setTimeout(() => { toggleChangePasswordPanel(); }, 2500);
        } else {
          statusDiv.textContent = data.message || "No se pudo actualizar la contraseña. Intenta de nuevo.";
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
    checkUnseenNews();