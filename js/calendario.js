// Calendario JS (Doble Panel)
let currentMonth = new Date();
let selectedDate = new Date();
let monthAppointments = [];

function formatearFecha(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

document.addEventListener('DOMContentLoaded', () => {

    // 1. PRIMERO DEFINIMOS LA FUNCIÓN (Para que no dé el error "is not defined")
    const addSafeEventListener = (id, event, callback) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, callback);
        } else {
            console.warn(`[AVISO] No se encontró el botón: "${id}"`);
        }
    };

    // 2. Modales
    const addSessionModal = document.getElementById('addSessionModal');
    const bookSessionModal = document.getElementById('bookSessionModal');

    // 3. Controles de mes (Protegidos)
    addSafeEventListener('prevMonthBtn', 'click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        window.cargarCalendarioMes();
    });

    addSafeEventListener('addSessionBtn', 'click', () => {
        const addSessionModal = document.getElementById('addSessionModal');
        if (addSessionModal) {
            addSessionModal.classList.add('active');
        }
    });

    addSafeEventListener('nextMonthBtn', 'click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        window.cargarCalendarioMes();
    });

    // 4. Botones para cerrar modales (Añade estos ids a tu HTML si no los tienes)
    addSafeEventListener('cancelSessionBtn', 'click', () => {
        if (addSessionModal) addSessionModal.classList.remove('active');
    });

    // 5. Guardar Sesión Libre
    addSafeEventListener('saveSessionBtn', 'click', async () => {
        console.log("1. Botón Guardar pulsado");

        const diaInput = document.getElementById('sessionDate');
        const inicioInput = document.getElementById('sessionStart');
        const finInput = document.getElementById('sessionEnd');
        const precioInput = document.getElementById('sessionPrice');

        if (!diaInput || !inicioInput || !finInput || !precioInput) {
            console.error("2. ERROR: No se encuentran los campos en el HTML. Revisa los IDs.");
            return;
        }

        const dia = diaInput.value;
        const inicio = inicioInput.value;
        const fin = finInput.value;
        const precio = precioInput.value;

        if (!dia || !inicio || !fin || !precio) {
            console.warn("3. Faltan campos por rellenar");
            return alert('Completa todos los campos');
        }

        console.log("4. Intentando guardar en Supabase...", { dia, inicio, fin, precio });

        const btn = document.getElementById('saveSessionBtn');
        if (btn) btn.textContent = "Guardando...";

        try {
            const { error } = await supabaseClient
                .from('horarios_disponibles')
                .insert([{
                    fisio_id: currentUser.id,
                    dia: dia,
                    hora: inicio,
                    hora_fin: fin,
                    precio: parseFloat(precio),
                    estado: 'libre'
                }]);

            if (error) throw error;
            console.log("5. Sesión guardada con éxito en la base de datos.");

            // --- INICIO BLOQUE NOTIFICACIÓN: AVISO A FAVORITOS ---
            try {
                // 1. Buscamos qué pacientes tienen a este fisio en favoritos
                const { data: listaFavoritos } = await supabaseClient
                    .from('favoritos')
                    .select('user_id')
                    .eq('fisio_id', currentUser.id);

                if (listaFavoritos && listaFavoritos.length > 0) {
                    const idsPacientes = listaFavoritos.map(f => f.user_id);

                    // CORRECCIÓN: Si el array de IDs está vacío, Supabase da error en el .in()
                    if (idsPacientes.length > 0) {
                        // 2. Buscamos sus tokens de forma segura con el PASE VIP
                        const usuarios = [];
                        for (const id of idsPacientes) {
                            const { data: rpcData } = await supabaseClient.rpc('obtener_token_y_preferencias', { usuario_objetivo: id });
                            if (rpcData && rpcData.length > 0) usuarios.push(rpcData[0]);
                        }

                        const fechaBonita = dia.split('-').reverse().join('/');

                        // 3. Enviamos el Push a los que lo permitan
                        for (const u of (usuarios || [])) {
                            if (u.push_token && (u.alertas_nuevas_horas === true || u.alertas_nuevas_horas === null)) {
                                await fetch('https://corsproxy.io/?https://exp.host/--/api/v2/push/send', {
                                    method: 'POST',
                                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        to: u.push_token,
                                        sound: 'default',
                                        title: '🔥 ¡Nuevos horarios disponibles!',
                                        body: `Tu fisio favorito acaba de publicar sesiones libres el ${fechaBonita} a las ${inicio}. ¡Corre a reservar!`
                                    })
                                });
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error silencioso avisando a favoritos:", err);
            }
            // --- FIN BLOQUE NOTIFICACIÓN ---

            console.log("6. Cerrando modal y recargando calendario");
            const addSessionModal = document.getElementById('addSessionModal');
            if (addSessionModal) addSessionModal.classList.remove('active');

            // Limpiamos los campos para la próxima vez
            diaInput.value = '';
            inicioInput.value = '';
            finInput.value = '';

            window.cargarCalendarioMes();
        } catch (error) {
            console.error("ERROR CRÍTICO:", error);
            alert("Error al guardar la sesión: " + error.message);
        } finally {
            if (btn) btn.textContent = "Guardar Sesión"; // Restauramos el texto del botón
        }
    });
});

