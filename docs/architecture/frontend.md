# Frontend Architecture - StockEase

## Overview

The StockEase frontend is a modern React 18 application with TypeScript, built with Vite and styled with Tailwind CSS. It provides a responsive, feature-rich user interface for inventory management with multi-language support and dark mode capabilities.

**Tech Stack**: React 18 • TypeScript 5.x • Vite 5 • Tailwind CSS 3 • React Router 6  
**Deployment**: Render (https://stockease-frontend.onrender.com)  
**Environment**: Node.js 18+

---

## Component Hierarchy

```
App (Root Component)
│
├── Layout Components
│   ├── Header/Navigation Bar
│   │   ├── Logo
│   ├── Dark Mode Toggle
│   └── Language Switcher
│
├── Routes (React Router)
│   ├── PublicRoutes
│   │   ├── LoginPage (/login)
│   │   ├── RegisterPage (/register)
│   │   └── NotFoundPage (404)
│   │
│   └── ProtectedRoutes (JWT-required)
│       ├── ProductDashboard (/dashboard)
│       │   ├── ProductList
│       │   │   ├── ProductCard (reusable)
│       │   │   ├── ProductFilter
│       │   │   └── ProductPagination
│       │   ├── ProductForm (Create/Edit modal)
│       │   ├── ProductSearch
│       │   └── StockValueDisplay
│       │
│       ├── AdminPanel (/admin) - Admin only
│       │   ├── UserManagement
│       │   ├── AuditLog
│       │   └── SystemSettings
│       │
│       └── ProfilePage (/profile)
│           ├── UserInfo
│           └── PreferencesPanel
│
└── Global Providers
    ├── QueryClientProvider (React Query)
    ├── i18nextProvider (i18next)
    ├── ThemeProvider (Dark Mode)
    └── AuthContext (JWT Management)
```

---

## Layered Architecture

```
┌─────────────────────────────────────┐
│     React Components & Pages        │ ← UI Layer
│  (Stateless presentational)         │
├─────────────────────────────────────┤
│   Custom Hooks & Services Layer     │ ← Logic Layer
│  (useQuery, useMutation, context)   │
├─────────────────────────────────────┤
│   API Integration (Axios)           │ ← API Adapter Layer
│  (Configured with interceptors)     │
├─────────────────────────────────────┤
│  Backend REST API (Spring Boot)     │ ← External
│  Running at :8081                   │
└─────────────────────────────────────┘
```

---

## Project Structure

```
frontend/
├── src/
│   ├── pages/                        # Route-level components
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── ProductDashboard.tsx
│   │   ├── AdminPanel.tsx
│   │   └── NotFoundPage.tsx
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── Header/
│   │   ├── Navigation/
│   │   ├── ProductCard/
│   │   ├── ProductForm/
│   │   ├── ProductFilter/
│   │   ├── ProductPagination/
│   │   ├── Button/
│   │   ├── Modal/
│   │   └── FormField/
│   │
│   ├── api/                          # API layer
│   │   ├── auth.ts                   # Auth endpoints
│   │   ├── products.ts               # Product endpoints
│   │   ├── index.ts                  # Axios config & interceptors
│   │   └── types.ts                  # API response types
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.ts                # Auth context hook
│   │   ├── useProducts.ts            # Product queries
│   │   └── useLocalStorage.ts        # Persist preferences
│   │
│   ├── services/                     # Business logic
│   │   ├── authService.ts
│   │   ├── productService.ts
│   │   └── storageService.ts
│   │
│   ├── types/                        # TypeScript interfaces
│   │   ├── auth.types.ts
│   │   ├── product.types.ts
│   │   └── api.types.ts
│   │
│   ├── styles/                       # Global styles
│   │   ├── globals.css
│   │   └── variables.css
│   │
│   ├── locales/                      # i18n translations
│   │   ├── en.json                   # English
│   │   ├── de.json                   # German
│   │   └── index.ts
│   │
│   ├── assets/                       # Static assets
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   │
│   ├── App.tsx                       # Root component
│   ├── main.tsx                      # Entry point
│   ├── i18n.ts                       # i18n config
│   └── vite-env.d.ts
│
├── public/                           # Static files (favicons, etc)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── eslint.config.js
├── postcss.config.cjs
├── Dockerfile
├── index.html
└── README.md
```

---

## State Management Strategy

### 1. **Server State (React Query)**
Manages data fetched from the backend:
```typescript
// useProducts hook
const { data: products, isLoading, error } = useQuery({
  queryKey: ['products', page, size],
  queryFn: () => api.getProducts(page, size)
});
```

**Cached data**: Products list, user info, pagination state  
**Refetch triggers**: Manual refetch, window focus, interval

### 2. **Client State (React Hooks)**
Manages local component state:
```typescript
const [filterText, setFilterText] = useState('');
const [sortBy, setSortBy] = useState('name');
const [showModal, setShowModal] = useState(false);
```

### 3. **Global State (Context API)**
Manages authentication and theme:
```typescript
// AuthContext
const { user, token, login, logout, isAuthenticated } = useAuth();

// ThemeContext
const { isDark, toggleDarkMode } = useTheme();

// LanguageContext
const { language, setLanguage } = useI18n();
```

### 4. **Persistent State (Local Storage)**
Stores user preferences:
- JWT token
- Dark mode preference
- Selected language
- Recent filters

---

## Authentication Flow

```
User Input (Username + Password)
     ↓
[Login Form Component]
     ↓
[API Call: POST /api/auth/login]
     ↓
[Backend validates credentials]
     ↓
[JWT Token + User Info returned]
     ↓
[Store token in Local Storage]
     ↓
[Update AuthContext]
     ↓
[Configure Axios Authorization Header]
     ↓
[Redirect to Dashboard]
     ↓
[Protected Routes Check JWT validity]
```

### Token Management
```typescript
// Store token after login
localStorage.setItem('token', response.token);
localStorage.setItem('user', JSON.stringify(response.user));

// Include in all API requests
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clear on logout
localStorage.removeItem('token');
localStorage.removeItem('user');
```

---

## API Integration

### Axios Configuration
```typescript
// api/index.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || 'http://localhost:8081/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add JWT token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors globally
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired - redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### API Service Modules

**auth.ts**
```typescript
export const authAPI = {
  register: (username: string, password: string) => 
    apiClient.post('/auth/register', { username, password }),
  
  login: (username: string, password: string) => 
    apiClient.post('/auth/login', { username, password }),
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};
```

**products.ts**
```typescript
export const productsAPI = {
  getAll: (page?: number, size?: number) =>
    apiClient.get('/products', { params: { page, size } }),
  
  getById: (id: number) =>
    apiClient.get(`/products/${id}`),
  
  create: (product: CreateProductDTO) =>
    apiClient.post('/products', product),
  
  update: (id: number, product: UpdateProductDTO) =>
    apiClient.put(`/products/${id}`, product),
  
  delete: (id: number) =>
    apiClient.delete(`/products/${id}`)
};
```

---

## Multi-Language Support (i18next)

### Configuration
```typescript
// i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enMessages from './locales/en.json';
import deMessages from './locales/de.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enMessages },
    de: { translation: deMessages }
  },
  lng: localStorage.getItem('language') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});
