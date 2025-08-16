import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  // Obtener todas las ubicaciones desde el backend
  getMapData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/map-data`);
  }

  // Guardar nueva ubicación a través del backend
  saveLocation(location: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/locations`, location);
  }

  // Obtener una ubicación específica
  getLocationById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/locations/${id}`);
  }

  // Actualizar una ubicación
  updateLocation(id: number, location: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/locations/${id}`, location);
  }

  // Eliminar una ubicación
  deleteLocation(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/locations/${id}`);
  }
}