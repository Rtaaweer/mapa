import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SocketService } from '../../services/socket.service';
import { MapComponent } from '../map/map.component';
import { PackageTableComponent } from '../package-table/package-table.component';
import { AddPackageFormComponent } from '../add-package-form/add-package-form.component';
import { DeliveryStatusGridComponent } from '../delivery-status-grid/delivery-status-grid.component';
import { AssignPackageModalComponent } from '../assign-package-modal/assign-package-modal.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule, 
    MapComponent, 
    PackageTableComponent, 
    AddPackageFormComponent,
    DeliveryStatusGridComponent,
    AssignPackageModalComponent
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  @ViewChild(PackageTableComponent) packageTable!: PackageTableComponent;
  @ViewChild(MapComponent) mapComponent!: MapComponent;
  showAddPackageModal = false;
  showAssignModal = false;
  selectedDeliveryId = 0;
  selectedDeliveryName = '';
  deliveryLocations: any[] = [];
  private locationUpdateSubscription: Subscription | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    console.log('👨‍💼 Admin panel iniciado');
    
    // Unirse como admin una sola vez
    this.socketService.joinAsAdmin();
    
    // Suscribirse a actualizaciones de ubicación una sola vez
    this.setupLocationUpdates();
  }
  
  private setupLocationUpdates(): void {
    // Limpiar suscripción anterior si existe
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
    }
    
    console.log('👂 Suscribiéndose a actualizaciones de ubicación en AdminComponent');
    this.locationUpdateSubscription = this.socketService.onLocationUpdate().subscribe({
      next: (locationData) => {
        console.log('👨‍💼 AdminComponent recibió ubicación:', locationData.deliveryId);
        this.updateDeliveryLocation(locationData);
      },
      error: (error) => {
        console.error('❌ Error en suscripción de ubicación del admin:', error);
      }
    });
  }

  private updateDeliveryLocation(locationData: any): void {
    console.log('👨‍💼 Procesando ubicación del repartidor:', locationData.deliveryId);
    
    // Filtrar ubicaciones de admins (como Ricardo Torres)
    if (locationData.name === 'Ricardo Torres' || locationData.role === 'admin') {
      console.warn('🚫 Ubicación de admin filtrada:', locationData.name);
      return;
    }
    
    // Validar datos de ubicación
    if (!locationData.deliveryId || !locationData.latitude || !locationData.longitude) {
      console.warn('⚠️ Datos de ubicación incompletos:', locationData);
      return;
    }
    
    const existingIndex = this.deliveryLocations.findIndex(
      loc => loc.deliveryId === locationData.deliveryId
    );
    
    // Crear objeto de ubicación normalizado
    const normalizedLocation = {
      deliveryId: locationData.deliveryId,
      latitude: parseFloat(locationData.latitude),
      longitude: parseFloat(locationData.longitude),
      timestamp: locationData.timestamp || Date.now(),
      status: locationData.status || 'available',
      name: locationData.name || `Repartidor #${locationData.deliveryId}`,
      accuracy: locationData.accuracy,
      speed: locationData.speed
    };
    
    if (existingIndex >= 0) {
      // Solo actualizar si la nueva ubicación es más reciente
      const existingTimestamp = new Date(this.deliveryLocations[existingIndex].timestamp).getTime();
      const newTimestamp = new Date(normalizedLocation.timestamp).getTime();
      
      if (newTimestamp > existingTimestamp) {
        this.deliveryLocations[existingIndex] = normalizedLocation;
        console.log(`✅ Ubicación actualizada para repartidor ${locationData.deliveryId}`);
        
        // Solo enviar al mapa si es una actualización más reciente
        if (this.mapComponent) {
          this.mapComponent.updateDeliveryMarkerRealTime(normalizedLocation);
          console.log('🗺️ Ubicación enviada al mapa del admin');
        }
      } else {
        console.log(`⏰ Ubicación ignorada (más antigua) para repartidor ${locationData.deliveryId}`);
      }
    } else {
      this.deliveryLocations.push(normalizedLocation);
      console.log(`✅ Nueva ubicación agregada para repartidor ${locationData.deliveryId}`);
      
      // Enviar nueva ubicación al mapa
      if (this.mapComponent) {
        this.mapComponent.updateDeliveryMarkerRealTime(normalizedLocation);
        console.log('🗺️ Nueva ubicación enviada al mapa del admin');
      }
    }
  }

  onAssignPackages(data: {deliveryId: number, deliveryName: string}): void {
    this.selectedDeliveryId = data.deliveryId;
    this.selectedDeliveryName = data.deliveryName;
    this.showAssignModal = true;
  }

  onPackagesAssigned(packageIds: number[]): void {
    console.log(` ${packageIds.length} paquetes asignados a ${this.selectedDeliveryName}`);
    this.showAssignModal = false;
    
    // ✅ AGREGAR: También refrescar después de asignar paquetes
    if (this.packageTable) {
      this.packageTable.loadPackages();
    }
  }

  onPackageAdded(packageData: any): void {
    console.log(' Paquete agregado:', packageData);
    this.showAddPackageModal = false;
    
    //  AGREGAR: Refrescar la tabla de paquetes
    if (this.packageTable) {
      this.packageTable.loadPackages();
    }
  }

  closeModal(event: Event): void {
    if (event.target === event.currentTarget) {
      this.showAddPackageModal = false;
    }
  }

  logout(): void {
    console.log(' Admin cerrando sesión');
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    console.log('🧹 Limpiando AdminComponent...');
    
    // Limpiar suscripción
    if (this.locationUpdateSubscription) {
      this.locationUpdateSubscription.unsubscribe();
      this.locationUpdateSubscription = null;
    }
    
    console.log('Admin panel destruido');
    this.socketService.disconnect();
  }
}