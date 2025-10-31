package com.stocks.stockease.dto;

import java.util.List;

import org.springframework.data.domain.Page;

/**
 * Data transfer object for paginated response data.
 * 
 * Wraps Spring Data Page objects with consistent metadata fields
 * for client-side pagination controls. Immutable after construction.
 * 
 * @author Team StockEase
 * @version 1.0
 * @since 2025-01-01
 */
public class PaginatedResponse<T> {

    /**
     * Current page content. Immutable list extracted from Spring Page object.
     * Size matches pageSize unless final page with fewer items.
     */
    private final List<T> content;

    /**
     * Current page number (zero-based). Example: page=0 is first page, page=1 is second page.
     */
    private final int pageNumber;

    /**
     * Items per page. Set at request time via pageSize parameter.
     * All pages contain exactly pageSize items except possibly the final page.
     */
    private final int pageSize;

    /**
     * Total items across all pages in the dataset.
     * May exceed current page content size significantly.
     */
    private final long totalElements;

    /**
     * Total pages available. Calculated as ceil(totalElements / pageSize).
     * Enables client to determine if more pages exist and build pagination UI.
     */
    private final int totalPages;

    /**
     * Constructs pagination response from Spring Data Page.
     * 
     * Extracts content and metadata from Page object. No validation required
     * as Spring Data guarantees Page consistency.
     * 
     * @param page Spring Data Page with content and metadata
     */
    public PaginatedResponse(Page<T> page) {
        this.content = page.getContent();
        this.pageNumber = page.getNumber();
        this.pageSize = page.getSize();
        this.totalElements = page.getTotalElements();
        this.totalPages = page.getTotalPages();
    }

    /**
     * Returns items in current page.
     * 
     * @return content list (size <= pageSize)
     */
    public List<T> getContent() {
        return content;
    }

    /**
     * Returns current page number (zero-based).
     * 
     * @return page index
     */
    public int getPageNumber() {
        return pageNumber;
    }

    /**
     * Returns items per page.
     * 
     * @return page size
     */
    public int getPageSize() {
        return pageSize;
    }

    /**
     * Returns total items across all pages.
     * 
     * @return total item count
     */
    public long getTotalElements() {
        return totalElements;
    }

    /**
     * Returns total pages available.
     * 
     * @return page count
     */
    public int getTotalPages() {
        return totalPages;
    }
}
