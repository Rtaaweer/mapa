import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PackageService } from '../../services/package.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  private map: any;
  private deliveryPersons: any[] = [];
  private packages: any[] = [];
  private deliveryMarkers: Map<number, any> = new Map(); // Para trackear marcadores de deliveries
  private locationUpdateSubscription: Subscription | null = null;
  
  // Coordenadas exactas de la Universidad Tecnológica de Querétaro (UTEQ)
  private readonly UTEQ_LAT = 20.65636;
  private readonly UTEQ_LNG = -100.40507;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private packageService: PackageService,
    private socketService: SocketService 
  ) { }

  ngOnInit(): void {
    console.log('🗺️ Inicializando MapComponent...');
    
    // Solo conectar como admin si NO está siendo controlado por AdminComponent
    if (!this.isControlledByParent()) {
      this.socketService.joinAsAdmin();
      this.setupLocationUpdates();
    } else {
      console.log('🗺️ MapComponent controlado por AdminComponent, no configurando actualizaciones propias');
    }
    
    this.loadData();
    
    // Configurar actualización periódica de datos cada 30 segundos
    setInterval(() => {
      this.loadData();
    }, 30000);
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initMap();
    }
  }

  // Cambiar de private a public
  public updateDeliveryMarkerRealTime(locationData: any): void {
    if (!this.map) {
      console.warn('🗺️ Mapa no inicializado, no se puede actualizar marcador');
      return;
    }
    
    // Validar datos de entrada
    const { deliveryId, latitude, longitude, timestamp, status, name, accuracy, speed } = locationData;
    
    if (!deliveryId || !latitude || !longitude) {
      console.error('🗺️ Datos de ubicación incompletos:', locationData);
      return;
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    console.log(`🗺️ Actualizando marcador para delivery ${deliveryId} (${name}) en ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    
    // Determinar el estado del repartidor
    const isAvailable = status === 'available';
    const statusColor = isAvailable ? 'green' : 'red';
    const statusText = isAvailable ? 'Disponible' : 'Ocupado';
    
    // Si ya existe un marcador para este delivery, actualizarlo
    if (this.deliveryMarkers.has(deliveryId)) {
      const marker = this.deliveryMarkers.get(deliveryId);
      const newLatLng = [lat, lng];
      marker.setLatLng(newLatLng);
      
      // Solo centrar el mapa si es la vista del delivery (no en admin)
      // Detectar si es vista de delivery por el número de marcadores
      if (this.deliveryMarkers.size === 1) {
        this.map.setView(newLatLng, Math.max(this.map.getZoom(), 15));
        console.log(`🗺️ Mapa centrado en nueva ubicación del delivery ${deliveryId}`);
      }
      
      // Actualizar popup con información completa
      const popupContent = `
        <div style="text-align: center; min-width: 200px;">
          <h4>🚗 ${name || `Repartidor #${deliveryId}`}</h4>
          <p><strong>Estado:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
          <p><strong>Última actualización:</strong><br>${new Date(timestamp).toLocaleString()}</p>
          <p><strong>Ubicación:</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
          ${accuracy ? `<p><strong>Precisión:</strong> ${Math.round(accuracy)}m</p>` : ''}
          ${speed ? `<p><strong>Velocidad:</strong> ${Math.round(speed)} km/h</p>` : ''}
        </div>
      `;
      
      marker.setPopupContent(popupContent);
      
      console.log(`✅ Marcador actualizado para delivery ${deliveryId}`);
    } else {
      // Crear nuevo marcador si no existe
      console.log(`🗺️ Creando nuevo marcador para delivery ${deliveryId}`);
      this.createRealtimeDeliveryMarker(deliveryId, lat, lng, timestamp, status, name, accuracy, speed);
    }
  }

  private async createRealtimeDeliveryMarker(
    deliveryId: number, 
    lat: number, 
    lng: number, 
    timestamp: string | number, 
    status: string = 'available',
    name?: string,
    accuracy?: number,
    speed?: number
  ): Promise<void> {
    const L = await import('leaflet');
    
    // Determinar el estado del repartidor
    const isAvailable = status === 'available';
    const statusColor = isAvailable ? 'green' : 'red';
    const statusText = isAvailable ? 'Disponible' : 'Ocupado';
    
    const carIcon = L.icon({
      iconUrl: '/coche.png',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20]
    });

    const popupContent = `
      <div style="text-align: center; min-width: 200px;">
        <h4>🚗 ${name || `Repartidor #${deliveryId}`}</h4>
        <p><strong>Estado:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
        <p><strong>Última actualización:</strong><br>${new Date(timestamp).toLocaleString()}</p>
        <p><strong>Ubicación:</strong><br>${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        ${accuracy ? `<p><strong>Precisión:</strong> ${Math.round(accuracy)}m</p>` : ''}
        ${speed ? `<p><strong>Velocidad:</strong> ${Math.round(speed)} km/h</p>` : ''}
      </div>
    `;

    const marker = L.marker([lat, lng], { icon: carIcon })
      .addTo(this.map)
      .bindPopup(popupContent);

    this.deliveryMarkers.set(deliveryId, marker);
    
    // Actualizar el estado del repartidor en la lista local
    this.updateDeliveryStatus(deliveryId, status);
    
    console.log(`🗺️ Marcador creado para delivery ${deliveryId}`);
  }

  private loadData(): void {
    // Cargar repartidores
    this.packageService.getDeliveries().subscribe({
      next: (deliveries) => {
        // Filtrar solo repartidores (no admins) por seguridad adicional
        this.deliveryPersons = deliveries.filter(delivery => 
          delivery.role === 'delivery' && delivery.name !== 'Ricardo Torres'
        );
        console.log('🚚 Repartidores cargados (filtrados):', this.deliveryPersons);
        console.log('📊 Total de repartidores válidos:', this.deliveryPersons.length);
        
        // Log de depuración para verificar que no hay admins
        deliveries.forEach(delivery => {
          if (delivery.role !== 'delivery' || delivery.name === 'Ricardo Torres') {
            console.warn('⚠️ Usuario admin/inválido filtrado:', delivery.name, delivery.role);
          }
        });
        
        // NO crear marcadores iniciales - solo esperar ubicaciones en tiempo real
        console.log('🚫 Marcadores iniciales deshabilitados - usando solo ubicaciones en tiempo real');
      },
      error: (error) => {
        console.error('Error cargando repartidores:', error);
      }
    });

    // Cargar paquetes
    this.packageService.getPackages().subscribe({
      next: (packages) => {
        this.packages = packages;
        console.log('Paquetes cargados:', this.packages);
        if (this.map) {
          this.addPackagesToMap();
        }
      },
      error: (error) => {
        console.error('Error cargando paquetes:', error);
      }
    });
  }

  private async initMap(): Promise<void> {
    // Importar Leaflet dinámicamente solo en el navegador
    const L = await import('leaflet');
    
    // Configurar los iconos por defecto de Leaflet
    const iconRetinaUrl = 'assets/marker-icon-2x.png';
    const iconUrl = 'assets/marker-icon.png';
    const shadowUrl = 'assets/marker-shadow.png';
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Inicializar el mapa centrado en las coordenadas exactas de la UTEQ
    this.map = L.map('map').setView([this.UTEQ_LAT, this.UTEQ_LNG], 15); // Aumenté el zoom a 15 para mejor detalle

    // Agregar capa de tiles (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Agregar marcador exacto de la Universidad Tecnológica de Querétaro
    L.marker([this.UTEQ_LAT, this.UTEQ_LNG])
      .addTo(this.map)
      .bindPopup(`
        <div style="text-align: center;">
          <h4>Universidad Tecnológica de Querétaro (UTEQ)</h4>
          
        </div>
      `)
      .openPopup();

    // Agregar repartidores y paquetes si ya están cargados
    if (this.deliveryPersons.length > 0) {
      this.addDeliveryPersonsToMap();
    }
    if (this.packages.length > 0) {
      this.addPackagesToMap();
    }
  }

  private async addDeliveryPersonsToMap(): Promise<void> {
    // MÉTODO DESHABILITADO - Los marcadores se crean solo con ubicaciones reales
    console.log('🚫 addDeliveryPersonsToMap deshabilitado - usando solo ubicaciones en tiempo real');
    return;
  }

  private async addPackagesToMap(): Promise<void> {
    if (!this.map) return;

    const L = await import('leaflet');

    // Crear icono para paquetes
    const packageIcon = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowUrl: 'assets/marker-shadow.png',
      shadowSize: [41, 41]
    });

    // Agregar cada paquete al mapa cerca de la UTEQ
    this.packages.forEach(pkg => {
      // Generar posición aleatoria para el paquete cerca de la UTEQ
      const randomLat = this.UTEQ_LAT + (Math.random() - 0.5) * 0.05; // Radio más amplio para paquetes
      const randomLng = this.UTEQ_LNG + (Math.random() - 0.5) * 0.05;

      // Determinar color del marcador según el estado
      let statusColor = '#007bff'; // azul por defecto
      switch(pkg.status) {
        case 'pending': statusColor = '#ffc107'; break; // amarillo
        case 'in_transit': statusColor = '#17a2b8'; break; // azul claro
        case 'delivered': statusColor = '#28a745'; break; // verde
        case 'cancelled': statusColor = '#dc3545'; break; // rojo
      }

      L.marker([randomLat, randomLng], { icon: packageIcon })
        .addTo(this.map)
        .bindPopup(`
          <div style="text-align: center;">
            <h4>📦 Paquete #${pkg.id}</h4>
            <p><strong>Destinatario:</strong> ${pkg.recipient}</p>
            <p><strong>Dirección:</strong> ${pkg.address}</p>
            <p><strong>Repartidor:</strong> ${pkg.delivery_person_name || 'No asignado'}</p>
            <p><strong>Estado:</strong> <span style="color: ${statusColor}; font-weight: bold;">${pkg.status}</span></p>
            <p><strong>Zona:</strong> Querétaro</p>
            <p><strong>Fecha:</strong> ${new Date(pkg.created_at).toLocaleDateString()}</p>
          </div>
        `);
    });
  }

  // Método público para recargar datos (puede ser llamado desde el componente padre)
  public refreshMapData(): void {
    this.loadData();
  }
  
  // Método para actualizar el estado de un repartidor en la lista local
  private updateDeliveryStatus(deliveryId: number, status: string): void {
    // Buscar el repartidor en la lista local
    const deliveryIndex = this.deliveryPersons.findIndex(d => d.id === deliveryId);
    
    if (deliveryIndex !== -1) {
      // Actualizar el estado del repartidor
      this.deliveryPersons[deliveryIndex].status = status;
      console.log(`Estado del repartidor #${deliveryId} actualizado a: ${status}`);
    }
  }
  
  private setupLocationUpdates(): void {
    // Limpiar suscripción anterior si existe
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
    
    console.log('👂 Suscribiéndose a actualizaciones de ubicación en MapComponent');
    this.locationUpdateSubscription = this.socketService.onLocationUpdate().subscribe({
      next: (locationData) => {
        console.log('🗺️ MapComponent recibió ubicación:', {
          id: locationData.deliveryId,
          name: locationData.name,
          lat: locationData.latitude?.toFixed(6),
          lng: locationData.longitude?.toFixed(6)
        });
        this.updateDeliveryMarkerRealTime(locationData);
      },
      error: (error) => {
        console.error('❌ Error en suscripción de ubicación del mapa:', error);
      }
    });
  }
  
  private isControlledByParent(): boolean {
    // Verificar si el mapa está siendo usado dentro de AdminComponent
    // En ese caso, el AdminComponent maneja las ubicaciones centralmente
    return window.location.pathname.includes('/admin');
  }

  ngOnDestroy(): void {
    console.log('🧹 Limpiando MapComponent...');
    
    // Limpiar suscripción
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
      this.locationUpdateSubscription = null;
    }
    
    // Limpiar marcadores
    this.deliveryMarkers.clear();
  }
}