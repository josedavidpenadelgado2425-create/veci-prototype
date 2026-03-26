const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireUTP = require('../middleware/requireUTP');
const campusController = require('../controllers/campusController');

// Todas las rutas requieren authenticate + requireUTP
router.use(authenticate, requireUTP);

// Tutores
router.get('/tutors', campusController.getTutors);
router.get('/tutors/:id', campusController.getTutorDetail);
router.post('/tutors/profile', campusController.createTutorProfile);

// Sesiones
router.post('/sessions/book', campusController.bookSession);
router.post('/sessions/:id/confirm-payment', campusController.confirmPayment);
router.post('/sessions/:id/complete', campusController.completeSession);
router.post('/sessions/:id/review', campusController.reviewSession);

module.exports = router;
