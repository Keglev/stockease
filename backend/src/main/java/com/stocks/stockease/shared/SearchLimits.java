package com.stocks.stockease.shared;

/** Caps shared by the typeahead search endpoints, so the cascading pickers cannot disagree. */
public final class SearchLimits {

    /**
     * Rows a typeahead search endpoint returns at most.
     *
     * <p>A suggestion panel renders about ten entries before it scrolls, so twenty leaves headroom
     * for a reader who wants to see that their term is still too broad without shipping the whole
     * catalogue to a control that can only ever display a handful of it. A search narrow enough to
     * matter fits well inside this; one that does not is a signal to type more, which is why the
     * endpoints cap rather than paginate.
     */
    public static final int TYPEAHEAD_LIMIT = 20;

    private SearchLimits() {
    }
}
