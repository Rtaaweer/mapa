import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.email, this.password).subscribe({
      next: (response) => {
        console.log('Login exitoso:', response);
        
        // Redirigir según el rol del usuario
        if (response.user.role === 'admin') {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/delivery']);
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error en login:', error);
        this.errorMessage = 'Credenciales incorrectas';
        this.isLoading = false;
      }
    });
  }

  // Método actualizado para llenar credenciales de prueba
  fillTestCredentials(role: 'admin' | 'delivery'): void {
    if (role === 'admin') {
      // Credenciales del administrador Ricardo Torres
      this.email = 'admin';
      this.password = 'Ricardo123';
    } else {
      // Credenciales del repartidor Juan Pérez
      this.email = 'delivery1';
      this.password = 'delivery123';
    }
  }
}