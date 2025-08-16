import { Component, OnInit, OnDestroy, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';
import { PackageService } from '../../services/package.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-delivery-status-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="delivery-grid">
      <h3> Estado de Repartidores</h3>
      <div class="grid-container">
        <table class="status-table">
          <thead>
            <tr>
              <th>Repartidor</th>
              <th>Estado</th>
              <th>Ubicación Actual</th>
              <th>Última Actualización</th>
              <th>Paquetes Asignados</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let delivery of deliveryStatuses">
              <td>
                <div class="delivery-info">
                  <strong>{{delivery.name}}</strong>
                  <small>ID: {{delivery.id}}</small>
                </div>
              </td>
              <td>
                <span [class]="getStatusClass(delivery.status)">
                  {{getStatusText(delivery.status)}}
                </span>
              </td>
              <td class="location-cell">
                <div *ngIf="delivery.currentLocation; else noLocation">
                  <small>{{delivery.currentLocation.lat?.toFixed(4)}}, {{delivery.currentLocation.lng?.toFixed(4)}}</small>
                </div>
                <ng-template #noLocation>
                  <span class="no-location">Sin ubicación</span>
                </ng-template>
              </td>
              <td>
                <span *ngIf="delivery.lastUpdate; else noUpdate">
                  {{delivery.lastUpdate | date:'short'}}
                </span>
                <ng-template #noUpdate>
                  <span class="no-update">Nunca</span>
                </ng-template>
              </td>
              <td class="packages-count">
                <span class="badge">{{delivery.assignedPackages || 0}}</span>
              </td>
              <td>
                <button 
                  (click)="showAssignModal(delivery.id, delivery.name)" 
                  class="btn-assign"
                  [disabled]="delivery.status !== 'working'">
                  Asignar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div *ngIf="deliveryStatuses.length === 0" class="no-deliveries">
          <p>No hay repartidores registrados</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .delivery-grid {
      margin: 20px 0;
      background: #222222;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .grid-container {
      overflow-x: auto;
    }
    
    .status-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      color: #cccccc;
    }
    
    .status-table th,
    .status-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #333333;
    }
    
    .status-table th {
      background-color: #2a2a2a;
      font-weight: bold;
      color: #ff8c00;
    }
    
    .status-table tr:hover {
      background-color: #2a2a2a;
    }
    
    .delivery-info strong {
      display: block;
      color: #ff8c00;
    }
    
    .delivery-info small {
      color: #999999;
      font-size: 0.8em;
    }
    
    .status-working {
      background-color: #2e7d32;
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .status-off {
      background-color: #c62828;
      color: #ffffff;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .location-cell small {
      font-family: monospace;
      background: #333333;
      color: #cccccc;
      padding: 2px 4px;
      border-radius: 3px;
    }
    
    .no-location, .no-update {
      color: #999999;
      font-style: italic;
    }
    
    .packages-count .badge {
      background-color: #ff8c00;
      color: white;
      padding: 4px 8px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: bold;
    }
    
    .btn-assign {
      background: linear-gradient(90deg, #ff6b00, #ff9500);
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.3s ease;
    }
    
    .btn-assign:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(255, 107, 0, 0.3);
    }
    
    .btn-assign:disabled {
      background-color: #444444;
      cursor: not-allowed;
    }
    
    .no-deliveries {
      text-align: center;
      padding: 40px;
      color: #999999;
      font-style: italic;
      background: #2a2a2a;
      border-radius: 8px;
    }
  `]
})
export class DeliveryStatusGridComponent implements OnInit, OnDestroy {
  @Output() assignPackages = new EventEmitter<{deliveryId: number, deliveryName: string}>();
  
  deliveryStatuses: any[] = [];
  private locationUpdateSubscription: Subscription | null = null;
  private statusUpdateSubscription: Subscription | null = null;

  constructor(
    private socketService: SocketService,
    private packageService: PackageService,
    private cdr: ChangeDetectorRef  // ✅ ASEGÚRATE de tener esto
  ) {}

  ngOnInit(): void {
    console.log('🚀 Inicializando DeliveryStatusGridComponent...');
    
    // Unirse al room de admin para recibir actualizaciones
    this.socketService.joinAsAdmin();
    
    this.loadDeliveryStatuses();
    this.listenToLocationUpdates();
    this.setupStatusUpdates();
    
    console.log('✅ DeliveryStatusGridComponent inicializado');
  }

  private loadDeliveryStatuses(): void {
    console.log('🔄 Cargando estado de repartidores...');
    
    this.packageService.getDeliveries().subscribe({
      next: (deliveries: any[]) => {
        console.log('🚚 Repartidores cargados desde API:', deliveries.length, 'repartidores');
        console.log('🔍 IDs de repartidores:', deliveries.map(d => `${d.id}:${d.name}`));
        
        // Evitar duplicados usando Map
        const deliveryMap = new Map();
        deliveries.forEach(delivery => {
          if (!deliveryMap.has(delivery.id)) {
            deliveryMap.set(delivery.id, {
              ...delivery,
              status: delivery.status || 'available',
              currentLocation: null,
              lastUpdate: null,
              assignedPackages: 0
            });
          }
        });
        
        this.deliveryStatuses = Array.from(deliveryMap.values());
        console.log('✅ Repartidores únicos procesados:', this.deliveryStatuses.length);
        
        this.loadPackageCounts();
        this.loadInitialLocations();
      },
      error: (error: any) => {
        console.error('❌ Error cargando deliveries:', error);
      }
    });
  }

  // ✅ AGREGAR ESTE MÉTODO NUEVO
  private loadInitialLocations(): void {
    this.packageService.getLatestDeliveryLocations().subscribe({
      next: (locations: any[]) => {
        console.log('📍 Ubicaciones iniciales cargadas:', locations);
        
        locations.forEach((location: any) => {
          const deliveryIndex = this.deliveryStatuses.findIndex(
            delivery => delivery.id === location.delivery_person_id
          );
          
          if (deliveryIndex >= 0) {
            // Extraer coordenadas del campo geometry de PostGIS
            let lat, lng;
            if (location.location && location.location.coordinates) {
              // PostGIS devuelve [lng, lat] en el array coordinates
              lng = location.location.coordinates[0];
              lat = location.location.coordinates[1];
            }
            
            this.deliveryStatuses[deliveryIndex] = {
              ...this.deliveryStatuses[deliveryIndex],
              currentLocation: lat && lng ? { lat, lng } : null,
              lastUpdate: location.timestamp ? new Date(location.timestamp) : null
            };
          }
        });
        
        this.cdr.detectChanges();
        console.log('✅ Ubicaciones iniciales aplicadas');
      },
      error: (error: any) => {
        console.error('❌ Error cargando ubicaciones iniciales:', error);
      }
    });
  }

  private loadPackageCounts(): void {
    this.packageService.getPackages().subscribe({
      next: (packages: any[]) => {
        this.deliveryStatuses.forEach((delivery: any) => {
          delivery.assignedPackages = packages.filter(
            (pkg: any) => pkg.delivery_person_id === delivery.id && pkg.status !== 'delivered'
          ).length;
        });
      },
      error: (error: any) => {
        console.error('Error cargando packages:', error);
      }
    });
  }

  private listenToLocationUpdates(): void {
    // Limpiar suscripción anterior si existe
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
    
    console.log('👂 Suscribiéndose a actualizaciones de ubicación en DeliveryStatusGrid');
    this.locationUpdateSubscription = this.socketService.onLocationUpdate().subscribe({
      next: (locationData) => {
        console.log('📍 DeliveryStatusGrid recibió actualización:', locationData.deliveryId);
        this.updateDeliveryStatus(locationData);
      },
      error: (error) => {
        console.error('❌ Error en suscripción de ubicación:', error);
      }
    });
  }

  private updateDeliveryStatus(locationData: any): void {
    console.log('🔄 Actualizando estado del repartidor:', {
      id: locationData.deliveryId,
      name: locationData.name,
      lat: locationData.latitude?.toFixed(6),
      lng: locationData.longitude?.toFixed(6),
      status: locationData.status
    });
    
    // Validar datos de ubicación
    if (!locationData.deliveryId || !locationData.latitude || !locationData.longitude) {
      console.warn('⚠️ Datos de ubicación incompletos en grid:', locationData);
      return;
    }
    
    const deliveryIndex = this.deliveryStatuses.findIndex(
      delivery => delivery.id === locationData.deliveryId
    );
    
    if (deliveryIndex >= 0) {
      // Verificar si la nueva ubicación es más reciente
      const existingTimestamp = this.deliveryStatuses[deliveryIndex].lastUpdate ? 
        new Date(this.deliveryStatuses[deliveryIndex].lastUpdate).getTime() : 0;
      const newTimestamp = new Date(locationData.timestamp || Date.now()).getTime();
      
      if (newTimestamp > existingTimestamp) {
        // Actualizar solo los campos necesarios para evitar problemas de referencia
        const updatedDelivery = {
          ...this.deliveryStatuses[deliveryIndex],
          status: locationData.status || 'available',
          currentLocation: {
            lat: parseFloat(locationData.latitude),
            lng: parseFloat(locationData.longitude)
          },
          lastUpdate: new Date(locationData.timestamp || Date.now())
        };
        
        this.deliveryStatuses[deliveryIndex] = updatedDelivery;
        
        // Forzar detección de cambios
        this.cdr.detectChanges();
        console.log(`✅ Repartidor ${locationData.deliveryId} actualizado exitosamente`);
      } else {
        console.log(`⏰ Actualización ignorada (más antigua) para repartidor ${locationData.deliveryId}`);
      }
    } else {
      console.warn(`⚠️ Repartidor ${locationData.deliveryId} no encontrado en la lista`);
    }
  }

  private setupStatusUpdates(): void {
    console.log('👂 Configurando escucha de cambios de estado...');
    
    this.statusUpdateSubscription = this.socketService.onStatusUpdate().subscribe({
      next: (statusData) => {
        console.log('📡 Cambio de estado recibido:', statusData);
        this.updateDeliveryStatusOnly(statusData.deliveryId, statusData.status);
      },
      error: (error) => {
        console.error('❌ Error en suscripción de estado:', error);
      }
    });
  }
  
  private updateDeliveryStatusOnly(deliveryId: number, status: string): void {
    const deliveryIndex = this.deliveryStatuses.findIndex(d => d.id === deliveryId);
    
    if (deliveryIndex >= 0) {
      this.deliveryStatuses[deliveryIndex].status = status;
      this.cdr.detectChanges();
      console.log(`✅ Estado del repartidor ${deliveryId} actualizado a: ${status}`);
    } else {
      console.warn(`⚠️ Repartidor ${deliveryId} no encontrado para actualizar estado`);
    }
  }

  getStatusClass(status: string): string {
    switch(status) {
      case 'available':
        return 'status-working'; // Verde para disponible
      case 'busy':
        return 'status-off'; // Rojo para ocupado
      case 'working':
        return 'status-working'; // Verde para trabajando (compatibilidad)
      default:
        return 'status-off'; // Rojo por defecto
    }
  }

  getStatusText(status: string): string {
    switch(status) {
      case 'available':
        return 'Disponible';
      case 'busy':
        return 'Ocupado';
      case 'working':
        return 'Trabajando';
      default:
        return 'Desconectado';
    }
  }

  showAssignModal(deliveryId: number, deliveryName: string): void {
    this.assignPackages.emit({ deliveryId, deliveryName });
  }

  ngOnDestroy(): void {
    console.log('🧹 Limpiando DeliveryStatusGridComponent...');
    
    // Limpiar suscripción de ubicaciones
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
      this.locationUpdateSubscription = null;
    }
    
    // Limpiar suscripción de estados
    if (this.statusUpdateSubscription) {
      this.statusUpdateSubscription.unsubscribe();
      this.statusUpdateSubscription = null;
    }
  }
}