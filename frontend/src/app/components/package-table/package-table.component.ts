import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PackageService } from '../../services/package.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-package-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './package-table.component.html',
  styleUrls: ['./package-table.component.css']
})
export class PackageTableComponent implements OnInit, OnDestroy {
  packages: any[] = [];
  loading = true;
  private packageUpdateSubscription: Subscription | null = null;

  constructor(
    private packageService: PackageService,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadPackages();
    this.listenToPackageUpdates();
  }

  ngOnDestroy() {
    if (this.packageUpdateSubscription) {
      this.packageUpdateSubscription.unsubscribe();
    }
  }

  private listenToPackageUpdates(): void {
    // Asegurarse de que el socket se una a la sala de admin
    this.socketService.joinAsAdmin();
    
    // Suscribirse a actualizaciones de paquetes
    this.packageUpdateSubscription = this.socketService.onPackageUpdated().subscribe(updatedPackage => {
      console.log('📦 Paquete actualizado recibido:', updatedPackage);
      
      // Encontrar y actualizar el paquete en la lista local
      const index = this.packages.findIndex(pkg => pkg.id === updatedPackage.id);
      
      if (index !== -1) {
        // Actualizar el paquete existente
        this.packages[index] = {
          ...updatedPackage,
          delivery_name: updatedPackage.usuarios?.name || 'No asignado'
        };
      } else {
        // Agregar el nuevo paquete a la lista
        this.packages.push({
          ...updatedPackage,
          delivery_name: updatedPackage.usuarios?.name || 'No asignado'
        });
      }
      
      // Forzar la detección de cambios para actualizar la UI
      this.cdr.detectChanges();
    });
  }

  loadPackages(): void {
    this.loading = true; // ✅ Asegurar que loading esté en true al inicio
    
    this.packageService.getPackages().subscribe({
      next: (packages: any[]) => {
        console.log('📦 Paquetes procesados:', packages);
        
        // ✅ MAPEAR CORRECTAMENTE los datos anidados
        this.packages = packages.map((pkg: any) => ({
          ...pkg,
          delivery_name: pkg.usuarios?.name || 'No asignado' // ✅ EXTRAER nombre del objeto anidado
        }));
        
        console.log('✅ Paquetes con nombres mapeados:', this.packages);
        this.loading = false; // ✅ AGREGAR ESTA LÍNEA
      },
      error: (error: any) => {
        console.error('Error cargando packages:', error);
        this.loading = false; // ✅ AGREGAR ESTA LÍNEA TAMBIÉN
      }
    });
  }

  // Método corregido para manejar el cambio de estado
  onStatusChange(event: Event, packageId: number) {
    const target = event.target as HTMLSelectElement;
    const newStatus = target.value;
    this.updateStatus(packageId, newStatus);
  }

  updateStatus(packageId: number, newStatus: string) {
    this.packageService.updatePackageStatus(packageId, newStatus).subscribe({
      next: (updatedPackage) => {
        // Ya no necesitamos recargar toda la tabla, el socket se encargará de actualizar
        console.log('Estado actualizado:', updatedPackage);
      },
      error: (error) => {
        console.error('Error updating status:', error);
      }
    });
  }

  deletePackage(packageId: number) {
    if (confirm('¿Estás seguro de que quieres eliminar este paquete?')) {
      this.packageService.deletePackage(packageId).subscribe({
        next: () => {
          // Eliminar el paquete de la lista local
          this.packages = this.packages.filter(pkg => pkg.id !== packageId);
          // Forzar la detección de cambios
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error deleting package:', error);
        }
      });
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'in_transit': return 'status-transit';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_transit': return 'En tránsito';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }
}