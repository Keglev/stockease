import { components } from './api-types';

/**
 * Friendly aliases over the generated schema map. Regenerate the source types with
 * `npm run gen:api` whenever the OpenAPI spec changes.
 */
export type ProductResponse = components['schemas']['ProductResponse'];

export type PaginatedProducts = components['schemas']['PaginatedProducts'];
