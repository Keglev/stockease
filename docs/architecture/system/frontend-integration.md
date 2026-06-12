# Frontend Integration

**Purpose**: Document the frontend architecture and how it integrates with the StockEase backend API.

**Tech Stack**: React 18 · TypeScript 5.x · Vite 5 · Tailwind CSS 3 · React Router 6
**Deployment**: https://stockeasefrontend.vercel.app

---

## Component Hierarchy

```
App
├── Layout (Header, Navigation, Dark Mode Toggle, Language Switcher)
├── PublicRoutes
│   ├── LoginPage (/login)
│   └── NotFoundPage (404)
└── ProtectedRoutes (JWT required)
    └── ProductDashboard (/dashboard)
        ├── ProductList → ProductCard, ProductFilter, ProductPagination
        ├── ProductForm (Create/Edit modal)
        └── ProductSearch
```

---

## Layered Architecture

```
React Components & Pages       ← UI Layer (presentational)
Custom Hooks & Context         ← Logic Layer (useQuery, useMutation, AuthContext)
API Integration (Axios)        ← Adapter Layer (interceptors, base URL)
Backend REST API (Spring Boot) ← External (:8081)
```

---

## Project Structure

```
frontend/src/
├── pages/          # Route-level components
├── components/     # Reusable UI components
├── api/            # Axios config, auth.ts, products.ts, types.ts
├── hooks/          # useAuth.ts, useProducts.ts, useLocalStorage.ts
├── services/       # authService.ts, productService.ts
├── types/          # auth.types.ts, product.types.ts, api.types.ts
├── locales/        # en.json, de.json, index.ts
├── styles/         # globals.css, variables.css
├── App.tsx
├── main.tsx
└── i18n.ts
```

---

## Authentication Flow

```
User submits credentials
    ↓
POST /api/auth/login
    ↓
Backend validates → returns JWT token
    ↓
Store token in localStorage
    ↓
Update AuthContext
    ↓
Axios interceptor adds Authorization: Bearer <token> to all requests
    ↓
ProtectedRoutes check JWT validity on render
```

### Axios Configuration

```typescript
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081/api',
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) window.location.href = '/login';
        return Promise.reject(error);
    }
);
```

---

## State Management

| Type | Tool | Stores |
|------|------|--------|
| Server state | React Query | Products list, pagination, user info |
| Client state | `useState` | Filter text, sort, modal visibility |
| Global state | Context API | Auth (JWT, user), theme, language |
| Persistent state | localStorage | JWT token, dark mode preference, language |

```typescript
// Server state example
const { data: products, isLoading } = useQuery({
    queryKey: ['products', page, size],
    queryFn: () => api.getProducts(page, size),
    staleTime: 5 * 60 * 1000
});
```

---

## API Service Modules

```typescript
// auth.ts
export const authAPI = {
    login: (username: string, password: string) =>
        apiClient.post('/auth/login', { username, password }),
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

// products.ts
export const productsAPI = {
    getAll: (page?: number, size?: number) =>
        apiClient.get('/products', { params: { page, size } }),
    getById: (id: number) => apiClient.get(`/products/${id}`),
    create: (product: CreateProductDTO) => apiClient.post('/products', product),
    update: (id: number, product: UpdateProductDTO) =>
        apiClient.put(`/products/${id}`, product),
    delete: (id: number) => apiClient.delete(`/products/${id}`)
};
```

---

## Multi-Language Support (i18next)

Supported languages: English (default) and German.

```typescript
// i18n.ts
i18n.use(initReactI18next).init({
    resources: {
        en: { translation: enMessages },
        de: { translation: deMessages }
    },
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en'
});
```

Usage in components: `const { t } = useTranslation(); t('product.quantity')`.

To add a new language: add a locale JSON file, register it in `i18n.ts`, add the language option to the switcher UI.

---

## Dark Mode

Implemented via Tailwind's `dark:` prefix and a `useTheme` hook that toggles `document.documentElement.classList`.

```typescript
export const useTheme = () => {
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }, [isDark]);
    return { isDark, toggleDarkMode: () => setIsDark(!isDark) };
};
```

CSS variables in `variables.css` define `--background` and `--foreground` for both `:root` and `.dark`.

---

## Performance

**Code splitting**: Vite splits bundles by route using `React.lazy()` and `<Suspense>`.

**React Query caching**: `staleTime: 5 minutes`, `cacheTime: 10 minutes` — avoids redundant API calls.

**Memoization**: `React.memo` on `ProductCard` prevents re-renders when product data is unchanged.

**Bundle metrics**: ~150-200 KB gzipped. Build time: 30-60 seconds.

---

## Deployment

```bash
# Environment variable
VITE_API_BASE_URL=https://stockeasebackend.koyeb.app/api

# Build
npm install && npm run build  # Output: dist/
```

Deployed to Vercel. Build command: `npm run build`. Publish directory: `dist`. Redeploys automatically on push to `main`.

---

[Back to System Index](./index.md)
