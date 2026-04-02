const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireUTP = require('../middleware/requireUTP');
const campusController = require('../controllers/campusController');

// Rutas de lectura — solo requieren autenticación (cualquier usuario puede ver tutores)
router.get('/tutors', authenticate, campusController.getTutors);
router.get('/tutors/:id', authenticate, campusController.getTutorDetail);
router.get('/tutors/:id/reviews', authenticate, campusController.getTutorReviews);

// Rutas de acción — requieren autenticación + ser estudiante UTP
router.post('/tutors/profile', authenticate, requireUTP, campusController.createTutorProfile);
router.post('/sessions/book', authenticate, requireUTP, campusController.bookSession);
router.post('/sessions/:id/confirm-payment', authenticate, requireUTP, campusController.confirmPayment);
router.post('/sessions/:id/complete', authenticate, requireUTP, campusController.completeSession);
router.post('/sessions/:id/review', authenticate, requireUTP, campusController.reviewSession);

module.exports = router;
