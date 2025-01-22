package com.stocks.stockease.dto;

import java.util.List;

import org.springframework.data.domain.Page;

/**
 * A generic class representing a paginated response.
 * This is used to encapsulate paginated data along with additional
 * metadata such as total elements and total pages.
 * 
 * @param <T> the type of the content being paginated
 */
public class PaginatedResponse<T> {

    // The list of items in the current page
    private final List<T> content;

    // The current page number (0-based index)
    private final int pageNumber;

    // The size of the page (number of items per page)
    private final int pageSize;

    // The total number of elements across all pages
    private final long totalElements;

    // The total number of pages available
    private final int totalPages;

    /**
     * Constructs a PaginatedResponse object from a Spring Data Page.
     * 
     * @param page the Spring Data Page containing the content and metadata
     */
    public PaginatedResponse(Page<T> page) {
        this.content = page.getContent();
        this.pageNumber = page.getNumber();
        this.pageSize = page.getSize();
        this.totalElements = page.getTotalElements();
        this.totalPages = page.getTotalPages();
    }

    /**
     * Retrieves the content of the current page.
     * 
     * @return the content as a list
     */
    public List<T> getContent() {
        return content;
    }

    /**
     * Retrieves the current page number.
     * 
     * @return the page number (0-based index)
     */
    public int getPageNumber() {
        return pageNumber;
    }

    /**
     * Retrieves the size of the page.
     * 
     * @return the number of items per page
     */
    public int getPageSize() {
        return pageSize;
    }

    /**
     * Retrieves the total number of elements across all pages.
     * 
     * @return the total number of elements
     */
    public long getTotalElements() {
        return totalElements;
    }

    /**
     * Retrieves the total number of pages available.
     * 
     * @return the total number of pages
     */
    public int getTotalPages() {
        return totalPages;
    }
}
