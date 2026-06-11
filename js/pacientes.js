// Pacientes JS
let currentPatientId = null;
let currentPlanId = null;

const CATALOGO_RECOMENDACIONES = [
    { id: 'rec1', nombre: 'Estiramientos', icono: 'fa-child-reaching' },
    { id: 'rec2', nombre: 'Fuerza', icono: 'fa-dumbbell' },
    { id: 'rec3', nombre: 'Aplicar Frío', icono: 'fa-snowflake' },
    { id: 'rec4', nombre: 'Aplicar Calor', icono: 'fa-fire' },
    { id: 'rec5', nombre: 'Caminar 15m', icono: 'fa-person-walking' },
    { id: 'rec6', nombre: 'Higiene Postural', icono: 'fa-chair' }
];

let selectedRecs = [];
let allRecs = [...CATALOGO_RECOMENDACIONES];

const ICONOS_CUSTOM = [
    'fa-star', 'fa-heart-pulse', 'fa-suitcase-medical', 'fa-pills', 'fa-bandage', 'fa-bone',
    'fa-person-running', 'fa-person-walking', 'fa-spa', 'fa-bicycle', 'fa-dumbbell', 'fa-baseball',
    'fa-child-reaching', 'fa-person', 'fa-chair', 'fa-fire', 'fa-snowflake', 'fa-droplet', 'fa-stopwatch'
];
let selectedCustomIcon = 'fa-star';

