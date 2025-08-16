import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PackageService } from '../../services/package.service';

@Component({
  selector: 'app-assign-package-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal" [class.show]="isVisible" (click)="closeModal($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>📦 Asignar Paquetes a {{deliveryName}}</h3>
          <button class="close-btn" (click)="close()">×</button>
        </div>
        
        <div class="modal-body">
          <div *ngIf="loading" class="loading">
            Cargando paquetes disponibles...
          </div>
          
          <div *ngIf="!loading && unassignedPackages.length === 0" class="no-packages">
            <p>📭 No hay paquetes sin asignar disponibles</p>
          </div>
          
          <div *ngIf="!loading && unassignedPackages.length > 0" class="packages-list">
            <div class="select-all">
              <label>
                <input type="checkbox" 
                       [checked]="allSelected" 
                       (change)="toggleSelectAll($event)">
                <strong>Seleccionar todos ({{unassignedPackages.length}} paquetes)</strong>
              </label>
            </div>
            
            <div class="packages-grid">
              <div *ngFor="let package of unassignedPackages" 
                   class="package-item"
                   [class.selected]="isPackageSelected(package.id)">
                <label class="package-label">
                  <input type="checkbox" 
                         [value]="package.id" 
                         [checked]="isPackageSelected(package.id)"
                         (change)="togglePackageSelection(package.id, $event)">
                  
                  <div class="package-info">
                    <div class="package-header">
                      <strong>📦 Paquete #{{package.id}}</strong>
                      <span class="status-badge">{{getStatusText(package.status)}}</span>
                    </div>
                    
                    <div class="package-details">
                      <p><strong>Destinatario:</strong> {{package.recipient_name}}</p>
                      <p><strong>Dirección:</strong> {{package.recipient_address}}</p>
                      <p><strong>Fecha:</strong> {{package.created_at | date:'short'}}</p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <div class="selected-count">
            <span *ngIf="selectedPackages.length > 0">
              {{selectedPackages.length}} paquete(s) seleccionado(s)
            </span>
          </div>
          
          <div class="footer-buttons">
            <button class="btn-secondary" (click)="close()" [disabled]="assigning">
              Cancelar
            </button>
            <button class="btn-primary" 
                    (click)="assignPackages()" 
                    [disabled]="selectedPackages.length === 0 || assigning">
              <span *ngIf="assigning">Asignando...</span>
              <span *ngIf="!assigning">Asignar Seleccionados</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal {
      display: none;
      position: fixed;
      z-index: 1000;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0,0,0,0.5);
    }
    
    .modal.show {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .modal-content {
      background-color: white;
      border-radius: 8px;
      width: 90%;
      max-width: 800px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    
    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }
    
    .close-btn:hover {
      color: #333;
    }
    
    .modal-body {
      padding: 20px;
      flex: 1;
      overflow-y: auto;
    }
    
    .loading, .no-packages {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    
    .select-all {
      margin-bottom: 20px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 5px;
    }
    
    .packages-grid {
      display: grid;
      gap: 15px;
    }
    
    .package-item {
      border: 2px solid #e9ecef;
      border-radius: 8px;
      transition: all 0.3s ease;
    }
    
    .package-item:hover {
      border-color: #007bff;
    }
    
    .package-item.selected {
      border-color: #28a745;
      background-color: #f8fff9;
    }
    
    .package-label {
      display: flex;
      padding: 15px;
      cursor: pointer;
      align-items: flex-start;
      gap: 12px;
    }
    
    .package-info {
      flex: 1;
    }
    
    .package-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .status-badge {
      background-color: #ffc107;
      color: #856404;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    
    .package-details p {
      margin: 5px 0;
      font-size: 14px;
      color: #666;
    }
    
    .modal-footer {
      padding: 20px;
      border-top: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .selected-count {
      color: #666;
      font-size: 14px;
    }
    
    .footer-buttons {
      display: flex;
      gap: 10px;
    }
    
    .btn-secondary, .btn-primary {
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover:not(:disabled) {
      background-color: #5a6268;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      background-color: #0056b3;
    }
    
    .btn-primary:disabled, .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class AssignPackageModalComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() deliveryId!: number;
  @Input() deliveryName!: string;
  @Output() packagesAssigned = new EventEmitter<number[]>();
  @Output() modalClosed = new EventEmitter<void>();

  unassignedPackages: any[] = [];
  selectedPackages: number[] = [];
  loading = false;
  assigning = false;
  allSelected = false;

  constructor(private packageService: PackageService) {}

  ngOnInit(): void {
    if (this.isVisible) {
      this.loadUnassignedPackages();
    }
  }

  ngOnChanges(): void {
    if (this.isVisible) {
      this.loadUnassignedPackages();
      this.selectedPackages = [];
      this.allSelected = false;
    }
  }

  private loadUnassignedPackages(): void {
    this.loading = true;
    this.packageService.getPackages().subscribe({
      next: (packages: any[]) => {
        // Filtrar paquetes sin asignar o con status pending
        this.unassignedPackages = packages.filter(
          (pkg: any) => !pkg.delivery_person_id || pkg.status === 'pending'
        );
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error cargando paquetes:', error);
        this.loading = false;
      }
    });
  }

  toggleSelectAll(event: any): void {
    this.allSelected = event.target.checked;
    if (this.allSelected) {
      this.selectedPackages = this.unassignedPackages.map(pkg => pkg.id);
    } else {
      this.selectedPackages = [];
    }
  }

  togglePackageSelection(packageId: number, event: any): void {
    if (event.target.checked) {
      this.selectedPackages.push(packageId);
    } else {
      this.selectedPackages = this.selectedPackages.filter(id => id !== packageId);
    }
    
    // Actualizar estado de "seleccionar todos"
    this.allSelected = this.selectedPackages.length === this.unassignedPackages.length;
  }

  isPackageSelected(packageId: number): boolean {
    return this.selectedPackages.includes(packageId);
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'assigned': return 'Asignado';
      case 'in_transit': return 'En tránsito';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  }

  assignPackages(): void {
    if (this.selectedPackages.length === 0) return;
    
    this.assigning = true;
    let completedAssignments = 0;
    const totalAssignments = this.selectedPackages.length;
    
    this.selectedPackages.forEach(packageId => {
      this.packageService.assignPackage(packageId, this.deliveryId).subscribe({
        next: () => {
          completedAssignments++;
          console.log(`✅ Paquete ${packageId} asignado correctamente`);
          
          if (completedAssignments === totalAssignments) {
            console.log(`🎉 Todos los paquetes asignados a ${this.deliveryName}`);
            this.packagesAssigned.emit(this.selectedPackages);
            this.assigning = false;
            this.close();
          }
        },
        error: (error) => {
          console.error(`❌ Error asignando paquete ${packageId}:`, error);
          completedAssignments++;
          
          if (completedAssignments === totalAssignments) {
            this.assigning = false;
          }
        }
      });
    });
  }

  closeModal(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  close(): void {
    this.selectedPackages = [];
    this.allSelected = false;
    this.modalClosed.emit();
  }
}