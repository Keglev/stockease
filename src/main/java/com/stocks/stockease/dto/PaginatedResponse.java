package com.stocks.stockease.dto;

import java.util.List;

import org.springframework.data.domain.Page;

import lombok.Getter;

/**
 * Response DTO wrapping a Spring Data {@link Page} for paginated API responses.
 *
 * <p>Exposes content and pagination metadata for client-side pagination controls.
 * Immutable after construction.
 */
@Getter
public class PaginatedResponse<T> {

    /** Items on the current page. */
    private final List<T> content;

    /** Zero-based index of the current page. */
    private final int pageNumber;

    /** Maximum number of items per page. */
    private final int pageSize;

    /** Total number of items across all pages. */
    private final long totalElements;

    /** Total number of pages available. */
    private final int totalPages;

    /**
     * Extracts content and pagination metadata from a Spring Data {@link Page}.
     *
     * @param page the Spring Data page result to wrap
     */
    public PaginatedResponse(Page<T> page) {
        this.content = page.getContent();
        this.pageNumber = page.getNumber();
        this.pageSize = page.getSize();
        this.totalElements = page.getTotalElements();
        this.totalPages = page.getTotalPages();
    }
}
