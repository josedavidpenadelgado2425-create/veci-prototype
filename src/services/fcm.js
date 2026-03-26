/**
 * FCM (Firebase Cloud Messaging) Service — STUB
 * En producción, esto enviaría push notifications reales via Firebase Admin SDK.
 * Por ahora solo hace console.log para demo.
 */

const RANK_MESSAGES = {
    confiable: '⭐ ¡Subiste a rango Confiable! La comunidad confía en ti.',
    experto: '🎓 ¡Subiste a rango Experto! Ahora tienes acceso a más servicios.',
    pro: '👑 ¡Subiste a rango Pro! Eres un líder de la comunidad VECI.',
};

/**
 * Envía notificación de cambio de rango (stub).
 * @param {string} userId - ID del usuario
 * @param {string} newRank - Nuevo rango del usuario
 * @param {string|null} fcmToken - Token FCM del dispositivo (null si no tiene)
 */
const sendRankNotification = async (userId, newRank, fcmToken) => {
    const message = RANK_MESSAGES[newRank] || `🎖️ ¡Tu rango cambió a ${newRank}!`;

    console.log('━━ FCM NOTIFICATION (STUB) ━━');
    console.log(`  To: ${userId}`);
    console.log(`  Token: ${fcmToken || 'NO TOKEN'}`);
    console.log(`  Title: ¡Nuevo rango VECI!`);
    console.log(`  Body: ${message}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // TODO: Implementar con firebase-admin cuando se configure FCM
    // const admin = require('firebase-admin');
    // if (fcmToken) {
    //     await admin.messaging().send({
    //         token: fcmToken,
    //         notification: { title: '¡Nuevo rango VECI!', body: message },
    //     });
    // }

    return { sent: false, stub: true, message };
};

module.exports = { sendRankNotification };