document.addEventListener('DOMContentLoaded', () => {
    // ... logic (leave intact)
    // Alta de Paciente
    const form = document.getElementById('newPatientForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('np-name').value.trim();
        const email = document.getElementById('np-email').value.trim();
        const phone = document.getElementById('np-phone').value.trim();

        // AÑADIDO: Capturamos la fecha de nacimiento si el elemento existe
        const dobInput = document.getElementById('np-dob');
        const dob = dobInput ? dobInput.value.trim() : null;

        const btn = form.querySelector('button');

        if (!nombre) return;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            const emailFinal = email || `fantasma.${Math.random().toString(36).substring(2, 8)}@fysium.app`;

            const { error: errorUser } = await supabaseClient
                .from('auth_user')
                .insert([{
                    id_supabase: uuid,
                    username: nombre,
                    telefono: phone || null,
                    email: emailFinal,
                    fecha_nacimiento: dob || null, // Guardamos la fecha
                    es_fantasma: true
                }]);

            if (errorUser && errorUser.code !== '23505') throw errorUser;

            const { error: errorMis } = await supabaseClient
                .from('mis_pacientes')
                .insert([{ fisio_id: currentUser.id, cliente_id: uuid }]);

            if (errorMis && errorMis.code !== '23505') throw errorMis;

            alert('Paciente dado de alta y añadido a tu lista exitosamente.');
            form.reset();

            if (window.cargarPacientes) window.cargarPacientes();

            // Navega automáticamente a la pestaña de pacientes
            const tabPacientes = document.querySelector('[data-tab="pacientes"]');
            if (tabPacientes) tabPacientes.click();

        } catch (error) {
            console.error(error);
            alert("Error al guardar paciente: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Guardar Paciente";
        }
    });

    // Búsqueda
    document.getElementById('searchPatientInput').addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.patient-card');
        cards.forEach(card => {
            const name = card.querySelector('.patient-name').textContent.toLowerCase();
            if (name.includes(val)) card.style.display = 'flex';
            else card.style.display = 'none';
        });
    });

    // Volver a pacientes
    document.getElementById('backToPatientsBtn').addEventListener('click', () => {
        document.getElementById('tab-detalle-paciente').classList.remove('active');
        document.getElementById('tab-pacientes').classList.add('active');
    });

    // Control de Duración
    document.querySelectorAll('.dur-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.btn-group');
            document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Creador de Recomendaciones (Modal)
    document.getElementById('closeRecModalBtn').addEventListener('click', () => {
        document.getElementById('newRecModal').style.display = 'none';
    });

    document.getElementById('addCustomRecBtn').addEventListener('click', () => {
        const nombreStr = document.getElementById('customRecName').value.trim();
        if (!nombreStr) return alert("Ponle un nombre a tu recomendación.");

        const idUnico = `custom_${Date.now()}`;
        const itemCreado = { id: idUnico, nombre: nombreStr, icono: selectedCustomIcon, isCustom: true };

        allRecs.push(itemCreado);
        selectedRecs.push(idUnico);

        document.getElementById('newRecModal').style.display = 'none';
        document.getElementById('customRecName').value = '';
        selectedCustomIcon = 'fa-star';

        renderRecommendationsGrid();
    });

    // Guardar Ficha Completa
    document.getElementById('saveTratamientoBtn').addEventListener('click', async () => {
        if (!currentPatientId) return;
        const btn = document.getElementById('saveTratamientoBtn');
        btn.disabled = true;
        btn.textContent = "Guardando...";

        const textoPrivado = document.getElementById('dpTratamiento').value;
        const notas = document.getElementById('dpNotas').value;

        // Obtener duración
        const activeDurBtn = document.querySelector('.dur-btn.active');
        const durVal = activeDurBtn ? activeDurBtn.dataset.val : 1;
        const durType = activeDurBtn ? activeDurBtn.closest('.btn-group').dataset.type : 'semanas';
        const duracionTexto = `${durVal} ${durType}`;

        // Obtener fecha fin
        const fechaFin = new Date();
        if (durType === 'días') fechaFin.setDate(fechaFin.getDate() + parseInt(durVal));
        else if (durType === 'semanas') fechaFin.setDate(fechaFin.getDate() + (parseInt(durVal) * 7));
        else if (durType === 'meses') fechaFin.setMonth(fechaFin.getMonth() + parseInt(durVal));

        // Obtener array de ejercicios
        const arrayCompleto = selectedRecs.map(idItem => allRecs.find(e => e.id === idItem)).filter(Boolean);
        const ejerciciosStr = JSON.stringify(arrayCompleto);

        const dataPayload = {
            ejercicios: ejerciciosStr,
            tratamiento_privado: textoPrivado,
            reposo: notas,
            fecha_fin: fechaFin.toISOString(),
            duracion_texto: duracionTexto,
            updated_at: new Date().toISOString()
        };

        try {
            if (currentPlanId) {
                const { error } = await supabaseClient.from('planes_recuperacion').update(dataPayload).eq('id', currentPlanId);
                if (error) throw error;
            } else {
                const { data, error } = await supabaseClient.from('planes_recuperacion').insert([{
                    fisio_id: currentUser.id,
                    cliente_id: currentPatientId,
                    ...dataPayload
                }]).select('id').single();
                if (error) throw error;
                currentPlanId = data.id;
            }

            // Insertar en historial
            await supabaseClient.from('historial_seguimiento').insert([{
                fisio_id: currentUser.id,
                cliente_id: currentPatientId,
                ejercicios: ejerciciosStr,
                tratamiento_privado: textoPrivado,
                reposo: notas,
                duracion_texto: duracionTexto
            }]);

            try {
                // 1. Buscamos el token y si el paciente permite alertas de seguimiento
                const { data: userPref } = await supabaseClient
                    .from('auth_user')
                    .select('push_token, alertas_seguimiento')
                    .eq('id_supabase', currentPatientId)
                    .single();

                // 2. Si tiene token y el interruptor está activo (o es null/por defecto), disparamos
                if (userPref && userPref.push_token && (userPref.alertas_seguimiento === true || userPref.alertas_seguimiento === null)) {
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            to: userPref.push_token,
                            sound: 'default',
                            title: '💪 Plan de Seguimiento Actualizado',
                            body: `Tu fisioterapeuta, ${currentUser.user_metadata?.username || 'tu fisio'}, ha actualizado tus recomendaciones.`
                        })
                    });
                }
            } catch (errNotif) {
                console.error("Error silencioso al notificar al paciente:", errNotif);
            }

            alert("Ficha guardada correctamente y añadida al historial.");
            window.cargarFichaPaciente({ id_supabase: currentPatientId, ...window.currentPatientObj }); // Recargar historial
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = "Guardar Ficha";
        }
    });
});

