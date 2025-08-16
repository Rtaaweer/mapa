import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PackageService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  // Obtener todos los paquetes
  getPackages(): Observable<any> {
    return this.http.get(`${this.apiUrl}/packages`);
  }

  // Crear nuevo paquete
  createPackage(packageData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/packages`, packageData);
  }

  // Obtener todos los repartidores
  // Asegúrate de que este método no tenga filtros que excluyan al repartidor ID 2
  getDeliveries(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/deliveries`);
  }

  // Actualizar estado del paquete
  updatePackageStatus(id: number, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/packages/${id}/status`, { status });
  }

  // Eliminar paquete
  deletePackage(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/packages/${id}`);
  }

  // Agregar este método al PackageService
  assignPackage(packageId: number, deliveryPersonId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/packages/${packageId}/assign`, {
      delivery_person_id: deliveryPersonId
    });
  }

  // Agregar este método al PackageService

  updateDeliveryStatus(deliveryId: number, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/deliveries/${deliveryId}/status`, { status });
  }

  // Agregar este método para obtener ubicaciones
  getLatestDeliveryLocations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/delivery-locations/latest`);
  }

  // Obtener paquetes asignados a un repartidor específico
  getPackagesByDelivery(deliveryId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/packages/delivery/${deliveryId}`);
  }
}