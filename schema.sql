-- ============================================================================
-- ESQUEMA DE BASE DE DATOS EXTERNA (HOSTING GRATUITO: NEON / SUPABASE / TIDB)
-- Compatible con PostgreSQL y MySQL (Dialecto estándar ANSI SQL)
-- ============================================================================

-- 1. TABLA DE EMPRESAS (Sincronizada con el UID de Firebase Auth)
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(64) PRIMARY KEY,
    firebase_uid VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    address VARCHAR(255),
    lat DECIMAL(10, 7) NOT NULL, -- Coordenadas obligatorias para Leaflet / flutter_map
    lng DECIMAL(10, 7) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    owner_email VARCHAR(255),
    share_stats BOOLEAN DEFAULT FALSE, -- REGLA DE RECIPROCIDAD (Módulo D)
    status VARCHAR(20) DEFAULT 'approved',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA DE PRODUCTOS E INVENTARIO EN TIEMPO REAL (Módulo C)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    company_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    stock INT NOT NULL DEFAULT 0, -- Stock en tiempo real
    avg_rating DECIMAL(3, 2) DEFAULT 0.00,
    rating_count INT DEFAULT 0,
    image_url TEXT, -- URL externa (Backblaze B2 / S3 / Servidor externo)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. TABLA DE CALIFICACIONES INDIVIDUALES DE PRODUCTOS (Módulo B)
-- Determina el algoritmo de popularidad del mapa
CREATE TABLE IF NOT EXISTS product_ratings (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL,
    company_id VARCHAR(64) NOT NULL,
    user_uid VARCHAR(128) NOT NULL, -- UID del usuario de Firebase Auth
    author_name VARCHAR(255),
    stars INT NOT NULL CHECK (stars >= 1 AND stars <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. TABLA DE PUBLICACIONES DEL FEED CORPORATIVO (Módulo C - Estilo LinkedIn)
CREATE TABLE IF NOT EXISTS posts (
    id VARCHAR(64) PRIMARY KEY,
    author_uid VARCHAR(128) NOT NULL, -- UID de Firebase Auth
    author_name VARCHAR(255) NOT NULL,
    author_role VARCHAR(50) NOT NULL, -- 'Empresa' o 'Usuario Común'
    author_company_id VARCHAR(64),
    author_avatar TEXT,
    content TEXT NOT NULL,
    tags JSON, -- Array de hashtags corporativos ['#Tecnología', '#Stock']
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABLA DE REACCIONES Y COMENTARIOS DEL FEED
CREATE TABLE IF NOT EXISTS post_comments (
    id VARCHAR(64) PRIMARY KEY,
    post_id VARCHAR(64) NOT NULL,
    user_uid VARCHAR(128) NOT NULL,
    author_name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 6. REGISTRO DE ARCHIVOS MULTIMEDIA EXTERNOS (Cero buckets de Firebase)
CREATE TABLE IF NOT EXISTS external_media_files (
    id VARCHAR(64) PRIMARY KEY,
    uploader_uid VARCHAR(128) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    file_url TEXT NOT NULL, -- URL de Backblaze B2, S3 o CDN externo
    storage_provider VARCHAR(50) DEFAULT 'backblaze_b2',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DATOS INICIALES SEMILLA (SEED DATA PARA PRUEBAS INMEDIATAS)
-- ============================================================================

INSERT INTO companies (id, firebase_uid, name, category, description, address, lat, lng, phone, website, owner_email, share_stats)
VALUES 
('comp_01', 'uid_tech_supply_01', 'TechSupply Norte', 'Tecnología e Informática', 'Distribuidor mayorista de hardware y periféricos.', 'Calle 100 # 15-20, Bogotá', 4.6865, -74.0538, '+57 310 987 6543', 'https://techsupply.example.com', 'contacto@techsupply.com', TRUE),
('comp_02', 'uid_cafe_gourmet_02', 'Café & Panadería Gourmet', 'Alimentos y Bebidas', 'Café de especialidad y desayunos ejecutivos.', 'Carrera 7 # 72-41, Bogotá', 4.6560, -74.0580, '+57 320 123 4567', 'https://cafegourmet.example.com', 'gerencia@cafegourmet.com', FALSE),
('comp_03', 'uid_ferreteria_03', 'Ferretería Central', 'Construcción y Ferretería', 'Herramientas industriales y materiales.', 'Avenida Caracas # 45-12, Bogotá', 4.6335, -74.0682, '+57 315 555 7890', 'https://ferreteriacentral.example.com', 'ventas@ferreteriacentral.com', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, company_id, name, category, price, stock, avg_rating, rating_count)
VALUES 
('p_01', 'comp_01', 'Monitor Gamer 27" 165Hz', 'Monitores', 280.00, 14, 4.9, 28),
('p_02', 'comp_01', 'Teclado Mecánico RGB Switch Red', 'Periféricos', 75.00, 32, 4.8, 45),
('p_03', 'comp_01', 'Mouse Ergonómico Inalámbrico', 'Periféricos', 45.00, 3, 4.7, 19),
('p_04', 'comp_02', 'Café Grano Especialidad Huila 500g', 'Bebidas', 12.00, 65, 4.2, 15),
('p_05', 'comp_02', 'Croissant Artesanal', 'Panadería', 3.50, 2, 3.9, 10),
('p_06', 'comp_03', 'Taladro Percutor Inalámbrico 20V', 'Herramientas', 110.00, 9, 4.6, 30)
ON CONFLICT (id) DO NOTHING;