window.cargarCalendarioMes = async function () {
    if (!currentUser) return;

    const title = document.getElementById('monthTitle');
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    title.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

    // Limpieza automática
    const hoyStr = formatearFecha(new Date());
    await supabaseClient.from('horarios_disponibles').delete().eq('fisio_id', currentUser.id).eq('estado', 'libre').lt('dia', hoyStr);

    // Rango del mes
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // MODIFICACIÓN: Solucionado el error silencioso de la tabla relacional
    const { data, error } = await supabaseClient
        .from('horarios_disponibles')
        .select('*') // Consulta plana sin joins problemáticos
        .eq('fisio_id', currentUser.id)
        .gte('dia', formatearFecha(startOfMonth))
        .lte('dia', formatearFecha(endOfMonth))
        .neq('estado', 'cancelado')
        .order('hora', { ascending: true });

    if (!error && data) {
        // Segundo paso ultra seguro: Si hay pacientes de App, traemos sus nombres
        const clienteIds = [...new Set(data.filter(c => c.cliente_id && !c.nombre_paciente).map(c => c.cliente_id))];
        if (clienteIds.length > 0) {
            const { data: users } = await supabaseClient.from('auth_user').select('id_supabase, username').in('id_supabase', clienteIds);
            if (users) {
                data.forEach(c => {
                    if (c.cliente_id && !c.nombre_paciente) {
                        const u = users.find(u => u.id_supabase === c.cliente_id);
                        if (u) c.nombre_paciente = u.username;
                    }
                });
            }
        }
        monthAppointments = data;
    } else {
        console.error("Error cargando citas (Míralo aquí en la consola):", error);
        monthAppointments = [];
    }

    renderizarGridMes();
    renderizarDiaSeleccionado();
};

function renderizarGridMes() {
    const grid = document.getElementById('monthGrid');
    grid.innerHTML = '';

    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    // Ajustar para que el Lunes sea el día 0
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    // Espacios vacíos antes del 1
    for (let i = 0; i < startDayOfWeek; i++) {
        grid.innerHTML += `<div class="month-day empty"></div>`;
    }

    // Días del mes
    const hoy = formatearFecha(new Date());
    const seleccionado = formatearFecha(selectedDate);

    for (let d = 1; d <= lastDay.getDate(); d++) {
        const fechaIteracion = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
        const diaStr = formatearFecha(fechaIteracion);

        let clases = "month-day";
        if (diaStr === hoy) clases += " today";
        if (diaStr === seleccionado) clases += " active";

        const tieneCitas = monthAppointments.some(cita => cita.dia === diaStr);
        const dotHtml = tieneCitas ? `<div class="dot"></div>` : '';

        const div = document.createElement('div');
        div.className = clases;
        div.innerHTML = `${d} ${dotHtml}`;
        div.onclick = () => {
            selectedDate = new Date(fechaIteracion);
            renderizarGridMes(); // Repintar para marcar el activo
            renderizarDiaSeleccionado();
        };
        grid.appendChild(div);
    }
}

