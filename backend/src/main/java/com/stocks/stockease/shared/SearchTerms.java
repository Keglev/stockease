package com.stocks.stockease.shared;

import java.util.List;

/**
 * Splits a typeahead term into the tokens every search matches on (ADR 035).
 *
 * <p>A term is whitespace-separated words, and EVERY word must match for a row to answer - "dru pap"
 * finds "Druckerpapier A4" because both fragments are in it, in either order. The alternative, one
 * substring match on the whole term, made a reader type a product's words in the order the catalogue
 * happened to record them.
 *
 * <p>A blank term is zero tokens, and zero tokens is the empty conjunction: everything matches. That
 * is what the browse-on-focus behaviour rides on, and it is what the endpoints already did by
 * accident - {@code LIKE '%%'} matches every row - so this makes an existing behaviour a stated one
 * rather than changing it.
 */
public final class SearchTerms {

    private SearchTerms() {
    }

    /**
     * Splits a term into its tokens, discarding surrounding and repeated whitespace.
     *
     * @param term the raw search term; may be {@code null} or blank
     * @return one entry per word, empty when the term carries no words
     */
    public static List<String> tokenize(String term) {
        if (term == null || term.isBlank()) {
            return List.of();
        }
        return List.of(term.strip().split("\\s+"));
    }
}
