import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PackageService } from '../../services/package.service';

@Component({
  selector: 'app-add-package-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-package-form.component.html',
  styleUrls: ['./add-package-form.component.css']
})
export class AddPackageFormComponent implements OnInit {
  @Output() packageAdded = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  packageData = {
    destinatario: '',
    direccion: '',
    delivery_person_id: null // Cambiar de delivery_id a delivery_person_id
  };

  deliveries: any[] = [];
  loading = false;

  constructor(private packageService: PackageService) {}

  ngOnInit() {
    this.loadDeliveries();
  }

  loadDeliveries() {
    this.packageService.getDeliveries().subscribe({
      next: (data) => {
        this.deliveries = data;
      },
      error: (error) => {
        console.error('Error loading deliveries:', error);
      }
    });
  }

  onSubmit() {
    if (this.packageData.destinatario && this.packageData.direccion && this.packageData.delivery_person_id) {
      this.loading = true;
      
      this.packageService.createPackage(this.packageData).subscribe({
        next: (response) => {
          this.packageAdded.emit(response);
          this.resetForm();
          this.loading = false;
        },
        error: (error) => {
          console.error('Error creating package:', error);
          this.loading = false;
        }
      });
    }
  }

  resetForm() {
    this.packageData = {
      destinatario: '',
      direccion: '',
      delivery_person_id: null // Cambiar de delivery_id a delivery_person_id
    };
  }

  onCancel() {
    this.resetForm();
    this.cancel.emit();
  }
}