function renderCustomIcons() {
    const grid = document.getElementById('customRecIconsGrid');
    grid.innerHTML = '';
    ICONOS_CUSTOM.forEach(ico => {
        const btn = document.createElement('div');
        btn.className = `icon-selector ${selectedCustomIcon === ico ? 'active' : ''}`;
        btn.innerHTML = `<i class="fa-solid ${ico}"></i>`;
        btn.onclick = () => {
            selectedCustomIcon = ico;
            renderCustomIcons();
        };
        grid.appendChild(btn);
    });
}

function renderRecommendationsGrid() {
    const grid = document.getElementById('dpRecomendaciones');
    grid.innerHTML = '';

    allRecs.forEach(item => {
        const div = document.createElement('div');
        div.className = `rec-card ${selectedRecs.includes(item.id) ? 'active' : ''}`;
        div.innerHTML = `<i class="fa-solid ${item.icono}"></i> <span>${item.nombre}</span>`;
        div.onclick = () => {
            if (selectedRecs.includes(item.id)) selectedRecs = selectedRecs.filter(i => i !== item.id);
            else selectedRecs.push(item.id);
            renderRecommendationsGrid();
        };
        grid.appendChild(div);
    });

    const newCard = document.createElement('div');
    newCard.className = 'rec-card';
    newCard.style.cssText = "background-color: #F0F5F5; border-style: dashed; border-width: 2px; border-color: var(--primary);";
    newCard.innerHTML = `<i class="fa-solid fa-plus" style="color:var(--primary)"></i> <span style="color:var(--primary)">Nuevo</span>`;
    newCard.onclick = () => {
        document.getElementById('newRecModal').style.display = 'flex';
        renderCustomIcons();
    };
    grid.appendChild(newCard);
}

window.cargarPacientes = async function () {
    if (!currentUser) return;
    const list = document.getElementById('patientsList');
    list.innerHTML = '<div class="loading-spinner py-4 text-center"><i class="fa fa-spinner fa-spin"></i> Cargando...</div>';

    try {
        const { data: misPacientes, error: errorMis } = await supabaseClient
            .from('mis_pacientes')
            .select('cliente_id')
            .eq('fisio_id', currentUser.id);

        if (errorMis) throw errorMis;

        if (!misPacientes || misPacientes.length === 0) {
            list.innerHTML = '<p class="text-center text-light py-4">Aún no tienes pacientes guardados.</p>';
            return;
        }

        const ids = misPacientes.map(mp => mp.cliente_id);

        const { data: usuarios, error: errorUsr } = await supabaseClient
            .from('auth_user')
            .select('*')
            .in('id_supabase', ids)
            .order('username', { ascending: true });

        if (errorUsr) throw errorUsr;

        list.innerHTML = '';
        usuarios.forEach(u => {
            const card = document.createElement('div');
            card.className = 'patient-card';
            card.style.cursor = 'pointer';

            let avatarHtml = `<div class="avatar">${u.username.charAt(0).toUpperCase()}</div>`;
            if (u.foto_perfil_url) {
                avatarHtml = `<img src="${u.foto_perfil_url}" alt="${u.username}" class="avatar" style="object-fit:cover">`;
            }

            card.innerHTML = `
                ${avatarHtml}
                <div class="patient-info">
                    <div class="patient-name">${u.username || 'Paciente'}</div>
                    <div class="patient-email">${u.email || 'Sin correo'}</div>
                </div>
                <div style="color:var(--text-light)"><i class="fa-solid fa-chevron-right"></i></div>
            `;
            card.onclick = () => window.cargarFichaPaciente(u);
            list.appendChild(card);
        });

    } catch (error) {
        console.error(error);
        list.innerHTML = '<div class="text-danger text-center py-4">Error al cargar pacientes.</div>';
    }
};