function renderizarDiaSeleccionado() {
    const title = document.getElementById('selectedDayTitle');
    const list = document.getElementById('daySessionsList');

    const diaStr = formatearFecha(selectedDate);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    title.textContent = selectedDate.toLocaleDateString('es-ES', options);

    const citasDelDia = monthAppointments.filter(cita => cita.dia === diaStr);

    if (citasDelDia.length === 0) {
        list.innerHTML = `<p class="text-light text-center mt-4">No hay sesiones este día.</p>`;
        return;
    }

    list.innerHTML = '';
    citasDelDia.forEach(s => {
        const item = document.createElement('div');
        item.className = `session-item ${s.estado === 'reservado' ? 'reserved' : ''}`;

        // El nombre ya viene inyectado con el arreglo de arriba
        const patientName = s.nombre_paciente || 'Paciente';

        let content = `
            <div style="flex:1">
                <div class="session-time">${s.hora} - ${s.hora_fin}</div>
                <div class="session-status">${s.estado === 'reservado' ? `RESERVADO: ${patientName}` : 'LIBRE'}</div>
                <div class="session-price">${s.precio}€</div>
            </div>
        `;

        if (s.estado === 'reservado' && s.cliente_id) {
            item.style.cursor = 'pointer';
            item.onclick = () => { if (window.abrirPacienteDesdeCalendario) window.abrirPacienteDesdeCalendario(s.cliente_id); };
            content += `<div style="display:flex; align-items:center; color:var(--primary)"><i class="fa-solid fa-chevron-right"></i></div>`;
        }

        if (s.estado === 'libre') {
            content += `
                <div style="display:flex; flex-direction:column; gap:5px">
                    <button class="icon-btn" onclick="openBookModal('${s.id}')" title="Reservar Manual" style="width:30px; height:30px; background:#e0f2fe; color:#0284c7"><i class="fa-solid fa-user-check" style="font-size:12px"></i></button>
                    <button class="icon-btn" onclick="deleteSession('${s.id}')" title="Borrar" style="width:30px; height:30px; background:#fee2e2; color:var(--danger)"><i class="fa-solid fa-trash" style="font-size:12px"></i></button>
                </div>
            `;
        }

        item.innerHTML = content;
        list.appendChild(item);
    });
}

window.openBookModal = function (id) {
    const modal = document.getElementById('bookSessionModal');
    if (!modal) return;

    modal.dataset.sessionId = id;

    // Limpiar campos de "Nuevo Paciente"
    const inputNombre = document.getElementById('nuevoNombre');
    const inputEmail = document.getElementById('nuevoEmail');
    if (inputNombre) inputNombre.value = '';
    if (inputEmail) inputEmail.value = '';

    // Limpiar el buscador
    const buscador = document.getElementById('buscadorPaciente');
    if (buscador) {
        buscador.value = '';
        window.filtrarPacientes();
    }

    window.mostrarSeccion('pacientes');

    modal.classList.add('active');

    if (buscador) {
        setTimeout(() => buscador.focus(), 100);
    }
}

window.deleteSession = async function (id) {
    if (!confirm("¿Seguro que quieres eliminar esta cita?")) return;

    const { error } = await supabaseClient
        .from('horarios_disponibles')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        // RECARGAR CALENDARIO
        window.cargarCalendarioMes();
    }
}

async function cargarPacientesParaModal() {
    const lista = document.getElementById('listaPacientesGuardados');
    const { data: misPacs } = await supabaseClient
        .from('mis_pacientes')
        .select('cliente_id, auth_user(username, foto_perfil_url)')
        .eq('fisio_id', currentUser.id);

    lista.innerHTML = misPacs.map(p => `
        <li onclick="seleccionarPaciente('${p.auth_user.username}')" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee">
            <img src="${p.auth_user.foto_perfil_url || 'default-avatar.png'}" style="width:30px; border-radius:50%">
            ${p.auth_user.username}
        </li>
    `).join('');
}

window.mostrarSeccion = function (seccion) {
    document.getElementById('seccionPacientes').style.display = seccion === 'pacientes' ? 'block' : 'none';
    document.getElementById('seccionNuevo').style.display = seccion === 'nuevo' ? 'block' : 'none';

    const btnPac = document.getElementById('tabPacientesBtn');
    const btnNuev = document.getElementById('tabNuevoBtn');
    if (btnPac && btnNuev) {
        if (seccion === 'pacientes') {
            btnPac.classList.add('active');
            btnNuev.classList.remove('active');
        } else {
            btnNuev.classList.add('active');
            btnPac.classList.remove('active');
        }
    }

    if (seccion === 'pacientes') window.cargarPacientesParaModal();
};

