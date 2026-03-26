const rankWeights = {
    'nuevo': 0,
    'confiable': 1,
    'experto': 2,
    'pro': 3
};

module.exports = (requiredRank) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const currentRank = req.user.rank;
        const requiredWeight = rankWeights[requiredRank] || 0;
        const currentWeight = rankWeights[currentRank] || 0;

        if (currentWeight < requiredWeight) {
            return res.status(403).json({
                error: `Necesitas rango ${requiredRank} para esto`,
                currentRank,
                requiredRank
            });
        }

        next();
    };
};
