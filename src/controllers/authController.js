const supabase = require('../services/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const esUsuarioUTP = (email) => {
    return email.toLowerCase().endsWith('@utp.edu.co');
};

const generarOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const register = async (req, res) => {
    try {
        const { email, password, full_name, phone } = req.body;

        if (!email || !password || !full_name) {
            return res.status(400).json({ error: 'Email, password y full_name son obligatorios.' });
        }

        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado.' });
        }

        const isUTP = esUsuarioUTP(email);
        const userType = isUTP ? 'utp_student' : 'external';
        const userRank = isUTP ? 'confiable' : 'nuevo';
        const rankPoints = isUTP ? 100 : 0;

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const otp = generarOTP();

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                email,
                password_hash: passwordHash,
                full_name,
                phone,
                user_type: userType,
                rank: userRank,
                rank_points: rankPoints,
                temp_otp: otp
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        if (isUTP) {
            const { error: tutorError } = await supabase
                .from('tutor_profiles')
                .insert([{
                    user_id: newUser.id,
                    subjects: [],
                    price_hour: 10000
                }]);
            if (tutorError) console.error("Error creando perfil de tutor:", tutorError);
        }

        res.status(201).json({
            message: 'Usuario registrado. Verifique su email.',
            userId: newUser.id,
            userType: newUser.user_type,
            rank: newUser.rank,
            otp: otp // Solo para demo, en prod se enviaría por email/sms
        });

    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({ error: 'Error interno del servidor durante el registro.' });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email y OTP son obligatorios.' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        if (user.temp_otp !== otp.toString()) {
            return res.status(401).json({ error: 'El código OTP es inválido.' });
        }

        // Actualizamos a verificado y borramos OTP
        await supabase
            .from('users')
            .update({ is_verified: true, temp_otp: null })
            .eq('id', user.id);

        const token = jwt.sign(
            { id: user.id, email: user.email, user_type: user.user_type, rank: user.rank },
            process.env.JWT_SECRET || 'veci_super_secret_dev_key',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Verificación exitosa.',
            token,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                userType: user.user_type,
                rank: user.rank
            }
        });

    } catch (error) {
        console.error('Error en verifyOtp:', error);
        res.status(500).json({ error: 'Error interno validando OTP.' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y password son obligatorios.' });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const otp = generarOTP();
        const { error: updateError } = await supabase
            .from('users')
            .update({ temp_otp: otp })
            .eq('id', user.id);

        if (updateError) throw updateError;

        res.json({
            message: 'Requiere verificación OTP',
            userId: user.id,
            userType: user.user_type,
            otp: otp // Solo para demo
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error interno del servidor durante el login.' });
    }
};

module.exports = {
    register,
    verifyOtp,
    login
};