// window.filtrarPacientes = function () {
//     const input = document.getElementById('buscadorPaciente');
//     if (!input) return;

//     const filter = input.value.toLowerCase();
//     const ul = document.getElementById('listaPacientesGuardados');
//     if (!ul) return;

//     const li = ul.getElementsByTagName('li');

//     for (let i = 0; i < li.length; i++) {
//         let txtValue = li[i].textContent || li[i].innerText;
//         li[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
//     }
// };

// window.cargarPacientesParaModal = async function () {
//     const lista = document.getElementById('listaPacientesGuardados');
//     if (!lista) return;

//     // Traemos los datos
//     const { data: misPacs } = await supabaseClient
//         .from('mis_pacientes')
//         .select('cliente_id, auth_user(username, foto_perfil_url)')
//         .eq('fisio_id', currentUser.id);

//     if (!misPacs) return;

//     lista.innerHTML = misPacs.map(p => {
//         const nombre = p.auth_user.username || 'Paciente';
//         const inicial = nombre.charAt(0).toUpperCase();
//         const foto = p.auth_user.foto_perfil_url;

//         const avatarContent = foto
//             ? `<img src="${foto}" onerror="this.parentElement.innerHTML='${inicial}'">`
//             : inicial;

//         // Ahora, al hacer clic, llamamos directamente a la reserva
//         return `
//             <li class="patient-row" onclick="reservarPacienteExistente('${p.cliente_id}', '${nombre}')">
//                 <div class="avatar-mini">${avatarContent}</div>
//                 <span>${nombre}</span>
//             </li>
//         `;
//     }).join('');
// };

window.mostrarSeccion = function (seccion) {
    document.getElementById('seccionPacientes').style.display = seccion === 'pacientes' ? 'block' : 'none';
    document.getElementById('seccionNuevo').style.display = seccion === 'nuevo' ? 'block' : 'none';

    const btnPac = document.getElementById('tabPacientesBtn');
    const btnNuev = document.getElementById('tabNuevoBtn');
    if (btnPac && btnNuev) {
        if (seccion === 'pacientes') {
            btnPac.classList.add('active');
            btnNuev.classList.remove('active');
        } else {
            btnNuev.classList.add('active');
            btnPac.classList.remove('active');
        }
    }

    if (seccion === 'pacientes') window.cargarPacientesParaModal();
};

window.filtrarPacientes = function () {
    const input = document.getElementById('buscadorPaciente');
    if (!input) return;

    const filter = input.value.toLowerCase();
    const ul = document.getElementById('listaPacientesGuardados');
    if (!ul) return;

    const li = ul.getElementsByTagName('li');

    for (let i = 0; i < li.length; i++) {
        let txtValue = li[i].textContent || li[i].innerText;
        li[i].style.display = txtValue.toLowerCase().indexOf(filter) > -1 ? "" : "none";
    }
};

window.cargarPacientesParaModal = async function () {
    const lista = document.getElementById('listaPacientesGuardados');
    if (!lista) return;

    // Traemos los datos APLICANDO EL FILTRO DE ACTIVOS (Borrado Lógico)
    const { data: misPacs } = await supabaseClient
        .from('mis_pacientes')
        .select('cliente_id, auth_user(username, foto_perfil_url)')
        .eq('fisio_id', currentUser.id)
        .eq('activo', true); // <-- AQUÍ ESTÁ LA LÍNEA MÁGICA

    if (!misPacs) return;

    lista.innerHTML = misPacs.map(p => {
        const nombre = p.auth_user.username || 'Paciente';
        const inicial = nombre.charAt(0).toUpperCase();
        const foto = p.auth_user.foto_perfil_url;

        const avatarContent = foto
            ? `<img src="${foto}" onerror="this.parentElement.innerHTML='${inicial}'">`
            : inicial;

        return `
            <li class="patient-row" onclick="reservarPacienteExistente('${p.cliente_id}', '${nombre}')">
                <div class="avatar-mini">${avatarContent}</div>
                <span>${nombre}</span>
            </li>
        `;
    }).join('');
};

