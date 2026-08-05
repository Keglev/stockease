package com.stocks.stockease.shared;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;

/**
 * Builds the token-AND predicate the typeahead searches share (ADR 035).
 *
 * <p>A Specification rather than a derived query or native SQL, and both alternatives were
 * considered. A derived query cannot express a predicate whose SHAPE depends on how many words the
 * reader typed. Native SQL can - Postgres would do it in one {@code ILIKE ALL} - but a native query
 * bypasses {@code @SQLRestriction}, the mapping-level filter that keeps soft-deleted rows out of
 * every search on this codebase, and re-stating {@code deleted_at IS NULL} by hand in each query is
 * exactly the kind of duplicated invariant that goes wrong quietly. A criteria query is a mapped
 * query, so the restriction still applies and the contract holds for free.
 */
public final class TokenSearchSpec {

    private TokenSearchSpec() {
    }

    /**
     * A page request that turns the search cap and ordering into one reusable request.
     *
     * <p>The order is part of the contract, not a nicety: under a cap the ordering decides which
     * matches a caller sees at all, and an unordered LIMIT hands the same search different rows on
     * different runs.
     *
     * @param sortBy the attribute to order by, ascending
     * @return the first {@link SearchLimits#TYPEAHEAD_LIMIT} rows in that order
     */
    public static PageRequest capped(String sortBy) {
        return PageRequest.of(0, SearchLimits.TYPEAHEAD_LIMIT, Sort.by(sortBy));
    }

    /**
     * Matches rows where every token is a case-insensitive substring of at least one of
     * {@code attributes}.
     *
     * <p>Zero tokens is the empty conjunction, which matches everything - so a blank term answers
     * the first capped page alphabetically, which is what an empty focused typeahead browses.
     *
     * @param <T> the entity type
     * @param tokens the words the term was split into
     * @param attributes the string attributes a token may match, in any combination
     * @return the conjunction of one per-token disjunction
     */
    public static <T> Specification<T> matchingAllTokens(List<String> tokens, String... attributes) {
        return (root, query, builder) -> {
            Predicate[] perToken = tokens.stream()
                    .map(token -> builder.or(java.util.Arrays.stream(attributes)
                            .map(attribute -> builder.like(
                                    builder.lower(root.get(attribute)),
                                    "%" + token.toLowerCase() + "%"))
                            .toArray(Predicate[]::new)))
                    .toArray(Predicate[]::new);
            return builder.and(perToken);
        };
    }
}
