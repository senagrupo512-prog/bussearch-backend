/**
 * Conector de Base de Datos Externa (PostgreSQL / MySQL en Host Gratuito)
 * 
 * Proveedores gratuitos recomendados (sin tarjeta de crédito):
 * 1. Neon.tech (PostgreSQL Serverless Gratuito - 0.5 GB de almacenamiento)
 * 2. Supabase (PostgreSQL Gratuito - 500 MB)
 * 3. TiDB Cloud (MySQL Serverless Gratuito - 5 GB)
 * 4. Aiven (PostgreSQL / MySQL Gratuito - 1 GB)
 * 
 * Configura tu URL en .env como:
 * DATABASE_URL="postgresql://usuario:password@ep-host.neon.tech/neondb?sslmode=require"
 */

require('dotenv').config();

class ExternalDatabase {
  constructor() {
    this.isConnected = false;
    this.client = null;
    this.provider = 'memory'; // 'postgres', 'mysql' o 'memory' (fallback)
  }

  async connect() {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      console.log('ℹ️ DATABASE_URL no configurada en .env. Usando base de datos en memoria para desarrollo local.');
      console.log('👉 Para conectar tu host gratuito (Neon / Supabase / TiDB), añade DATABASE_URL="tu_cadena" en .env');
      this.provider = 'memory';
      this.isConnected = true;
      return;
    }

    try {
      if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
        // Conexión PostgreSQL (Neon, Supabase, Aiven, Render)
        const { Pool } = require('pg');
        this.client = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false }
        });
        await this.client.query('SELECT NOW()');
        this.provider = 'postgres';
        this.isConnected = true;
        console.log('🐘 Conectado exitosamente a la base de datos PostgreSQL externa (Host Gratuito).');
        await this.initTables();
      } else if (dbUrl.startsWith('mysql://')) {
        // Conexión MySQL (TiDB Cloud, Clever Cloud, Aiven)
        const mysql = require('mysql2/promise');
        this.client = await mysql.createPool(dbUrl);
        await this.client.query('SELECT 1');
        this.provider = 'mysql';
        this.isConnected = true;
        console.log('🐬 Conectado exitosamente a la base de datos MySQL externa (Host Gratuito).');
        await this.initTables();
      }
    } catch (err) {
      console.warn('⚠️ No se pudo establecer conexión con DATABASE_URL:', err.message);
      console.warn('Fallback: Operando con el almacén en memoria para no interrumpir el servicio.');
      this.provider = 'memory';
      this.isConnected = true;
    }
  }

  async initTables() {
    if (this.provider === 'postgres') {
      await this.query(`
        CREATE TABLE IF NOT EXISTS users (
          uid VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          username VARCHAR(100),
          role VARCHAR(50) DEFAULT 'user',
          company_id VARCHAR(64),
          company_status VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS companies (
          id VARCHAR(64) PRIMARY KEY,
          owner_uid VARCHAR(128),
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          address VARCHAR(255),
          lat DECIMAL(10, 7) NOT NULL,
          lng DECIMAL(10, 7) NOT NULL,
          phone VARCHAR(50),
          website VARCHAR(255),
          share_stats BOOLEAN DEFAULT FALSE,
          status VARCHAR(20) DEFAULT 'approved',
          rejection_reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL DEFAULT 0,
          stock INT NOT NULL DEFAULT 0,
          avg_rating DECIMAL(3, 2) DEFAULT 0.00,
          rating_count INT DEFAULT 0,
          image_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS posts (
          id VARCHAR(64) PRIMARY KEY,
          author_uid VARCHAR(128) NOT NULL,
          author_name VARCHAR(255) NOT NULL,
          author_role VARCHAR(50) NOT NULL,
          author_company_id VARCHAR(64),
          author_avatar TEXT,
          content TEXT NOT NULL,
          tags JSON,
          likes_count INT DEFAULT 0,
          comments_count INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('✅ Tablas inicializadas en PostgreSQL externo.');
    }
  }

  async query(sqlText, params = []) {
    if (this.provider === 'postgres') {
      const res = await this.client.query(sqlText, params);
      return res.rows;
    } else if (this.provider === 'mysql') {
      const [rows] = await this.client.query(sqlText, params);
      return rows;
    }
    return null;
  }
}

module.exports = new ExternalDatabase();
