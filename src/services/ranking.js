const supabase = require('./supabase');
const { sendRankNotification } = require('./fcm');

const RANK_THRESHOLDS = {
    nuevo: { next: 'confiable', points: 50 },
    confiable: { next: 'experto', points: 200 },
    experto: { next: 'pro', points: 500 },
    pro: null, // Rango máximo
};

/**
 * Verifica si el usuario debe subir de rango basado en sus rank_points.
 * Si hay promoción, actualiza el rango y envía notificación FCM.
 */
const checkPromotion = async (userId) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, rank, rank_points, fcm_token')
            .eq('id', userId)
            .single();

        if (error || !user) {
            console.error('checkPromotion: usuario no encontrado', userId);
            return null;
        }

        const threshold = RANK_THRESHOLDS[user.rank];

        // Si ya es 'pro' o no hay siguiente rango, no hacer nada
        if (!threshold) return null;

        // Verificar si tiene suficientes puntos para subir
        if (user.rank_points >= threshold.points) {
            const newRank = threshold.next;

            const { error: updateError } = await supabase
                .from('users')
                .update({ rank: newRank })
                .eq('id', userId);

            if (updateError) {
                console.error('checkPromotion: error actualizando rango', updateError);
                return null;
            }

            console.log(`🎉 Usuario ${userId} promovido: ${user.rank} → ${newRank}`);

            // Enviar notificación FCM (stub)
            await sendRankNotification(userId, newRank, user.fcm_token);

            return { previousRank: user.rank, newRank, points: user.rank_points };
        }

        return null; // Sin promoción
    } catch (error) {
        console.error('checkPromotion error:', error);
        return null;
    }
};

module.exports = { checkPromotion };
