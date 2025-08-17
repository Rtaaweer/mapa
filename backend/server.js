const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Console logs para verificar configuración
console.log('Configurando Supabase...');
console.log('Supabase URL:', supabaseUrl ? 'Configurada' : 'No encontrada');
console.log('Supabase Key:', supabaseKey ? 'Configurada' : 'No encontrada');

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('Cliente de Supabase creado exitosamente');

// Middleware
app.use(cors());
app.use(express.json());
console.log('Middleware configurado (CORS y JSON)');

// Función para verificar conexión con Supabase
async function testSupabaseConnection() {
  try {
    console.log('Probando conexión con Supabase...');
    const { data, error } = await supabase
      .from('packages')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('Error al conectar con Supabase:', error.message);
    } else {
      console.log('Conexión con Supabase exitosa');
      console.log('Tablas accesibles');
    }
  } catch (err) {
    console.log('Error de conexión:', err.message);
  }
}

// ==================== RUTAS DE SALUD ====================
app.get('/api/health', (req, res) => {
  console.log('Endpoint /api/health consultado');
  res.json({ 
    message: 'Backend funcionando correctamente', 
    supabase: !!supabase,
    timestamp: new Date().toISOString()
  });
});

// ==================== RUTAS DE AUTENTICACIÓN ====================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Intento de login para usuario:', username);
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();
    
    if (error || !data) {
      console.log('Login fallido para:', username);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    
    console.log('Login exitoso para:', username, '- Rol:', data.role);
    res.json({
      user: {
        id: data.id,
        username: data.username,
        name: data.name,
        role: data.role,
        status: data.status
      }
    });
  } catch (error) {
    console.log('Error en login:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE REPARTIDORES ====================
app.post('/api/deliveries', async (req, res) => {
  try {
    console.log('Creando nuevo repartidor:', req.body);
    const { data, error } = await supabase
      .from('usuarios')
      .insert([req.body])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('Error creando repartidor:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/deliveries', async (req, res) => {
  try {
    console.log('Obteniendo lista de repartidores');
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('role', 'delivery')
      .neq('name', 'Ricardo Torres'); // Excluir específicamente al admin
    
    if (error) throw error;
    console.log(`✅ ${data.length} repartidores encontrados (excluyendo admin)`);
    res.json(data);
  } catch (error) {
    console.log('Error obteniendo repartidores:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/deliveries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Obteniendo repartidor:', id);
    
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .eq('role', 'delivery')
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.log('Error obteniendo repartidor:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/deliveries/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`Actualizando estado del repartidor ${id} a:`, status);
    
    const { data, error } = await supabase
      .from('usuarios')
      .update({ status })
      .eq('id', id)
      .eq('role', 'delivery')
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    console.log('Error actualizando estado:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE PAQUETES ====================
app.post('/api/packages', async (req, res) => {
  try {
    console.log('Creando nuevo paquete:', req.body);
    
    // Asegurar que el paquete tenga un estado inicial
    const packageData = {
      ...req.body,
      status: req.body.status || 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };
    
    const { data, error } = await supabase
      .from('packages')
      .insert([packageData])
      .select();
    
    if (error) throw error;
    console.log('Paquete creado exitosamente');
    res.status(201).json(data[0]);
  } catch (error) {
    console.log('Error creando paquete:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    console.log('Obteniendo lista de paquetes');
    
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios:delivery_person_id (*)
      `);
    
    if (error) throw error;
    console.log(`${data.length} paquetes encontrados`);
    res.json(data);
  } catch (error) {
    console.log('Error obteniendo paquetes:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Obteniendo paquete:', id);
    
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios:delivery_person_id (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.log('Error obteniendo paquete:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// En la sección de PUT /api/packages/:id/status (alrededor de la línea 250)
app.put('/api/packages/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    console.log(`Actualizando estado del paquete ${id} a:`, status);
    
    const { data, error } = await supabase
      .from('packages')
      .update({ 
        status,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.log('Error actualizando estado:', error.message);
      throw error;
    }
    
    console.log('Estado actualizado exitosamente');
    
    // Emitir evento de actualización de paquete a todos los admins conectados
    io.to('admin').emit('package-updated', data[0]);
    
    res.json(data[0]);
  } catch (error) {
    console.log('Error en PUT /api/packages/:id/status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// También en PUT /api/packages/:id (alrededor de la línea 280)
app.put('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Actualizando paquete:', id, req.body);
    
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };
    
    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.log('Error actualizando paquete:', error.message);
      throw error;
    }
    
    console.log('Paquete actualizado exitosamente');
    
    // Emitir evento de actualización de paquete a todos los admins conectados
    io.to('admin').emit('package-updated', data[0]);
    
    res.json(data[0]);
  } catch (error) {
    console.log('Error en PUT /api/packages/:id:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Y en PUT /api/packages/:id/assign (alrededor de la línea 304)
app.put('/api/packages/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { delivery_person_id } = req.body;
    
    console.log(`Asignando paquete ${id} al repartidor ${delivery_person_id}`);
    
    const { data, error } = await supabase
      .from('packages')
      .update({ 
        delivery_person_id,
        status: 'assigned',
        updated_at: new Date()
      })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    console.log('Paquete asignado exitosamente');
    
    // Emitir evento de actualización de paquete a todos los admins conectados
    io.to('admin').emit('package-updated', data[0]);
    
    res.json(data[0]);
  } catch (error) {
    console.log('Error en PUT /api/packages/:id/assign:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/packages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Eliminando paquete:', id);
    
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    console.log('Paquete eliminado exitosamente');
    res.json({ success: true });
  } catch (error) {
    console.log('Error eliminando paquete:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/packages/delivery/:deliveryId', async (req, res) => {
  try {
    const { deliveryId } = req.params;
    console.log('Obteniendo paquetes asignados al repartidor:', deliveryId);
    
    const { data, error } = await supabase
      .from('packages')
      .select('*')
      .eq('delivery_person_id', deliveryId);
    
    if (error) throw error;
    console.log(`${data.length} paquetes encontrados para el repartidor ${deliveryId}`);
    res.json(data);
  } catch (error) {
    console.log('Error obteniendo paquetes del repartidor:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RUTAS DE MAPA ====================
app.get('/api/map-data', async (req, res) => {
  try {
    console.log('Obteniendo datos del mapa');
    
    // Obtener paquetes con información del repartidor
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios:delivery_person_id (*)
      `);
    
    if (error) throw error;
    
    res.json({
      message: 'Datos del mapa (legacy)',
      packages: data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.log('Error en GET /api/map-data:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/locations', async (req, res) => {
  console.log('Endpoint legacy /api/locations redirigiendo a /api/packages');
  res.redirect('/api/packages');
});

// ==================== RUTAS DE UBICACIONES ====================
// Obtener las ubicaciones más recientes de todos los repartidores
app.get('/api/delivery-locations/latest', async (req, res) => {
  try {
    console.log('Obteniendo ubicaciones más recientes de repartidores...');
    
    // Obtener la ubicación más reciente de cada repartidor
    const { data, error } = await supabase
      .from('delivery_locations')
      .select(`
        delivery_person_id,
        location,
        timestamp,
        accuracy,
        speed
      `)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.log('Error obteniendo ubicaciones:', error.message);
      throw error;
    }
    
    // Filtrar para obtener solo la ubicación más reciente de cada repartidor
    const latestLocations = [];
    const seenDeliveries = new Set();
    
    for (const location of data) {
      if (!seenDeliveries.has(location.delivery_person_id)) {
        seenDeliveries.add(location.delivery_person_id);
        latestLocations.push(location);
      }
    }
    
    console.log(`Ubicaciones más recientes encontradas: ${latestLocations.length}`);
    res.json(latestLocations);
  } catch (error) {
    console.log('Error en GET /api/delivery-locations/latest:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de ubicaciones de un repartidor específico
app.get('/api/delivery-locations/:deliveryId', async (req, res) => {
  try {
    const { deliveryId } = req.params;
    console.log(`Obteniendo historial de ubicaciones para repartidor ${deliveryId}...`);
    
    const { data, error } = await supabase
      .from('delivery_locations')
      .select('*')
      .eq('delivery_person_id', deliveryId)
      .order('timestamp', { ascending: false })
      .limit(50); // Últimas 50 ubicaciones
    
    if (error) throw error;
    
    console.log(`Ubicaciones encontradas para repartidor ${deliveryId}: ${data.length}`);
    res.json(data);
  } catch (error) {
    console.log('Error en GET /api/delivery-locations/:deliveryId:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== CONFIGURACIÓN SOCKET.IO ====================
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"]
  }
});

// Socket.io para ubicaciones en tiempo real
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);
  
  // Unirse a sala de repartidor
  socket.on('join-delivery', (deliveryId) => {
    socket.join(`delivery-${deliveryId}`);
    console.log(`Repartidor ${deliveryId} conectado a sala`);
  });
  
  // Unirse a sala de admin
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('Admin conectado a sala');
  });
  
  // Recibir ubicación del repartidor
  socket.on('location-update', async (data) => {
    try {
        const { deliveryId, latitude, longitude, accuracy, speed, status, name } = data;
        console.log(`📍 Ubicación recibida del repartidor ${deliveryId} (${name}): ${latitude}, ${longitude}, estado: ${status || 'available'}`);
        
        // Filtrar ubicaciones del admin Ricardo Torres
        if (name === 'Ricardo Torres') {
            console.warn('🚫 Ubicación del admin filtrada en el servidor:', name);
            return;
        }
        
        // Validar datos requeridos
        if (!deliveryId || !latitude || !longitude) {
            console.error('❌ Datos de ubicación incompletos:', data);
            return;
        }
        
        // Crear objeto de actualización consistente
        const locationUpdate = {
            deliveryId,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            timestamp: data.timestamp || new Date(),
            accuracy: accuracy || null,
            speed: speed || null,
            status: status || 'available',
            name: name || `Repartidor #${deliveryId}`
        };
        
        // Guardar en base de datos usando PostGIS
        const { error } = await supabase
            .from('delivery_locations')
            .insert({
                delivery_person_id: deliveryId,
                location: `POINT(${locationUpdate.longitude} ${locationUpdate.latitude})`,
                accuracy: locationUpdate.accuracy,
                speed: locationUpdate.speed,
                timestamp: locationUpdate.timestamp
            });
        
        if (error) {
            console.error('❌ Error guardando ubicación en BD:', error.message);
            // Continuar enviando la actualización aunque falle la BD
        } else {
            console.log('✅ Ubicación guardada en BD exitosamente');
        }
        
        // Emitir evento a todos los clientes conectados
        io.emit('delivery-location-update', locationUpdate);
        console.log(`📡 Ubicación del repartidor ${deliveryId} enviada a todos los clientes`);
        
    } catch (error) {
        console.error('❌ Error procesando ubicación:', error);
    }
});

  // Manejar cambios de estado de repartidor
  socket.on('delivery-status-change', async (data) => {
    try {
      const { deliveryId, status } = data;
      console.log(`📡 Cambio de estado recibido: Repartidor ${deliveryId} -> ${status}`);
      
      // Actualizar estado en base de datos
      const { error } = await supabase
        .from('usuarios')
        .update({ status })
        .eq('id', deliveryId)
        .eq('role', 'delivery');
      
      if (error) {
        console.error('❌ Error actualizando estado en BD:', error.message);
        return;
      }
      
      // Emitir actualización a todos los clientes
      io.emit('delivery-status-update', { deliveryId, status, timestamp: Date.now() });
      console.log(`✅ Estado del repartidor ${deliveryId} actualizado y enviado a todos los clientes`);
      
    } catch (error) {
      console.error('❌ Error procesando cambio de estado:', error);
    }
  });
  
  // Manejar actualizaciones de paquetes
  socket.on('package-update', async (data) => {
    try {
      console.log('📦 Actualización de paquete recibida:', data);
      
      // Emitir actualización a todos los clientes
      io.emit('package-updated', data);
      console.log('✅ Actualización de paquete enviada a todos los clientes');
      
    } catch (error) {
      console.error('❌ Error procesando actualización de paquete:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

// Iniciar servidor
server.listen(port, '0.0.0.0', async () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
  await testSupabaseConnection();
});