```

### Usage in Components
```typescript
import { useTranslation } from 'react-i18next';

export const ProductCard = ({ product }) => {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h3>{product.name}</h3>
      <p>{t('product.quantity')}: {product.quantity}</p>
      <p>{t('product.price')}: ${product.price}</p>
      
      <button onClick={() => i18n.changeLanguage('de')}>
        {t('switch-language')}
      </button>
    </div>
  );
};
```

### Supported Languages
- **English (en)** - Default
- **German (de)** - Full translation

### Adding New Translations
1. Add key-value pairs to `locales/en.json` and `locales/de.json`
2. Use `i18n.t('key.path')` in components
3. Test both languages

---

## Dark Mode Support

### Implementation
```typescript
// hooks/useTheme.ts
export const useTheme = () => {
  const [isDark, setIsDark] = useState(
    localStorage.getItem('theme') === 'dark'
  );
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  
  return {
    isDark,
    toggleDarkMode: () => setIsDark(!isDark)
  };
};
```

### Usage in Components
```typescript
// Components automatically respond to dark: prefix in Tailwind
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">
  {/* Content adapts to theme */}
</div>
```

### CSS Variables
```css
/* styles/variables.css */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #ef4444;
  --background: #ffffff;
  --foreground: #000000;
}

.dark {
  --background: #1e293b;
  --foreground: #f1f5f9;
}
```

---

## Responsive Design

### Tailwind Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile-First Approach
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {products.map(product => (
    <ProductCard key={product.id} product={product} />
  ))}
</div>
```

### Component Responsive Patterns
- **Navigation**: Hamburger menu on mobile, full navbar on desktop
- **Tables**: Cards on mobile, table on desktop
- **Forms**: Single column on mobile, multi-column on desktop
- **Images**: Scaled proportionally with max-width constraints

---

## Form Management