window.reservarPacienteExistente = async function (clienteId, nombre) {
    if (!confirm(`¿Reservar cita para ${nombre}?`)) return;

    const modal = document.getElementById('bookSessionModal');
    const sessionId = modal.dataset.sessionId;

    try {
        const { error: errorCita } = await supabaseClient
            .from('horarios_disponibles')
            .update({
                estado: 'reservado',
                cliente_id: clienteId,
                nombre_paciente: nombre
            })
            .eq('id', sessionId);

        if (errorCita) throw errorCita;

        try {
            // Buscamos las preferencias del paciente
            const { data: rpcData } = await supabaseClient.rpc('obtener_token_y_preferencias', {
                usuario_objetivo: clienteId
            });
            const userPref = rpcData && rpcData.length > 0 ? rpcData[0] : null;

            // Si tiene token y no ha desactivado las alertas, le avisamos
            if (userPref && userPref.push_token && (userPref.alertas_citas === true || userPref.alertas_citas === null)) {

                // Necesitamos consultar la fecha y hora de la cita que acabamos de reservar
                const { data: citaInfo } = await supabaseClient
                    .from('horarios_disponibles')
                    .select('dia, hora')
                    .eq('id', sessionId)
                    .single();

                if (citaInfo) {
                    const fechaBonita = citaInfo.dia.split('-').reverse().join('/');

                    await fetch('https://corsproxy.io/?https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: userPref.push_token,
                            sound: 'default',
                            title: '📅 Nueva Cita Programada',
                            body: `Tu fisioterapeuta te ha reservado una sesión el ${fechaBonita} a las ${citaInfo.hora}.`
                        })
                    });
                }
            }
        } catch (err) {
            console.error("Error enviando alerta de cita al paciente:", err);
        }

        modal.classList.remove('active');
        window.cargarCalendarioMes();
    } catch (error) {
        console.error(error);
        alert("Error al reservar: " + error.message);
    }
};

// FLUJO 2: Reservar creando un paciente nuevo
window.finalizarReserva = async function () {
    const modal = document.getElementById('bookSessionModal');
    const sessionId = modal.dataset.sessionId;

    const nombre = document.getElementById('nuevoNombre').value.trim();
    const telefono = document.getElementById('nuevoTelefono').value.trim();
    const email = document.getElementById('nuevoEmail').value.trim();
    const fechaNac = document.getElementById('nuevoFechaNac').value.trim();

    if (!nombre) return alert("El nombre es obligatorio.");

    try {
        // Generador de UUID idéntico al de tu App
        const idSupabaseFantasma = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const emailFinal = email ? email : `fantasma.${Math.random().toString(36).substring(2, 8)}@fysium.app`;

        // 1. Crear usuario en auth_user
        const { error: errorUsuario } = await supabaseClient
            .from('auth_user')
            .insert([{
                id_supabase: idSupabaseFantasma,
                email: emailFinal,
                username: nombre,
                telefono: telefono || null,
                fecha_nacimiento: fechaNac || null,
                es_fantasma: true
            }]);

        if (errorUsuario && errorUsuario.code !== '23505') throw errorUsuario;

        // 2. Vincularlo al Fisio
        await supabaseClient
            .from('mis_pacientes')
            .insert([{ fisio_id: currentUser.id, cliente_id: idSupabaseFantasma }]);

        // 3. Reservar la cita
        const { error: errorCita } = await supabaseClient
            .from('horarios_disponibles')
            .update({
                estado: 'reservado',
                cliente_id: idSupabaseFantasma,
                nombre_paciente: nombre
            })
            .eq('id', sessionId);

        if (errorCita) throw errorCita;

        // Éxito: cerramos y recargamos
        modal.classList.remove('active');
        window.cargarCalendarioMes();

    } catch (error) {
        console.error(error);
        alert("Error al reservar y crear paciente: " + error.message);
    }
};

window.seleccionarPaciente = function (nombre) {
    document.getElementById('manualPatientName').value = nombre;
};