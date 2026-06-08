let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Proteger ruta
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;

    // Verificar fisio
    const { data: fisioData, error: fisioError } = await supabaseClient
        .from('fisios')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

    if (fisioError || !fisioData) {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
        return;
    }

    // 2. Cargar Perfil de forma síncrona para que no haya parpadeos
    await cargarPerfil(currentUser.id, fisioData, currentUser.email);

    // Inicializar la pestaña que esté activa por defecto (Calendario)
    const activeTabItem = document.querySelector('.nav-item.active');
    if (activeTabItem) {
        document.getElementById('pageTitle').textContent = activeTabItem.textContent.trim();
        const target = activeTabItem.getAttribute('data-tab');
        if (target === 'calendario' && window.cargarCalendarioMes) window.cargarCalendarioMes();
    }

    // 3. Manejar Pestañas
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('pageTitle');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remover active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            tabPanes.forEach(tab => tab.classList.remove('active'));
            
            // Añadir active al clickeado
            item.classList.add('active');
            const target = item.getAttribute('data-tab');
            document.getElementById(`tab-${target}`).classList.add('active');
            
            // Actualizar título
            pageTitle.textContent = item.textContent.trim();

            // Disparar eventos si es necesario recargar datos
            if(target === 'calendario' && window.cargarCalendarioMes) window.cargarCalendarioMes();
            if(target === 'pacientes' && window.cargarPacientes) window.cargarPacientes();
        });
    });

    // 4. Cerrar sesión
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut({ scope: 'local' });
        window.location.href = 'login.html';
    });
});

async function cargarPerfil(userId, fisioData, authEmail) {
    // Obtener datos del auth_user para el nombre, email y foto
    const { data: userData } = await supabaseClient
        .from('auth_user')
        .select('username, email, foto_perfil_url')
        .eq('id_supabase', userId)
        .single();

    const nombre = userData && userData.username ? userData.username : (fisioData.nombre || 'Fisioterapeuta');
    const email = userData && userData.email ? userData.email : authEmail;
    const foto = (userData && userData.foto_perfil_url) ? userData.foto_perfil_url : (fisioData.foto_perfil_url || null);

    // Guardamos en memoria para luego actualizar
    window.currentProfileData = {
        userId: userId,
        nombre: nombre,
        email: email,
        foto: foto,
        num_colegiado: fisioData.num_colegiado || '',
        redes_sociales: fisioData.redes_sociales || '',
        especialidades: fisioData.especialidad ? fisioData.especialidad.split(',').map(s=>s.trim()).filter(Boolean) : []
    };

    renderizarPerfilInfo();

    // Event Listeners de la pestaña perfil
    document.getElementById('addSpecialtyBtn').onclick = () => {
        const input = document.getElementById('newSpecialtyInput');
        const val = input.value.trim();
        if(val && !window.currentProfileData.especialidades.includes(val)) {
            window.currentProfileData.especialidades.push(val);
            renderSpecialties();
            input.value = '';
        }
    };

    document.getElementById('profileForm').onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveProfileBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Actualizando...';

        try {
            const newName = document.getElementById('profName').value.trim();
            const newCol = document.getElementById('profColegiado').value.trim();
            const newRedes = document.getElementById('profRedes').value.trim();
            const specString = window.currentProfileData.especialidades.join(', ');

            // Actualizar auth_user
            await supabaseClient.from('auth_user')
                .update({ username: newName })
                .eq('id_supabase', userId);

            // Actualizar fisios
            await supabaseClient.from('fisios')
                .update({ 
                    nombre: newName,
                    num_colegiado: newCol,
                    redes_sociales: newRedes,
                    especialidad: specString
                })
                .eq('user_id', userId);

            window.currentProfileData.nombre = newName;
            renderizarPerfilInfo();
            alert('Perfil actualizado correctamente.');

        } catch (error) {
            console.error(error);
            alert('Error al actualizar el perfil.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Actualizar Perfil';
        }
    };
}

function renderizarPerfilInfo() {
    const data = window.currentProfileData;
    
    // Header
    document.getElementById('userNameHeader').textContent = data.nombre;
    
    // Formulario
    document.getElementById('profileTitleName').textContent = data.nombre;
    document.getElementById('profName').value = data.nombre;
    document.getElementById('profEmail').value = data.email;
    document.getElementById('profColegiado').value = data.num_colegiado;
    document.getElementById('profRedes').value = data.redes_sociales;

    // Avatares
    const avatares = [document.getElementById('userAvatarHeader'), document.getElementById('profileAvatarBig')];
    avatares.forEach(el => {
        if(data.foto) {
            el.innerHTML = `<img src="${data.foto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover">`;
        } else {
            el.textContent = data.nombre.charAt(0).toUpperCase();
        }
    });

    renderSpecialties();
}

function renderSpecialties() {
    const container = document.getElementById('specialtiesContainer');
    container.innerHTML = '';
    window.currentProfileData.especialidades.forEach((esp, index) => {
        const tag = document.createElement('div');
        tag.style.cssText = "display: flex; align-items: center; background: #EBF2EA; padding: 6px 12px; border-radius: 20px; border: 1px solid #DDE5DC; color: var(--primary); font-weight: 600; font-size: 14px;";
        
        const txt = document.createElement('span');
        txt.textContent = esp;
        
        const removeBtn = document.createElement('i');
        removeBtn.className = "fa-solid fa-circle-xmark";
        removeBtn.style.cssText = "margin-left: 8px; cursor: pointer;";
        removeBtn.onclick = () => {
            window.currentProfileData.especialidades.splice(index, 1);
            renderSpecialties();
        };

        tag.appendChild(txt);
        tag.appendChild(removeBtn);
        container.appendChild(tag);
    });
}
