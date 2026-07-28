import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'logout',
    loadComponent: () =>
      import('./features/auth/logout/logout.component').then((m) => m.LogoutComponent)
  },
  {
    path: 'app',
    loadComponent: () => import('./shared/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/product-list/product-list.component').then(
            (m) => m.ProductListComponent
          )
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/invoices/invoice-list/invoice-list.component').then(
            (m) => m.InvoiceListComponent
          )
      },
      // 'invoices/new' MUST stay declared before 'invoices/:id', otherwise the parameterised
      // route matches first and 'new' is captured as an id.
      {
        path: 'invoices/new',
        loadComponent: () =>
          import('./features/invoices/invoice-create/invoice-create.component').then(
            (m) => m.InvoiceCreateComponent
          )
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/invoices/invoice-detail/invoice-detail.component').then(
            (m) => m.InvoiceDetailComponent
          )
      },
      {
        path: 'movements',
        loadComponent: () =>
          import('./features/movements/movement-record/movement-record.component').then(
            (m) => m.MovementRecordComponent
          )
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/supplier-list/supplier-list.component').then(
            (m) => m.SupplierListComponent
          )
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./features/customers/customer-list/customer-list.component').then(
            (m) => m.CustomerListComponent
          )
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
