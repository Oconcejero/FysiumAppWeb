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

    // Controles de mes
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() - 1);
        window.cargarCalendarioMes();
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentMonth.setMonth(currentMonth.getMonth() + 1);
        window.cargarCalendarioMes();
    });

    // Modales
    const addSessionModal = document.getElementById('addSessionModal');
    const bookSessionModal = document.getElementById('bookSessionModal');

    document.getElementById('addSessionBtn').addEventListener('click', () => {
        document.getElementById('sessionDate').value = formatearFecha(selectedDate);
        addSessionModal.classList.add('active');
    });

    document.getElementById('cancelSessionBtn').addEventListener('click', () => addSessionModal.classList.remove('active'));
    document.getElementById('cancelBookBtn').addEventListener('click', () => bookSessionModal.classList.remove('active'));

    // Guardar Sesión Libre
    document.getElementById('saveSessionBtn').addEventListener('click', async () => {
        const dia = document.getElementById('sessionDate').value;
        const inicio = document.getElementById('sessionStart').value;
        const fin = document.getElementById('sessionEnd').value;
        const precio = document.getElementById('sessionPrice').value;

        if (!dia || !inicio || !fin || !precio) return alert('Completa todos los campos');

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
            addSessionModal.classList.remove('active');
            window.cargarCalendarioMes(); // Recargar datos
        } catch (error) {
            console.error(error);
            alert("Error al guardar la sesión.");
        }
    });

    // Reservar manual
    document.getElementById('confirmBookBtn').addEventListener('click', async () => {
        const name = document.getElementById('manualPatientName').value.trim();
        const sessionId = bookSessionModal.dataset.sessionId;

        if (!name) return alert("Introduce un nombre");

        try {
            const uuid = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            const email = `fantasma.${Math.random().toString(36).substring(2, 8)}@fysium.app`;

            const { error: errorUser } = await supabaseClient
                .from('auth_user')
                .insert([{
                    id_supabase: uuid,
                    email: email,
                    username: name,
                    es_fantasma: true
                }]);

            if (errorUser && errorUser.code !== '23505') throw errorUser;

            const { error: errorCita } = await supabaseClient
                .from('horarios_disponibles')
                .update({
                    estado: 'reservado',
                    cliente_id: uuid,
                    nombre_paciente: name
                })
                .eq('id', sessionId);

            if (errorCita) throw errorCita;

            bookSessionModal.classList.remove('active');
            window.cargarCalendarioMes();

        } catch (error) {
            console.error(error);
            alert("Error al reservar: " + error.message);
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
    modal.dataset.sessionId = id;
    document.getElementById('manualPatientName').value = '';
    modal.classList.add('active');
}

window.deleteSession = async function (id) {
    if (confirm('¿Eliminar esta sesión libre?')) {
        await supabaseClient.from('horarios_disponibles').delete().eq('id', id);
        window.cargarCalendarioMes();
    }
}