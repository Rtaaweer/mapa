import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { AdminComponent } from './components/admin/admin.component';
import { DeliveryViewComponent } from './components/delivery-view/delivery-view.component';
import { AuthGuard, AdminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { 
    path: 'admin', 
    component: AdminComponent, 
    canActivate: [AdminGuard] 
  },
  { 
    path: 'delivery', 
    component: DeliveryViewComponent, 
    canActivate: [AuthGuard] 
  },
  { path: '**', redirectTo: '/login' }
];