window.cargarFichaPaciente = async function (userObj) {
    window.currentPatientObj = userObj;
    currentPatientId = userObj.id_supabase;
    currentPlanId = null;
    selectedRecs = [];
    allRecs = [...CATALOGO_RECOMENDACIONES];

    // Cambiar vista
    document.getElementById('tab-pacientes').classList.remove('active');
    document.getElementById('tab-detalle-paciente').classList.add('active');

    // Poblar info
    document.getElementById('dpName').textContent = userObj.username;
    document.getElementById('dpAvatar').textContent = userObj.username.charAt(0).toUpperCase();
    if (userObj.foto_perfil_url) document.getElementById('dpAvatar').innerHTML = `<img src="${userObj.foto_perfil_url}" style="width:100%; height:100%; border-radius:50%; object-fit:cover">`;
    document.getElementById('dpPhone').textContent = userObj.telefono || 'Sin teléfono';
    document.getElementById('dpEmail').textContent = userObj.email || 'Sin correo';
    document.getElementById('dpDob').textContent = userObj.fecha_nacimiento || 'Sin fecha de nac.';

    // Reset Form
    document.getElementById('dpTratamiento').value = 'Cargando...';
    document.getElementById('dpNotas').value = '';
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.btn-group[data-type="semanas"] .dur-btn[data-val="1"]').classList.add('active');

    // Cargar Plan
    const { data: planData } = await supabaseClient
        .from('planes_recuperacion')
        .select('*')
        .eq('fisio_id', currentUser.id)
        .eq('cliente_id', currentPatientId)
        .single();

    if (planData) {
        currentPlanId = planData.id;
        document.getElementById('dpTratamiento').value = planData.tratamiento_privado || '';
        document.getElementById('dpNotas').value = planData.reposo || '';

        try {
            if (planData.ejercicios) {
                const parsed = JSON.parse(planData.ejercicios);
                const recIds = [];
                parsed.forEach(i => {
                    const idObj = typeof i === 'string' ? i : i.id;
                    recIds.push(idObj);
                    if (typeof i === 'object' && i.isCustom && !allRecs.find(e => e.id === i.id)) {
                        allRecs.push({ id: i.id, nombre: i.nombre, icono: i.icono.replace('md-', 'fa-') });
                    }
                });
                selectedRecs = [...new Set(recIds)];
            }
        } catch (e) { }

        if (planData.duracion_texto) {
            const [val, type] = planData.duracion_texto.split(' ');
            document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.btn-group[data-type="${type}"] .dur-btn[data-val="${val}"]`);
            if (btn) btn.classList.add('active');
        }
    } else {
        document.getElementById('dpTratamiento').value = '';
    }

    renderRecommendationsGrid();

    // Cargar Historial
    const { data: histData } = await supabaseClient
        .from('historial_seguimiento')
        .select('*')
        .eq('cliente_id', currentPatientId)
        .order('fecha', { ascending: false });

    const hList = document.getElementById('dpHistorialList');
    if (!histData || histData.length === 0) {
        hList.innerHTML = `<p class="text-light text-center" style="font-size:0.9rem; margin-top:2rem;"><i class="fa-solid fa-folder-open mb-2" style="font-size:2rem; opacity:0.5"></i><br>No hay historial todavía.</p>`;
    } else {
        hList.innerHTML = '';
        histData.forEach(item => {
            const dateStr = item.fecha ? item.fecha.split('T')[0] : 'Sin fecha';
            const dateObj = new Date(dateStr);
            const dateFormatted = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

            let pillsHtml = '';
            try {
                if (item.ejercicios) {
                    const p = JSON.parse(item.ejercicios);
                    p.forEach(e => {
                        const name = typeof e === 'string' ? (allRecs.find(r => r.id === e)?.nombre || e) : e.nombre;
                        const icon = typeof e === 'string' ? (allRecs.find(r => r.id === e)?.icono || 'fa-dumbbell') : (e.icono ? e.icono.replace('md-', 'fa-') : 'fa-dumbbell');
                        pillsHtml += `<div class="history-pill"><i class="fa-solid ${icon}" style="color:var(--primary)"></i> ${name}</div>`;
                    });
                }
            } catch (e) { }

            const html = `
                <div class="history-card">
                    <button class="history-delete-btn" onclick="borrarHistorial('${item.id}')" title="Borrar registro"><i class="fa-solid fa-trash-can"></i></button>
                    <div class="history-header">
                        <i class="fa-regular fa-calendar-days mr-2"></i> ${dateFormatted}
                    </div>
                    <div class="history-body">
                        ${pillsHtml ? `
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text); margin-bottom:5px;"><i class="fa-solid fa-dumbbell text-light"></i> Ejercicios:</div>
                            <div class="history-pills mb-3">${pillsHtml}</div>
                        ` : ''}
                        
                        ${item.reposo ? `
                            <div class="history-notes-box">
                                <div style="font-weight:600; font-size:0.85rem; color:var(--text-light); margin-bottom:3px;"><i class="fa-regular fa-file-lines"></i> Notas:</div>
                                <div style="font-size:0.9rem; color:var(--text); font-style:italic;">${item.reposo}</div>
                            </div>
                        ` : ''}

                        ${item.tratamiento_privado ? `
                            <div style="background:#FEF3C7; padding:10px; border-radius:8px; margin-top:10px; border:1px solid #FDE68A;">
                                <div style="font-weight:600; font-size:0.85rem; color:#D97706; margin-bottom:3px;"><i class="fa-solid fa-lock"></i> Tratamiento Privado</div>
                                <div style="font-size:0.9rem; color:#92400E; font-style:italic;">${item.tratamiento_privado}</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            hList.innerHTML += html;
        });
    }
};

window.borrarHistorial = async function (id) {
    if (confirm('¿Seguro que quieres borrar este registro del historial?')) {
        try {
            await supabaseClient.from('historial_seguimiento').delete().eq('id', id);
            window.cargarFichaPaciente({ id_supabase: currentPatientId, ...window.currentPatientObj });
        } catch (e) {
            console.error(e);
            alert("Error al borrar el registro.");
        }
    }
}

window.abrirPacienteDesdeCalendario = async function (clienteId) {
    if (!clienteId) return;

    // Obtener datos del paciente
    const { data: userData, error } = await supabaseClient
        .from('auth_user')
        .select('*')
        .eq('id_supabase', clienteId)
        .single();

    if (error || !userData) {
        alert("No se pudo cargar la información de este paciente.");
        return;
    }

    // Comprobar si ya está en mis_pacientes
    const { data: misData } = await supabaseClient
        .from('mis_pacientes')
        .select('*')
        .eq('fisio_id', currentUser.id)
        .eq('cliente_id', clienteId)
        .single();

    if (!misData) {
        const quiereGuardar = confirm(`El paciente ${userData.username || 'desconocido'} no está guardado en tu lista "Mis Pacientes". ¿Deseas añadirlo ahora para poder ver y editar su ficha de tratamiento?`);
        if (quiereGuardar) {
            await supabaseClient.from('mis_pacientes').insert([{ fisio_id: currentUser.id, cliente_id: clienteId }]);
        } else {
            return; // Aborta si no quiere añadirlo
        }
    }

    // Navegar a la pestaña pacientes y abrir su ficha
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    const pTab = document.querySelector('.nav-item[data-tab="pacientes"]');
    if (pTab) pTab.classList.add('active');

    document.getElementById('pageTitle').textContent = "Mis Pacientes";

    document.querySelectorAll('.tab-pane').forEach(tab => tab.classList.remove('active'));
    document.getElementById('tab-pacientes').classList.remove('active');

    window.cargarFichaPaciente(userData);
};
