const supabase = require('../services/supabase');
const { checkPromotion } = require('../services/ranking');
const { sendRankNotification } = require('../services/fcm');
const path = require('path');
const fs = require('fs');

const generarOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

const RANK_WEIGHTS = { nuevo: 0, confiable: 1, experto: 2, pro: 3 };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MANDADOS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/local/tasks
 * Tareas open y no expiradas, JOIN con requester
 */
const getTasks = async (req, res) => {
    try {
        const now = new Date().toISOString();

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select(`
                id, title, description, pickup_location,
                delivery_location, price, commission, category,
                status, created_at, expires_at,
                users!requester_id (
                    id, full_name, avatar_url, rank
                )
            `)
            .eq('status', 'open')
            .gte('expires_at', now)
            .order('price', { ascending: false });

        if (error) throw error;

        const formatted = (tasks || []).map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            pickupLocation: t.pickup_location,
            deliveryLocation: t.delivery_location,
            price: t.price,
            commission: t.commission,
            category: t.category,
            status: t.status,
            createdAt: t.created_at,
            expiresAt: t.expires_at,
            requester: {
                id: t.users?.id,
                name: t.users?.full_name || 'Usuario',
                avatar: t.users?.avatar_url,
                rank: t.users?.rank || 'nuevo',
            },
        }));

        res.json({ tasks: formatted });
    } catch (error) {
        console.error('Error en getTasks:', error);
        res.status(500).json({ error: 'Error obteniendo tareas.' });
    }
};

/**
 * POST /api/local/tasks
 * Crear mandado
 */
const createTask = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { title, description, pickup_location, delivery_location, price, category } = req.body;

        if (!title || !pickup_location || !delivery_location || !price) {
            return res.status(400).json({ error: 'title, pickup_location, delivery_location y price son obligatorios.' });
        }

        if (price < 2000) {
            return res.status(400).json({ error: 'El precio mínimo es $2,000 COP.' });
        }

        const commission = Math.round(price * 0.12);

        const { data: task, error } = await supabase
            .from('tasks')
            .insert([{
                requester_id: requesterId,
                title,
                description: description || null,
                pickup_location,
                delivery_location,
                price,
                commission,
                category: category || 'otro',
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Mandado creado exitosamente.',
            task: {
                id: task.id,
                title: task.title,
                price: task.price,
                commission: task.commission,
                category: task.category,
                status: task.status,
                expiresAt: task.expires_at,
            },
        });
    } catch (error) {
        console.error('Error en createTask:', error);
        res.status(500).json({ error: 'Error creando mandado.' });
    }
};

/**
 * POST /api/local/tasks/:id/accept
 * Provider acepta mandado
 */
