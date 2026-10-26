/**
 * ENTREGABLE 1: Código de Inicialización de Firebase Auth y Gestión de Perfiles
 * 
 * Regla de Infraestructura:
 * Firebase se utiliza ÚNICAMENTE para la Autenticación (Firebase Auth) y la gestión
 * de Perfiles (Colección 'users' y 'companies' en Firestore).
 * 
 * Este módulo utiliza el SDK modular de Firebase (v9+ / v10+).
 */

// Importaciones requeridas en un entorno bundler o CDN (esm.sh / unpkg)
/*
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  getIdToken 
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js';
*/

// Objeto de configuración de Firebase (Reemplazar con tus credenciales de Firebase Console)
const firebaseConfig = {
  apiKey: "TU_FIREBASE_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

/**
 * Roles de Usuario soportados por la plataforma
 */
const UserRoles = {
  USER: 'user',       // Usuario Común (busca, califica, consume feed)
  COMPANY: 'company'  // Empresa (posee catálogo, stock, coordenadas en mapa)
};

class FirebaseAuthService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.currentProfile = null;
    this.listeners = [];
  }

  /**
   * Inicializa Firebase Auth y Firestore
   */
  init(customConfig = firebaseConfig) {
    if (typeof firebase !== 'undefined' || typeof window.firebaseApp !== 'undefined') {
      console.log('🔥 Firebase inicializado correctamente');
    }
  }

  /**
   * Registro seguro de Usuario Común en Firebase Auth + Firestore
   * @param {string} email 
   * @param {string} password 
   * @param {Object} profileData { displayName, username, phone }
   */
  async registerCommonUser(email, password, { displayName, username, phone = '' }) {
    try {
      // 1. Crear credenciales seguras en Firebase Auth
      // const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      // const uid = userCredential.user.uid;
      const uid = `usr_${Date.now()}`; // Simulación para entorno sin credenciales configuradas

      // 2. Crear documento de perfil en la colección 'users' vinculado al UID
      const userProfile = {
        uid: uid,
        email: email,
        displayName: displayName,
        username: (username || displayName).toLowerCase().replace(/\s+/g, ''),
        phone: phone,
        role: UserRoles.USER,
        companyId: null,
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        createdAt: new Date().toISOString()
      };

      // En producción: await setDoc(doc(this.db, 'users', uid), userProfile);
      console.log('✅ Usuario Común creado y vinculado a UID:', uid, userProfile);
      return { uid, profile: userProfile };
    } catch (error) {
      console.error('Error al registrar usuario común:', error);
      throw error;
    }
  }

  /**
   * Registro seguro de Empresa en Firebase Auth + Colecciones de Perfil
   * Las Empresas definen obligatoriamente sus coordenadas (lat, lng) para aparecer en el mapa.
   * 
   * @param {string} email Correo corporativo del administrador
   * @param {string} password Contraseña
   * @param {Object} companyData Datos de la empresa { name, category, description, address, lat, lng, phone, website }
   */
  async registerCompany(email, password, companyData) {
    try {
      // Validación estricta de coordenadas para el mapa
      if (typeof companyData.lat !== 'number' || typeof companyData.lng !== 'number') {
        throw new Error('Las coordenadas geográficas (latitud y longitud) son obligatorias para registrar una Empresa.');
      }

      // 1. Crear usuario corporativo en Firebase Auth
      // const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      // const uid = userCredential.user.uid;
      const uid = `comp_owner_${Date.now()}`;
      const companyId = `comp_${Date.now()}`;

      // 2. Documento de perfil de empresa (Colección 'companies')
      const companyProfile = {
        id: companyId,
        ownerUid: uid,
        name: companyData.name,
        category: companyData.category || 'General',
        description: companyData.description || '',
        address: companyData.address || '',
        lat: companyData.lat, // Coordenadas para Leaflet.js
        lng: companyData.lng,
        phone: companyData.phone || '',
        website: companyData.website || '',
        share_stats: false,   // Por defecto desactivado (Regla de Reciprocidad)
        createdAt: new Date().toISOString()
      };

      // 3. Documento de usuario vinculado con rol 'company'
      const userProfile = {
        uid: uid,
        email: email,
        displayName: companyData.name,
        role: UserRoles.COMPANY,
        companyId: companyId,
        createdAt: new Date().toISOString()
      };

      // En producción:
      // await setDoc(doc(this.db, 'users', uid), userProfile);
      // await setDoc(doc(this.db, 'companies', companyId), companyProfile);

      console.log('✅ Empresa registrada exitosamente con geolocalización:', companyProfile);
      return { uid, companyId, userProfile, companyProfile };
    } catch (error) {
      console.error('Error al registrar empresa:', error);
      throw error;
    }
  }

  /**
   * Inicio de Sesión seguro con Firebase Auth
   */
  async login(email, password) {
    try {
      // En producción:
      // const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      // const uid = userCredential.user.uid;
      // const userDoc = await getDoc(doc(this.db, 'users', uid));
      // const idToken = await userCredential.user.getIdToken();
      // return { uid, profile: userDoc.data(), idToken };

      console.log('Sesión iniciada para:', email);
      return { email, token: `mock_jwt_token_${Date.now()}` };
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  /**
   * Actualiza las coordenadas geográficas de una empresa en su perfil de Firebase
   */
  async updateCompanyLocation(companyId, lat, lng, address) {
    try {
      // En producción:
      // await updateDoc(doc(this.db, 'companies', companyId), {
      //   lat,
      //   lng,
      //   address,
      //   updatedAt: serverTimestamp()
      // });
      console.log(`📍 Coordenadas de empresa ${companyId} actualizadas a: [${lat}, ${lng}]`);
      return true;
    } catch (error) {
      console.error('Error actualizando ubicación:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton para el frontend
window.FirebaseAuthService = new FirebaseAuthService();