### React Hook Form + TypeScript
```typescript
import { useForm } from 'react-hook-form';

interface ProductFormData {
  name: string;
  quantity: number;
  price: number;
}

export const ProductForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormData>();
  
  const onSubmit = async (data: ProductFormData) => {
    await productsAPI.create(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name', { required: true })} />
      {errors.name && <span>Name is required</span>}
      
      <input {...register('quantity', { min: 1 })} type="number" />
      {errors.quantity && <span>Must be positive</span>}
      
      <button type="submit">Create Product</button>
    </form>
  );
};
```

---

## Error Handling

### Global Error Handler
```typescript
// services/errorService.ts
export const handleApiError = (error: AxiosError) => {
  if (error.response?.status === 401) {
    return 'Session expired. Please login again.';
  }
  if (error.response?.status === 403) {
    return 'You do not have permission for this action.';
  }
  if (error.response?.status === 404) {
    return 'Resource not found.';
  }
  return error.message || 'An error occurred.';
};
```

### Component Error Boundary
```typescript
interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<any, ErrorBoundaryState> {
  componentDidCatch(error: Error) {
    this.setState({ hasError: true });
    console.error('Error caught:', error);
  }
  
  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

---

## Performance Optimization

### 1. Code Splitting
Vite automatically splits code by route:
```typescript
const ProductDashboard = lazy(() => import('./pages/ProductDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/dashboard" element={<ProductDashboard />} />
    <Route path="/admin" element={<AdminPanel />} />
  </Routes>
</Suspense>
```

### 2. React Query Caching
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  }
});
```

### 3. Memoization
```typescript
export const ProductCard = memo(({ product }: Props) => {
  return <div>{product.name}</div>;
}, (prevProps, nextProps) => 
  prevProps.product.id === nextProps.product.id
);
```

### 4. Image Optimization
- Use optimized formats (WebP with fallbacks)
- Lazy load images
- Responsive images with srcset

### 5. Bundle Analysis
```bash
npm run build -- --analyze  # If analyzer plugin installed
```

---

## Deployment

### Environment Configuration
```bash
# .env.production
VITE_API_BASE_URL=https://stockease-backend-production.koyeb.app/api
VITE_APP_VERSION=1.0.0
```

### Build Process
```bash
npm install                # Install dependencies
npm run build              # Build production bundle → dist/
npm run preview            # Preview production build locally
```

### Deployment to Render
1. Connect GitHub repository to Render
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables: `VITE_API_BASE_URL`
5. Deploy on push to main branch

### Performance Metrics
- **Bundle Size**: ~150-200 KB (gzipped)
- **Build Time**: 30-60 seconds
- **Lighthouse Score**: 90+
- **Time to Interactive**: <2 seconds

---

## Testing

### Unit Tests (Vitest)
```typescript
// ProductCard.test.tsx
import { render, screen } from '@testing-library/react';
import { ProductCard } from './ProductCard';

describe('ProductCard', () => {
  it('renders product name', () => {
    const product = { id: 1, name: 'Test', price: 100, quantity: 5 };
    render(<ProductCard product={product} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Integration Tests
- Test API calls with mock server
- Test authentication flow
- Test form submission

### E2E Tests
- Consider Playwright or Cypress for future
- Test complete user workflows

---

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: Latest versions

---

## Accessibility (a11y)

- Semantic HTML structure
- ARIA labels on form inputs
- Keyboard navigation support
- Color contrast ratios meet WCAG AA
- Focus indicators on interactive elements

---

## Related Documentation

### Main Architecture Topics
- **[Architecture Overview](./overview.md)** - Backend system context and decisions
- **[Backend Architecture](./backend.md)** - Backend APIs that frontend consumes
- **[Service Layers](./layers.md)** - Backend layer architecture
- **[Security Architecture](./security.md)** - JWT token handling and authentication flow
- **[Deployment Architecture](./deployment.md)** - Frontend deployment to Render and backend integration

### Architecture Decisions (ADRs)
- **[Database Choice](./decisions/001-database-choice.md)** - Backend database (PostgreSQL)
- **[Validation Strategy](./decisions/002-validation-strategy.md)** - Server-side and client-side validation

### Design Patterns & Practices
- **[Security Patterns](./patterns/security-patterns.md)** - JWT token management and secure APIs
- **[Repository Pattern](./patterns/repository-pattern.md)** - Backend data access patterns

### Infrastructure & Deployment
- **[CI/CD Pipeline](./deployment/ci-pipeline.md)** - Frontend build and deployment automation
- **[Staging Configuration](./deployment/staging-config.md)** - Frontend staging environment

---

**Frontend Documentation Version**: 1.0  
**Last Updated**: October 31, 2025  
**Status**: Production Ready
