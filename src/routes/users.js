const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const userController = require('../controllers/userController');

router.get('/me', authenticate, userController.getProfile);

module.exports = router;
