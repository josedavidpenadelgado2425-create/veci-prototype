const supabase = require('../services/supabase');

/**
 * GET /api/users/me
 * Perfil del usuario autenticado
 */
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, full_name, phone, avatar_url, user_type, rank, rank_points, trust_score, is_verified, created_at')
            .eq('id', userId)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        res.json({
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            avatarUrl: user.avatar_url,
            userType: user.user_type,
            rank: user.rank,
            rankPoints: user.rank_points,
            trustScore: parseFloat(user.trust_score) || 5.0,
            isVerified: user.is_verified,
            createdAt: user.created_at,
        });
    } catch (error) {
        console.error('Error en getProfile:', error);
        res.status(500).json({ error: 'Error obteniendo perfil.' });
    }
};

module.exports = {
    getProfile,
};