const acceptTask = async (req, res) => {
    try {
        const { id } = req.params;
        const providerId = req.user.id;
        const providerRank = req.user.rank || 'nuevo';

        // Obtener la tarea
        const { data: task, error: findError } = await supabase
            .from('tasks')
            .select('id, requester_id, status, price')
            .eq('id', id)
            .single();

        if (findError || !task) {
            return res.status(404).json({ error: 'Mandado no encontrado.' });
        }

        if (task.status !== 'open') {
            return res.status(400).json({ error: `No se puede aceptar. Estado actual: ${task.status}` });
        }

        // Provider no puede ser el requester
        if (task.requester_id === providerId) {
            return res.status(400).json({ error: 'No puedes aceptar tu propio mandado.' });
        }

        // Usuarios 'nuevo' solo pueden aceptar tareas <= $20,000
        if (providerRank === 'nuevo' && task.price > 20000) {
            return res.status(403).json({
                error: 'Usuarios con rango "nuevo" solo pueden aceptar mandados de hasta $20,000.',
                currentRank: providerRank,
                maxPrice: 20000,
            });
        }

        const otp = generarOTP();

        const { error: updateError } = await supabase
            .from('tasks')
            .update({
                provider_id: providerId,
                status: 'accepted',
                delivery_otp: otp,
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // Sumar +2 rank_points al provider
        const { data: providerUser } = await supabase
            .from('users')
            .select('rank_points, fcm_token')
            .eq('id', providerId)
            .single();

        if (providerUser) {
            await supabase
                .from('users')
                .update({ rank_points: (providerUser.rank_points || 0) + 2 })
                .eq('id', providerId);

            await checkPromotion(providerId);
        }

        // FCM al requester
        const { data: requester } = await supabase
            .from('users')
            .select('fcm_token')
            .eq('id', task.requester_id)
            .single();

        console.log('━━ FCM NOTIFICATION (STUB) ━━');
        console.log(`  To requester: ${task.requester_id}`);
        console.log(`  Body: ¡Alguien aceptó tu mandado!`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        res.json({
            message: 'Mandado aceptado.',
            taskId: id,
            otp,
            status: 'accepted',
            pointsAdded: 2,
        });
    } catch (error) {
        console.error('Error en acceptTask:', error);
        res.status(500).json({ error: 'Error aceptando mandado.' });
    }
};

/**
 * POST /api/local/tasks/:id/deliver
 * Provider entrega el mandado con foto de evidencia
 */
const deliverTask = async (req, res) => {
    try {
        const { id } = req.params;
        const providerId = req.user.id;

        // Obtener tarea
        const { data: task, error: findError } = await supabase
            .from('tasks')
            .select('id, provider_id, requester_id, status')
            .eq('id', id)
            .single();

        if (findError || !task) {
            return res.status(404).json({ error: 'Mandado no encontrado.' });
        }

        if (task.provider_id !== providerId) {
            return res.status(403).json({ error: 'Solo el proveedor asignado puede entregar.' });
        }

        if (task.status !== 'accepted') {
            return res.status(400).json({ error: `No se puede entregar. Estado actual: ${task.status}` });
        }

        let evidenceUrl = null;

        // Subir foto de evidencia a Supabase Storage
        if (req.file) {
            const filePath = `evidence/${id}_${Date.now()}${path.extname(req.file.originalname)}`;
            const fileBuffer = fs.readFileSync(req.file.path);

            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('veci-uploads')
                .upload(filePath, fileBuffer, {
                    contentType: req.file.mimetype,
                });

            if (uploadError) {
                console.error('Error subiendo evidencia:', uploadError);
            } else {
                const { data: urlData } = supabase
                    .storage
                    .from('veci-uploads')
                    .getPublicUrl(filePath);

                evidenceUrl = urlData?.publicUrl || null;
            }

            // Limpiar archivo temporal
            fs.unlinkSync(req.file.path);
        }

        const { error: updateError } = await supabase
            .from('tasks')
            .update({
                status: 'delivered',
                evidence_url: evidenceUrl,
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // FCM al requester
        console.log('━━ FCM NOTIFICATION (STUB) ━━');
        console.log(`  To requester: ${task.requester_id}`);
        console.log(`  Body: ¡Tu mandado llegó! Confirma con el código.`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        res.json({
            message: 'Mandado entregado. Esperando confirmación del solicitante.',
            taskId: id,
            status: 'delivered',
            evidenceUrl,
        });
    } catch (error) {
        console.error('Error en deliverTask:', error);
        res.status(500).json({ error: 'Error entregando mandado.' });
    }
};

/**
 * POST /api/local/tasks/:id/confirm
 * Requester confirma entrega con OTP
 */
const confirmDelivery = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.user.id;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ error: 'El código OTP es obligatorio.' });
        }

        const { data: task, error: findError } = await supabase
            .from('tasks')
            .select('id, requester_id, provider_id, status, delivery_otp')
            .eq('id', id)
            .single();

        if (findError || !task) {
            return res.status(404).json({ error: 'Mandado no encontrado.' });
        }

        if (task.requester_id !== requesterId) {
            return res.status(403).json({ error: 'Solo el solicitante puede confirmar la entrega.' });
        }

        if (task.status !== 'delivered') {
            return res.status(400).json({ error: `No se puede confirmar. Estado actual: ${task.status}` });
        }

        if (task.delivery_otp !== otp.toString()) {
            return res.status(401).json({ error: 'Código OTP inválido.' });
        }

        // Completar
        const { error: updateError } = await supabase
            .from('tasks')
            .update({ status: 'completed', delivery_otp: null })
            .eq('id', id);

        if (updateError) throw updateError;

        // +8 rank_points al provider
        let promotion = null;
        if (task.provider_id) {
            const { data: providerUser } = await supabase
                .from('users')
                .select('rank_points')
                .eq('id', task.provider_id)
                .single();

            if (providerUser) {
                await supabase
                    .from('users')
                    .update({ rank_points: (providerUser.rank_points || 0) + 8 })
                    .eq('id', task.provider_id);

                promotion = await checkPromotion(task.provider_id);
            }
        }

        res.json({
            message: 'Mandado completado exitosamente. ¡Gracias por confiar en VECI!',
            taskId: id,
            status: 'completed',
            providerPointsAdded: 8,
            promotion,
        });
    } catch (error) {
        console.error('Error en confirmDelivery:', error);
        res.status(500).json({ error: 'Error confirmando entrega.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SERVICIOS PROFESIONALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * GET /api/local/services
 * Lista servicios pro activos
 */
const getServices = async (req, res) => {
    try {
        const { category, rank_min } = req.query;

        let query = supabase
            .from('pro_services')
            .select(`
                id, category, title, description,
                price_from, price_to, min_rank,
                avg_rating, total_jobs, is_active, created_at,
                users!provider_id (
                    id, full_name, avatar_url, rank, trust_score
                )
            `)
            .eq('is_active', true);

        if (category) {
            query = query.eq('category', category);
        }
        if (rank_min) {
            // Filtrar servicios cuyos providers tengan rank >= rank_min
            const minWeight = RANK_WEIGHTS[rank_min] || 0;
            // No podemos filtrar JOINs directamente, filtramos post-query
        }

        const { data: services, error } = await query
            .order('avg_rating', { ascending: false });

        if (error) throw error;

        let formatted = (services || []).map(s => ({
            id: s.id,
            category: s.category,
            title: s.title,
            description: s.description,
            priceFrom: s.price_from,
            priceTo: s.price_to,
            minRank: s.min_rank,
            avgRating: parseFloat(s.avg_rating) || 0,
            totalJobs: s.total_jobs || 0,
            provider: {
                id: s.users?.id,
                name: s.users?.full_name || 'Profesional',
                avatar: s.users?.avatar_url,
                rank: s.users?.rank || 'nuevo',
                trustScore: parseFloat(s.users?.trust_score) || 5.0,
            },
        }));

        // Filtro post-query por rank_min del provider
        if (rank_min) {
            const minWeight = RANK_WEIGHTS[rank_min] || 0;
            formatted = formatted.filter(s =>
                (RANK_WEIGHTS[s.provider.rank] || 0) >= minWeight
            );
        }

        res.json({ services: formatted });
    } catch (error) {
        console.error('Error en getServices:', error);
        res.status(500).json({ error: 'Error obteniendo servicios profesionales.' });
    }
};

/**
 * POST /api/local/services
 * Crear servicio profesional (requireRank('confiable'))
 */
const createService = async (req, res) => {
    try {
        const providerId = req.user.id;
        const { category, title, description, price_from, price_to } = req.body;

        if (!category || !title || !price_from) {
            return res.status(400).json({ error: 'category, title y price_from son obligatorios.' });
        }

        const validCategories = [
            'plomeria', 'electricidad', 'tv_electronica',
            'cerrajeria', 'pintura', 'jardineria', 'limpieza', 'otro',
        ];

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                error: `Categoría inválida. Opciones: ${validCategories.join(', ')}`,
            });
        }

        const { data: service, error } = await supabase
            .from('pro_services')
            .insert([{
                provider_id: providerId,
                category,
                title,
                description: description || null,
                price_from,
                price_to: price_to || null,
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Servicio profesional creado.',
            service: {
                id: service.id,
                category: service.category,
                title: service.title,
                priceFrom: service.price_from,
                priceTo: service.price_to,
            },
        });
    } catch (error) {
        console.error('Error en createService:', error);
        res.status(500).json({ error: 'Error creando servicio profesional.' });
    }
};

/**
 * POST /api/local/services/:id/request
 * Solicitar un servicio profesional
 */
const requestService = async (req, res) => {
    try {
        const { id } = req.params;
        const requesterId = req.user.id;
        const { description, address, scheduled_at } = req.body;

        // Obtener servicio + provider
        const { data: service, error: findError } = await supabase
            .from('pro_services')
            .select('id, title, provider_id')
            .eq('id', id)
            .eq('is_active', true)
            .single();

        if (findError || !service) {
            return res.status(404).json({ error: 'Servicio no encontrado o inactivo.' });
        }

        if (service.provider_id === requesterId) {
            return res.status(400).json({ error: 'No puedes solicitar tu propio servicio.' });
        }

        // FCM stub al provider
        const { data: provider } = await supabase
            .from('users')
            .select('full_name, fcm_token')
            .eq('id', service.provider_id)
            .single();

        const { data: requester } = await supabase
            .from('users')
            .select('full_name, phone')
            .eq('id', requesterId)
            .single();

        console.log('━━ FCM NOTIFICATION (STUB) ━━');
        console.log(`  To provider: ${service.provider_id} (${provider?.full_name})`);
        console.log(`  Title: Nueva solicitud de servicio`);
        console.log(`  Body: ${requester?.full_name} necesita "${service.title}"`);
        console.log(`  Dirección: ${address || 'No especificada'}`);
        console.log(`  Fecha: ${scheduled_at || 'Lo antes posible'}`);
        console.log(`  Descripción: ${description || 'Sin detalles'}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        res.json({
            message: 'Solicitud enviada. El profesional te contactará.',
            serviceId: id,
            serviceTitle: service.title,
            providerName: provider?.full_name || 'Profesional',
        });
    } catch (error) {
        console.error('Error en requestService:', error);
        res.status(500).json({ error: 'Error enviando solicitud de servicio.' });
    }
};

module.exports = {
    getTasks,
    createTask,
    acceptTask,
    deliverTask,
    confirmDelivery,
    getServices,
    createService,
    requestService,
};
