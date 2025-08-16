import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, Subject } from 'rxjs';
import { share } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private readonly url = 'http://localhost:3000';
  private locationUpdateSubject = new Subject<any>();
  private statusUpdateSubject = new Subject<any>();
  private packageUpdateSubject = new Subject<any>();
  private listenersInitialized = false;

  constructor() {
    this.socket = io(this.url);
    
    // ✅ AGREGAR LOGS DE CONEXIÓN
    this.socket.on('connect', () => {
      console.log('🔌 Socket conectado exitosamente:', this.socket.id);
      this.initializeListeners();
    });
    
    this.socket.on('disconnect', () => {
      console.log('🔌 Socket desconectado');
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket:', error);
    });
    
    this.initializeListeners();
  }

  // Conectar como repartidor
  joinAsDelivery(deliveryId: number): void {
    this.socket.emit('join-delivery', deliveryId);
  }

  // Conectar como admin
  joinAsAdmin(): void {
    console.log('👨‍💼 Intentando unirse como admin...');
    this.socket.emit('join-admin');
    console.log('👨‍💼 Evento join-admin enviado');
  }

  // Enviar ubicación
  // Enviar ubicación
  sendLocationUpdate(data: any): void {
    console.log('Enviando ubicación por socket:', data);
    
    // Asegurar que el timestamp esté presente
    if (!data.timestamp) {
      data.timestamp = Date.now();
    }
    
    this.socket.emit('location-update', data);
  }
  
  // Enviar cambio de estado de repartidor
  sendStatusUpdate(deliveryId: number, status: string): void {
    console.log('📡 Enviando cambio de estado:', { deliveryId, status });
    this.socket.emit('delivery-status-change', { deliveryId, status, timestamp: Date.now() });
  }
  
  // Enviar actualización de paquete
  sendPackageUpdate(packageData: any): void {
    console.log('📦 Enviando actualización de paquete:', packageData);
    this.socket.emit('package-update', { ...packageData, timestamp: Date.now() });
  }
  
  private initializeListeners(): void {
    if (this.listenersInitialized) {
      return;
    }
    
    console.log('👂 Inicializando listeners de Socket una sola vez');
    
    // Listener para actualizaciones de ubicación
    this.socket.on('delivery-location-update', (data) => {
      console.log('🔄 Socket recibió ubicación:', data);
      this.locationUpdateSubject.next(data);
    });
    
    // Listener para actualizaciones de estado
    this.socket.on('delivery-status-update', (data) => {
      console.log('🔄 Socket recibió actualización de estado:', data);
      this.statusUpdateSubject.next(data);
    });
    
    // Listener para actualizaciones de paquetes
    this.socket.on('package-updated', (data) => {
      console.log('📦 Socket recibió actualización de paquete:', data);
      this.packageUpdateSubject.next(data);
    });
    
    this.listenersInitialized = true;
  }
  
  // Escuchar actualizaciones de ubicación (para admin y delivery)
  onLocationUpdate(): Observable<any> {
    return this.locationUpdateSubject.asObservable().pipe(share());
  }
  
  // Escuchar actualizaciones de estado
  onStatusUpdate(): Observable<any> {
    return this.statusUpdateSubject.asObservable().pipe(share());
  }

  // Desconectar
  disconnect(): void {
    this.socket.disconnect();
  }

  // Escuchar actualizaciones de paquetes
  onPackageUpdated(): Observable<any> {
    return this.packageUpdateSubject.asObservable().pipe(share());
  }
}