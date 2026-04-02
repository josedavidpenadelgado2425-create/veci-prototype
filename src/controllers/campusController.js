const supabase = require('../services/supabase');
const { checkPromotion } = require('../services/ranking');

const generarOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campus/tutors
// Query params: faculty, subject, price_max, modality
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getTutors = async (req, res) => {
    try {
        const { faculty, subject, price_max, modality } = req.query;

        let query = supabase
            .from('tutor_profiles')
            .select(`
                id, user_id, subjects, faculty, semester,
                price_hour, bio, modality, avg_rating,
                total_sessions, is_active, created_at,
                users (
                    id, full_name, email, avatar_url, rank, trust_score
                )
            `)
            .eq('is_active', true);

        if (faculty) {
            query = query.eq('faculty', faculty);
        }
        if (modality) {
            query = query.eq('modality', modality);
        }
        if (price_max) {
            query = query.lte('price_hour', parseInt(price_max));
        }
        if (subject) {
            query = query.contains('subjects', [subject]);
        }

        const { data: tutors, error } = await query
            .order('avg_rating', { ascending: false });

        console.log('[getTutors] raw query result:', JSON.stringify({ error, count: tutors?.length }));
        if (tutors?.length > 0) {
            console.log('[getTutors] first tutor sample:', JSON.stringify(tutors[0]));
        }

        if (error) throw error;

        const formatted = (tutors || []).map(t => ({
            id: t.id,
            userId: t.user_id,
            subjects: t.subjects || [],
            faculty: t.faculty,
            semester: t.semester,
            priceHour: t.price_hour,
            bio: t.bio,
            modality: t.modality,
            avgRating: parseFloat(t.avg_rating) || 0,
            totalSessions: t.total_sessions || 0,
            userName: t.users?.full_name || 'Tutor',
            userAvatar: t.users?.avatar_url,
            userRank: t.users?.rank || 'nuevo',
            trustScore: parseFloat(t.users?.trust_score) || 5.0,
        }));

        console.log('[getTutors] formatted count:', formatted.length);
        res.json({ tutors: formatted });
    } catch (error) {
        console.error('Error en getTutors:', error);
        res.status(500).json({ error: 'Error obteniendo tutores.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET /api/campus/tutors/:id
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const getTutorDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: tutor, error } = await supabase
            .from('tutor_profiles')
            .select(`
                *,
                users (
                    id, full_name, email, avatar_url, rank, trust_score
                )
            `)
            .eq('id', id)
            .single();

        if (error || !tutor) {
            return res.status(404).json({ error: 'Tutor no encontrado.' });
        }

        res.json({
            id: tutor.id,
            userId: tutor.user_id,
            subjects: tutor.subjects || [],
            faculty: tutor.faculty,
            semester: tutor.semester,
            priceHour: tutor.price_hour,
            bio: tutor.bio,
            modality: tutor.modality,
            avgRating: parseFloat(tutor.avg_rating) || 0,
            totalSessions: tutor.total_sessions || 0,
            userName: tutor.users?.full_name || 'Tutor',
            userAvatar: tutor.users?.avatar_url,
            userRank: tutor.users?.rank || 'nuevo',
            trustScore: parseFloat(tutor.users?.trust_score) || 5.0,
        });
    } catch (error) {
        console.error('Error en getTutorDetail:', error);
        res.status(500).json({ error: 'Error obteniendo detalle del tutor.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campus/tutors/profile
// Crear perfil de tutor para el usuario autenticado
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const createTutorProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subjects, faculty, semester, price_hour, bio, modality } = req.body;

        // Validaciones
        if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({ error: 'Debes indicar al menos una materia en subjects[].' });
        }
        if (!price_hour || price_hour < 10000 || price_hour > 100000) {
            return res.status(400).json({ error: 'price_hour debe estar entre 10,000 y 100,000 COP.' });
        }

        // Verificar si ya tiene perfil de tutor
        const { data: existing } = await supabase
            .from('tutor_profiles')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existing) {
            return res.status(409).json({ error: 'Ya tienes un perfil de tutor. Usa PATCH para actualizarlo.' });
        }

        const { data: profile, error } = await supabase
            .from('tutor_profiles')
            .insert([{
                user_id: userId,
                subjects,
                faculty: faculty || null,
                semester: semester || null,
                price_hour,
                bio: bio || null,
                modality: modality || 'presencial',
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            message: 'Perfil de tutor creado exitosamente.',
            profile: {
                id: profile.id,
                subjects: profile.subjects,
                faculty: profile.faculty,
                semester: profile.semester,
                priceHour: profile.price_hour,
                bio: profile.bio,
                modality: profile.modality,
            },
        });
    } catch (error) {
        console.error('Error en createTutorProfile:', error);
        res.status(500).json({ error: 'Error creando perfil de tutor.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campus/sessions/book
// Estudiante agenda tutoría con un tutor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const bookSession = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { tutorId, subject, scheduledAt, durationHours, modality, notes } = req.body;

        console.log('[bookSession] body:', JSON.stringify(req.body));
        console.log('[bookSession] studentId:', studentId);

        if (!tutorId || !subject || !scheduledAt) {
            return res.status(400).json({ error: 'tutorId, subject y scheduledAt son obligatorios.' });
        }

        const duration = parseFloat(durationHours) || 1.0;

        // Obtener precio del tutor
        const { data: tutor, error: tutorError } = await supabase
            .from('tutor_profiles')
            .select('id, price_hour, user_id')
            .eq('id', tutorId)
            .eq('is_active', true)
            .single();

        if (tutorError || !tutor) {
            return res.status(404).json({ error: 'Tutor no encontrado o inactivo.' });
        }

        // No puedes agendarte a ti mismo
        if (tutor.user_id === studentId) {
            return res.status(400).json({ error: 'No puedes agendar una tutoría contigo mismo.' });
        }

        // Cálculos financieros
        const totalAmount = Math.round(duration * tutor.price_hour);
        const commission = Math.round(totalAmount * 0.13);
        const tutorPayout = totalAmount - commission;

        const { data: session, error: insertError } = await supabase
            .from('tutoring_sessions')
            .insert([{
                tutor_id: tutorId,
                student_id: studentId,
                subject,
                scheduled_at: scheduledAt,
                duration_hours: duration,
                total_amount: totalAmount,
                commission,
                tutor_payout: tutorPayout,
                status: 'pending',
                modality: modality || 'presencial',
                notes: notes || null,
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        res.status(201).json({
            sessionId: session.id,
            totalAmount,
            commission,
            tutorPayout,
            status: 'payment_simulated',
            message: 'Reserva creada. Procede al pago simulado.',
        });
    } catch (error) {
        console.error('Error en bookSession:', error);
        res.status(500).json({ error: 'Error reservando sesión de tutoría.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campus/sessions/:id/confirm-payment
// Confirma pago simulado, genera OTP de sesión
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const confirmPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verificar que la sesión existe y pertenece al estudiante
        const { data: session, error: findError } = await supabase
            .from('tutoring_sessions')
            .select('id, student_id, status')
            .eq('id', id)
            .single();

        if (findError || !session) {
            return res.status(404).json({ error: 'Sesión no encontrada.' });
        }

        if (session.student_id !== userId) {
            return res.status(403).json({ error: 'No tienes permisos sobre esta sesión.' });
        }

        if (session.status !== 'pending') {
            return res.status(400).json({ error: `No se puede confirmar pago. Estado actual: ${session.status}` });
        }

        const otp = generarOTP();

        const { error: updateError } = await supabase
            .from('tutoring_sessions')
            .update({ status: 'confirmed', otp_code: otp })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({
            message: 'Pago confirmado (simulado). Sesión confirmada.',
            sessionId: id,
            otp,
            status: 'confirmed',
        });
    } catch (error) {
        console.error('Error en confirmPayment:', error);
        res.status(500).json({ error: 'Error confirmando pago.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campus/sessions/:id/complete
// Solo el estudiante puede completar. Suma rank_points al tutor.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const completeSession = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obtener sesión con datos del tutor
        const { data: session, error: findError } = await supabase
            .from('tutoring_sessions')
            .select(`
                id, student_id, status, tutor_id,
                tutor_profiles!tutor_id ( user_id )
            `)
            .eq('id', id)
            .single();

        if (findError || !session) {
            return res.status(404).json({ error: 'Sesión no encontrada.' });
        }

        if (session.student_id !== userId) {
            return res.status(403).json({ error: 'Solo el estudiante puede completar la sesión.' });
        }

        if (session.status !== 'confirmed') {
            return res.status(400).json({ error: `No se puede completar. Estado actual: ${session.status}` });
        }

        // Marcar como completada
        const { error: updateError } = await supabase
            .from('tutoring_sessions')
            .update({ status: 'completed' })
            .eq('id', id);

        if (updateError) throw updateError;

        // Incrementar total_sessions del tutor
        await supabase.rpc('increment_counter', {
            row_id: session.tutor_id,
            table_name: 'tutor_profiles',
            column_name: 'total_sessions',
        }).catch(() => {
            // Fallback: update manual
            supabase
                .from('tutor_profiles')
                .select('total_sessions')
                .eq('id', session.tutor_id)
                .single()
                .then(({ data }) => {
                    if (data) {
                        supabase
                            .from('tutor_profiles')
                            .update({ total_sessions: (data.total_sessions || 0) + 1 })
                            .eq('id', session.tutor_id)
                            .then(() => { });
                    }
                });
        });

        // Sumar rank_points al tutor (+10 por sesión completada)
        const tutorUserId = session.tutor_profiles?.user_id;
        let promotion = null;

        if (tutorUserId) {
            const { data: tutorUser } = await supabase
                .from('users')
                .select('rank_points')
                .eq('id', tutorUserId)
                .single();

            if (tutorUser) {
                await supabase
                    .from('users')
                    .update({ rank_points: (tutorUser.rank_points || 0) + 10 })
                    .eq('id', tutorUserId);

                // Verificar promoción de rango
                promotion = await checkPromotion(tutorUserId);
            }
        }

        res.json({
            message: 'Sesión completada exitosamente.',
            sessionId: id,
            status: 'completed',
            tutorPointsAdded: 10,
            promotion,
        });
    } catch (error) {
        console.error('Error en completeSession:', error);
        res.status(500).json({ error: 'Error completando sesión.' });
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /api/campus/sessions/:id/review
// Dejar reseña + actualizar avg_rating del tutor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const reviewSession = async (req, res) => {
    try {
        const { id } = req.params;
        const reviewerId = req.user.id;
        const { rating, comment } = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'rating debe estar entre 1 y 5.' });
        }

        // Verificar que la sesión existe, está completada, y pertenece al estudiante
        const { data: session, error: findError } = await supabase
            .from('tutoring_sessions')
            .select(`
                id, student_id, tutor_id, status,
                tutor_profiles!tutor_id ( user_id )
            `)
            .eq('id', id)
            .single();

        if (findError || !session) {
            return res.status(404).json({ error: 'Sesión no encontrada.' });
        }

        if (session.student_id !== reviewerId) {
            return res.status(403).json({ error: 'Solo el estudiante puede dejar reseña.' });
        }

        if (session.status !== 'completed') {
            return res.status(400).json({ error: 'Solo puedes reseñar sesiones completadas.' });
        }

        // Verificar que no haya reseña duplicada
        const { data: existingReview } = await supabase
            .from('reviews')
            .select('id')
            .eq('reviewer_id', reviewerId)
            .eq('reference_id', id)
            .single();

        if (existingReview) {
            return res.status(409).json({ error: 'Ya dejaste una reseña para esta sesión.' });
        }

        const tutorUserId = session.tutor_profiles?.user_id;

        // Insertar review
        const { data: review, error: insertError } = await supabase
            .from('reviews')
            .insert([{
                reviewer_id: reviewerId,
                reviewed_id: tutorUserId,
                service_type: 'tutoria',
                reference_id: id,
                rating: parseInt(rating),
                comment: comment || null,
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // Actualizar avg_rating del tutor
        const { data: allReviews } = await supabase
            .from('reviews')
            .select('rating')
            .eq('reviewed_id', tutorUserId)
            .eq('service_type', 'tutoria');

        if (allReviews && allReviews.length > 0) {
            const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
            await supabase
                .from('tutor_profiles')
                .update({ avg_rating: parseFloat(avgRating.toFixed(2)) })
                .eq('user_id', tutorUserId);
        }

        // Sumar rank_points al tutor por buena reseña
        let pointsAdded = 0;
        if (rating === 5) {
            pointsAdded = 10;
        } else if (rating >= 4) {
            pointsAdded = 5;
        }

        let promotion = null;
        if (pointsAdded > 0 && tutorUserId) {
            const { data: tutorUser } = await supabase
                .from('users')
                .select('rank_points')
                .eq('id', tutorUserId)
                .single();

            if (tutorUser) {
                await supabase
                    .from('users')
                    .update({ rank_points: (tutorUser.rank_points || 0) + pointsAdded })
                    .eq('id', tutorUserId);

                promotion = await checkPromotion(tutorUserId);
            }
        }

        res.status(201).json({
            message: 'Reseña creada exitosamente.',
            reviewId: review.id,
            rating,
            pointsAdded,
            promotion,
        });
    } catch (error) {
        console.error('Error en reviewSession:', error);
        res.status(500).json({ error: 'Error creando reseña.' });
    }
};

module.exports = {
    getTutors,
    getTutorDetail,
    createTutorProfile,
    bookSession,
    confirmPayment,
    completeSession,
    reviewSession,
};
