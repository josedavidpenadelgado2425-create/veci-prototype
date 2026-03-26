const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const campusRoutes = require('./routes/campus');
const localRoutes = require('./routes/local');
const usersRoutes = require('./routes/users');
const metricsRoutes = require('./routes/metrics');

const app = express();

// Middlewares globales
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());

// Montaje de rutas
app.use('/api/auth', authRoutes);
app.use('/api/campus', campusRoutes);
app.use('/api/local', localRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/metrics', metricsRoutes);

// Ruta base
app.get('/', (req, res) => {
    res.json({ message: 'VECI v2.0 API V1.0 is running' });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

module.exports = app;
