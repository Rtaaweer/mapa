import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, NgZone, Injector, ViewChild } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PackageService } from '../../services/package.service';
import { AuthService } from '../../services/auth.service';
import { SocketService } from '../../services/socket.service';
import { MapComponent } from '../map/map.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-delivery-view',
  standalone: true,
  imports: [CommonModule, FormsModule, MapComponent],
  templateUrl: './delivery-view.component.html',
  styleUrls: ['./delivery-view.component.css']
})
export class DeliveryViewComponent implements OnInit, OnDestroy {
  private deliveryPersonId: number = 0;
  private locationInterval: any;
  private currentUser: any;
  private locationUpdateSubscription: Subscription | null = null;
  
  @ViewChild(MapComponent) mapComponent!: MapComponent;
  
  private readonly UTEQ_LAT = 20.65636;
  private readonly UTEQ_LNG = -100.40507;
  
  // Variables para movimiento aleatorio
  private currentSimulatedLat: number = this.UTEQ_LAT;
  private currentSimulatedLng: number = this.UTEQ_LNG;
  public useRealLocation: boolean = false;
  
  public deliveryPerson: any = {};
  public assignedPackages: any[] = [];
  public isAvailable: boolean = true;
  public currentLocation = { lat: this.UTEQ_LAT, lng: this.UTEQ_LNG };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private packageService: PackageService,
    private authService: AuthService,
    private socketService: SocketService,
    private router: Router,
    private injector: Injector
  ) { }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.deliveryPersonId = user.id;
        this.deliveryPerson = user;
        this.currentUser = user;
        
        this.isAvailable = user.status === 'available';
        this.socketService.joinAsDelivery(user.id);
        
        this.loadDeliveryPersonData();
        this.loadAssignedPackages();
        this.startLocationTracking();

        // Suscribirse a actualizaciones de ubicación
        this.setupLocationUpdates();
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  private async startLocationTracking(): Promise<void> {
    if (!this.currentUser) {
      console.warn('Usuario no autenticado');
      return;
    }
    
    const ngZone = this.injector.get(NgZone);
    
    // Primera ubicación inmediata
    this.simulateLocation();
    
    ngZone.runOutsideAngular(() => {
      if (this.locationInterval) {
        clearInterval(this.locationInterval);
      }
      
      this.locationInterval = setInterval(() => {
        ngZone.run(() => {
          this.simulateLocation();
        });
      }, 10000); // Cambiar a 10 segundos
    });
  }

  private simulateLocation(): void {
    if (!this.currentUser) return;
    
    // Si está en modo GPS real, intentar obtener ubicación real
    if (this.useRealLocation && isPlatformBrowser(this.platformId) && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Usar ubicación real del GPS
          this.currentSimulatedLat = position.coords.latitude;
          this.currentSimulatedLng = position.coords.longitude;
          
          const locationData = {
            deliveryId: this.currentUser.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed || 0,
            timestamp: Date.now(),
            status: this.isAvailable ? 'available' : 'busy',
            name: this.currentUser.name
          };
          
          this.sendLocationUpdate(locationData);
        },
        (error) => {
          console.warn('Error obteniendo ubicación GPS, cambiando a modo simulado:', error.message);
          // Cambiar automáticamente a modo simulado si falla el GPS
          this.useRealLocation = false;
          this.sendSimulatedLocation();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      // Usar ubicación simulada
      this.sendSimulatedLocation();
    }
  }
  
  private sendSimulatedLocation(): void {
    // Si no se ha inicializado la ubicación simulada, usar offset inicial basado en ID
    if (this.currentSimulatedLat === this.UTEQ_LAT && this.currentSimulatedLng === this.UTEQ_LNG) {
      const offsetMultiplier = (this.currentUser.id % 4) + 1;
      this.currentSimulatedLat = this.UTEQ_LAT + (0.005 * offsetMultiplier);
      this.currentSimulatedLng = this.UTEQ_LNG + (0.005 * offsetMultiplier);
    }
    
    // Solo simular movimiento si el repartidor está disponible
    if (this.isAvailable) {
      // Generar movimiento aleatorio pequeño (aproximadamente 50-200 metros)
      const latChange = (Math.random() - 0.5) * 0.002; // ~±100m
      const lngChange = (Math.random() - 0.5) * 0.002; // ~±100m
      
      this.currentSimulatedLat += latChange;
      this.currentSimulatedLng += lngChange;
      
      // Mantener dentro de un radio razonable de UTEQ (aproximadamente 2km)
      const maxDistance = 0.02;
      const latDiff = this.currentSimulatedLat - this.UTEQ_LAT;
      const lngDiff = this.currentSimulatedLng - this.UTEQ_LNG;
      
      if (Math.abs(latDiff) > maxDistance) {
        this.currentSimulatedLat = this.UTEQ_LAT + (latDiff > 0 ? maxDistance : -maxDistance);
      }
      if (Math.abs(lngDiff) > maxDistance) {
        this.currentSimulatedLng = this.UTEQ_LNG + (lngDiff > 0 ? maxDistance : -maxDistance);
      }
    }
    
    const locationData = {
      deliveryId: this.currentUser.id,
      latitude: this.currentSimulatedLat,
      longitude: this.currentSimulatedLng,
      accuracy: 10,
      speed: this.isAvailable ? Math.random() * 30 + 10 : 0, // Velocidad aleatoria 10-40 km/h cuando disponible
      timestamp: Date.now(),
      status: this.isAvailable ? 'available' : 'busy',
      name: this.currentUser.name
    };
    
    this.sendLocationUpdate(locationData);
  }
  
  private sendLocationUpdate(locationData: any): void {
    // Filtrar ubicaciones del admin
    if (this.currentUser && (this.currentUser.name === 'Ricardo Torres' || this.currentUser.role === 'admin')) {
      console.warn('🚫 Admin no debe enviar ubicaciones:', this.currentUser.name);
      return;
    }
    
    // Actualizar ubicación local para referencia
    this.currentLocation = {
      lat: locationData.latitude,
      lng: locationData.longitude
    };
    
    // NO actualizar el mapa local directamente - dejar que el socket maneje toda la sincronización
    // Esto evita inconsistencias entre mapas
    
    // Enviar por Socket.io para sincronizar con todos los clientes
    console.log('🚗 Enviando ubicación del delivery:', locationData);
    this.socketService.sendLocationUpdate(locationData);
  }

  public getCurrentLocation(): void {
    if (!this.currentUser) {
      console.warn('No hay usuario autenticado para enviar ubicación');
      return;
    }
    this.simulateLocation();
  }
  
  public useRealGPSLocation(): void {
    if (!isPlatformBrowser(this.platformId)) {
      console.warn('Geolocalización no disponible en el servidor');
      return;
    }

    if (!navigator.geolocation) {
      console.error('Geolocalización no soportada por el navegador');
      alert('Tu navegador no soporta geolocalización');
      return;
    }

    console.log('🌍 Solicitando permisos de geolocalización...');
    
    // Verificar permisos primero
    if ('permissions' in navigator) {
      navigator.permissions.query({name: 'geolocation'}).then((result) => {
        console.log('Estado de permisos de geolocalización:', result.state);
        
        if (result.state === 'denied') {
          alert('Los permisos de geolocalización están denegados. Por favor, habilítalos en la configuración del navegador.');
          return;
        }
        
        this.requestLocation();
      }).catch((error) => {
        console.error('Error verificando permisos:', error);
        this.requestLocation(); // Intentar de todas formas
      });
    } else {
      this.requestLocation();
    }
  }

  private requestLocation(): void {
    console.log('📍 Obteniendo ubicación GPS...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('✅ Ubicación GPS obtenida:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        
        this.useRealLocation = true;
        this.currentSimulatedLat = position.coords.latitude;
        this.currentSimulatedLng = position.coords.longitude;
        
        // Enviar ubicación inmediatamente
        const locationData = {
          deliveryId: this.currentUser.id,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed || 0,
          timestamp: Date.now(),
          status: this.isAvailable ? 'available' : 'busy',
          name: this.currentUser.name
        };
        
        this.sendLocationUpdate(locationData);
        alert(`✅ Ubicación GPS activada: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}\n\nPrecisión: ${Math.round(position.coords.accuracy)}m`);
      },
      (error) => {
        console.error('❌ Error obteniendo ubicación GPS:', error);
        let errorMessage = 'Error desconocido';
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permisos de geolocalización denegados. Habilítalos en la configuración del navegador.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Información de ubicación no disponible.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Tiempo de espera agotado para obtener la ubicación.';
            break;
        }
        
        alert(`❌ Error GPS: ${errorMessage}\n\nUsando ubicación simulada.`);
        this.useRealLocation = false;
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000
      }
    );
  }
  
  public toggleLocationMode(): void {
    this.useRealLocation = !this.useRealLocation;
    console.log(`🔄 Modo cambiado a: ${this.useRealLocation ? 'GPS Real' : 'Simulado'}`);
    
    if (!this.useRealLocation) {
      // Al volver a modo simulado, mantener la última ubicación conocida
      console.log('🎲 Volviendo a modo simulado desde ubicación actual');
    }
  }

  private loadDeliveryPersonData(): void {
    this.packageService.getDeliveries().subscribe({
      next: (deliveries: any[]) => {
        const currentDelivery = deliveries.find(d => d.id === this.deliveryPersonId);
        if (currentDelivery) {
          this.deliveryPerson = currentDelivery;
          this.isAvailable = currentDelivery.status === 'available';
        }
      },
      error: (error: any) => {
        console.error('Error cargando datos del repartidor:', error);
      }
    });
  }

  private loadAssignedPackages(): void {
    if (!this.deliveryPersonId) {
      console.warn('⚠️ No hay deliveryPersonId para cargar paquetes');
      return;
    }

    console.log(`🔍 Cargando paquetes asignados para repartidor ${this.deliveryPersonId}`);
    
    this.packageService.getPackagesByDelivery(this.deliveryPersonId).subscribe({
      next: (packages) => {
        this.assignedPackages = packages || [];
        console.log(`📦 ${this.assignedPackages.length} paquetes asignados encontrados:`, this.assignedPackages);
        
        // Forzar detección de cambios
        if (this.assignedPackages.length === 0) {
          console.log('ℹ️ No hay paquetes asignados actualmente');
        }
      },
      error: (error) => {
        console.error('❌ Error cargando paquetes asignados:', error);
        this.assignedPackages = [];
      }
    });
  }

  // Agregar método para refrescar paquetes automáticamente
  public refreshAssignedPackages(): void {
    console.log('🔄 Refrescando paquetes asignados...');
    this.loadAssignedPackages();
  }

  public toggleAvailability(): void {
    this.isAvailable = !this.isAvailable;
    const newStatus = this.isAvailable ? 'available' : 'busy';
    
    // Actualizar estado en el backend
    this.packageService.updateDeliveryStatus(this.currentUser.id, newStatus)
      .subscribe({
        next: (response) => {
          console.log('Estado actualizado:', response);
          
          // Enviar cambio de estado por socket para auto-refresh
          this.socketService.sendStatusUpdate(this.currentUser.id, newStatus);
          
          // Enviar ubicación actualizada inmediatamente
          this.simulateLocation();
        },
        error: (error) => {
          console.error('Error actualizando estado:', error);
          // Revertir el cambio si hay error
          this.isAvailable = !this.isAvailable;
        }
      });
  }

  public refreshData(): void {
    this.loadDeliveryPersonData();
    this.loadAssignedPackages();
  }

  public logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private setupLocationUpdates(): void {
    // Limpiar suscripción anterior si existe
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
    
    console.log('👂 Suscribiéndose a actualizaciones de ubicación en DeliveryViewComponent');
    this.locationUpdateSubscription = this.socketService.onLocationUpdate().subscribe({
      next: (locationData) => {
        // Solo procesar ubicaciones de otros repartidores para mostrar en el mapa
        // No procesar la propia ubicación para evitar bucles
        if (locationData.deliveryId !== this.deliveryPersonId) {
          console.log('🚗 DeliveryView recibió ubicación de otro repartidor:', locationData.deliveryId);
          if (this.mapComponent) {
            this.mapComponent.updateDeliveryMarkerRealTime(locationData);
          }
        } else {
          console.log('🔄 Ignorando propia ubicación para evitar bucles');
        }
      },
      error: (error) => {
        console.error('❌ Error en suscripción de ubicación del delivery:', error);
      }
    });
  }
  
  ngOnDestroy(): void {
    console.log('🧹 Limpiando DeliveryViewComponent...');
    
    // Limpiar suscripción
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
      this.locationUpdateSubscription = null;
    }
    
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }
  }
}