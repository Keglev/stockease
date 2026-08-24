import { ProductResponse } from '../../core/api/api-models';

/**
 * How a product reads in a typeahead panel and in the field once chosen.
 *
 * <p>Name and SKU together, because the name alone is not reliably unique - two products may sit
 * one letter apart, and the SKU is what an operator reads off the shelf to tell them apart. The
 * reports page's own product picker shows the name only; it searches within one supplier's
 * catalogue, where the ambiguity this resolves does not arise.
 *
 * <p>Shared rather than written twice: the movement form and the invoice lines pick from the same
 * catalogue, and a row that read differently on the two pages would be a difference with no
 * meaning behind it.
 */
export function productLabel(product: ProductResponse): string {
  return `${product.name} (${product.sku})`;
}
