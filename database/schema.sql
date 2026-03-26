-- ━━ TABLA: users ━━
CREATE TABLE IF NOT EXISTS users (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 full_name TEXT NOT NULL,
 phone TEXT,
 avatar_url TEXT,
 cedula_url TEXT,
 is_verified BOOLEAN DEFAULT false,
 user_type TEXT DEFAULT 'external' CHECK(user_type IN ('utp_student','external')),
 rank TEXT DEFAULT 'nuevo' CHECK(rank IN ('nuevo','confiable','experto','pro')),
 rank_points INT DEFAULT 0,
 trust_score DECIMAL(3,2) DEFAULT 5.00,
 fcm_token TEXT,
 temp_otp TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden leer su propio perfil
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Los usuarios pueden actualizar solo sus propios datos
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- ━━ TABLA: tutor_profiles ━━ (solo usuarios UTP)
CREATE TABLE IF NOT EXISTS tutor_profiles (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 subjects TEXT[] NOT NULL,
 faculty TEXT,
 semester INT,
 price_hour INT NOT NULL CHECK(price_hour >= 10000),
 bio TEXT,
 modality TEXT DEFAULT 'presencial',
 avg_rating DECIMAL(3,2) DEFAULT 0,
 total_sessions INT DEFAULT 0,
 is_active BOOLEAN DEFAULT true,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ━━ TABLA: tutoring_sessions ━━
CREATE TABLE IF NOT EXISTS tutoring_sessions (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 tutor_id UUID REFERENCES tutor_profiles(id),
 student_id UUID REFERENCES users(id),
 subject TEXT NOT NULL,
 scheduled_at TIMESTAMPTZ NOT NULL,
 duration_hours DECIMAL(3,1) DEFAULT 1.0,
 total_amount INT NOT NULL,
 commission INT NOT NULL,
 tutor_payout INT NOT NULL,
 status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','active','completed','cancelled')),
 otp_code TEXT,
 modality TEXT,
 notes TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ━━ TABLA: tasks ━━ (mandados — capa local)
CREATE TABLE IF NOT EXISTS tasks (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 requester_id UUID REFERENCES users(id),
 provider_id UUID REFERENCES users(id),
 title TEXT NOT NULL,
 description TEXT,
 pickup_location TEXT NOT NULL,
 delivery_location TEXT NOT NULL,
 price INT NOT NULL CHECK(price >= 2000),
 commission INT,
 category TEXT DEFAULT 'otro' CHECK(category IN ('comida','documentos','suministros','otro')),
 status TEXT DEFAULT 'open' CHECK(status IN ('open','accepted','in_transit','delivered','completed','cancelled')),
 delivery_otp TEXT,
 evidence_url TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW(),
 expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '2 hours')
);

-- ━━ TABLA: pro_services ━━ (servicios profesionales — capa local)
CREATE TABLE IF NOT EXISTS pro_services (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 provider_id UUID REFERENCES users(id),
 category TEXT NOT NULL CHECK(category IN ('plomeria','electricidad','tv_electronica', 'cerrajeria','pintura','jardineria','limpieza','otro')),
 title TEXT NOT NULL,
 description TEXT,
 price_from INT NOT NULL,
 price_to INT,
 min_rank TEXT DEFAULT 'nuevo',
 avg_rating DECIMAL(3,2) DEFAULT 0,
 total_jobs INT DEFAULT 0,
 is_active BOOLEAN DEFAULT true,
 created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ━━ TABLA: reviews ━━
CREATE TABLE IF NOT EXISTS reviews (
 id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 reviewer_id UUID REFERENCES users(id),
 reviewed_id UUID REFERENCES users(id),
 service_type TEXT CHECK(service_type IN ('tutoria','mandado','servicio_pro')),
 reference_id UUID,
 rating INT CHECK(rating BETWEEN 1 AND 5),
 comment TEXT,
 created_at TIMESTAMPTZ DEFAULT NOW()
);
