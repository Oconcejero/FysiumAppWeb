document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const errorBox = document.getElementById('errorBox');

    // Verificar si ya está logueado
    checkExistingSession();

    async function checkExistingSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            verificarFisio(session.user.id);
        }
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) return;

        setLoading(true);
        hideError();

        try {
            // Autenticación con Supabase
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Verificamos que sea un Fisioterapeuta
            await verificarFisio(data.user.id);

        } catch (error) {
            console.error(error);
            showError("Correo o contraseña incorrectos.");
            setLoading(false);
        }
    });

    async function verificarFisio(userId) {
        try {
            // Buscamos al usuario en la tabla 'fisios'
            const { data, error } = await supabaseClient
                .from('fisios')
                .select('id')
                .eq('user_id', userId)
                .single();

            if (error || !data) {
                // Si no está en la tabla fisios, es un paciente normal. Rechazamos.
                await supabaseClient.auth.signOut({ scope: 'local' });
                showError("Acceso denegado. Esta sección es exclusiva para fisioterapeutas.");
                setLoading(false);
                return;
            }

            // Es fisio, redirigir al dashboard
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error("Error validando rol:", error);
            await supabaseClient.auth.signOut({ scope: 'local' });
            showError("Error al verificar permisos.");
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'block';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'block';
            btnSpinner.style.display = 'none';
        }
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }
});
