module.exports = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    if (req.user.user_type !== 'utp_student') {
        return res.status(403).json({ error: 'Esta función es exclusiva para estudiantes UTP' });
    }

    next();
};
