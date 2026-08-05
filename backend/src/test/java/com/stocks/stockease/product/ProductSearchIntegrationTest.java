package com.stocks.stockease.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.security.User;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.SearchLimits;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Tests the product typeahead search against a real database, where the cap and the soft-delete
 * restriction actually apply - a mocked service proves none of it. Mirrors
 * {@code SupplierSearchIntegrationTest}, because the two endpoints now answer the same contract.
 * Every method commits into a shared database, so each one searches on a token of its own rather
 * than asserting on the whole table.
 */
@SpringBootTest
@ActiveProfiles("test")
class ProductSearchIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private ProductService productService;

    @Autowired
    private UserRepository userRepository;

    /** Names are shared across committing tests, so each run takes a token nothing else matches. */
    private static final AtomicInteger RUNS = new AtomicInteger();

    private static String token() {
        return "Zzprodsearch" + RUNS.incrementAndGet();
    }

    @Test
    void searchByName_partialNameInAnyCase_matchesSubstring() {
        String token = token();
        productService.create("North " + token + " Widget", token + "-SKU-1", 5.0);

        // lower-cased and mid-name: the match is a case-insensitive substring, not a prefix
        List<Product> found = productService.searchByName(token.toLowerCase());

        assertThat(found).extracting(Product::getName).containsExactly("North " + token + " Widget");
    }

    @Test
    void searchByName_moreMatchesThanTheCap_returnsTheCapAlphabetically() {
        String token = token();
        // one more than the cap, created out of order so the ordering asserted is the query's
        for (int i = SearchLimits.TYPEAHEAD_LIMIT; i >= 0; i--) {
            productService.create(token + " %02d".formatted(i), "%s-SKU-%02d".formatted(token, i), 5.0);
        }

        List<Product> found = productService.searchByName(token);

        assertThat(found).hasSize(SearchLimits.TYPEAHEAD_LIMIT);
        // alphabetical, so the capped window is the same one on every run rather than arbitrary
        assertThat(found.get(0).getName()).isEqualTo(token + " 00");
        assertThat(found.getLast().getName())
                .isEqualTo(token + " %02d".formatted(SearchLimits.TYPEAHEAD_LIMIT - 1));
    }

    @Test
    void searchByName_softDeletedProduct_isExcluded() {
        String token = token();
        Product live = productService.create(token + " Live", token + "-SKU-L", 5.0);
        Product retired = productService.create(token + " Retired", token + "-SKU-R", 5.0);
        productService.deleteById(retired.getId(), searcher());

        List<Product> found = productService.searchByName(token);

        // a picker offers what can still be acted on; the entity's @SQLRestriction is what enforces it
        assertThat(found).extracting(Product::getId).containsExactly(live.getId());
    }

    @Test
    void searchByName_nothingMatching_returnsEmpty() {
        assertThat(productService.searchByName(token() + " nothing matches this")).isEmpty();
    }

    @Test
    void searchByName_tokensInEitherOrder_matchTheSameProduct() {
        String token = token();
        String name = token + " Druckerpapier A4";
        productService.create(name, token + "-SKU-1", 5.0);

        // The finding this slice is about: a reader typing two fragments should not have to guess
        // the order the catalogue happens to record them in.
        assertThat(names(token + " dru pap")).containsExactly(name);
        assertThat(names("pap dru " + token)).containsExactly(name);
    }

    @Test
    void searchByName_tokenMatchingOnlyTheSku_findsTheProduct() {
        String token = token();
        String sku = token + "-BUE-1";
        String name = token + " Druckerpapier A4";
        productService.create(name, sku, 5.0);

        // Name OR SKU per token, which is what lets a reader search by the code on a shelf label.
        assertThat(names(sku.toLowerCase())).containsExactly(name);
        // And the two fields mix freely within one term: one token off the name, one off the SKU.
        assertThat(names("pap " + sku)).containsExactly(name);
    }

    @Test
    void searchByName_oneTokenMatchingNothing_returnsEmpty() {
        String token = token();
        productService.create(token + " Druckerpapier A4", token + "-SKU-1", 5.0);

        // AND, not OR: a term is every word the reader meant, so one miss is a miss.
        assertThat(productService.searchByName(token + " dru zzznope")).isEmpty();
    }

    @Test
    void searchByName_tokenSpanningNameAndSku_doesNotMatch() {
        String token = token();
        productService.create(token + " Widget", token + "-SKU-1", 5.0);

        // A token is matched against each field on its own, never against the pair concatenated -
        // so a fragment that only exists across the boundary is not a match.
        assertThat(productService.searchByName("Widget" + token + "-SKU")).isEmpty();
    }

    @Test
    void searchByName_blankTerm_returnsTheFirstCapAlphabetically() {
        String token = token();
        productService.create(token + " Browsable", token + "-SKU-1", 5.0);

        // Browse-on-focus rides on this. Measured on main before the change: the endpoint already
        // did it, because LIKE '%%' matches every row - so ADR 035 states an existing behaviour
        // rather than changing one, and this is the spec that stops it regressing.
        List<Product> found = productService.searchByName("");

        assertThat(found).isNotEmpty().hasSizeLessThanOrEqualTo(SearchLimits.TYPEAHEAD_LIMIT);
        assertThat(found).extracting(Product::getName).isSortedAccordingTo(String::compareTo);
    }

    @Test
    void searchByName_whitespaceOnlyTerm_behavesLikeBlank() {
        assertThat(names("   ")).isEqualTo(names(""));
    }

    @Test
    void searchByName_softDeletedProduct_isStillExcludedUnderTokenMatching() {
        String token = token();
        Product live = productService.create(token + " Live Widget", token + "-SKU-L", 5.0);
        Product retired = productService.create(token + " Retired Widget", token + "-SKU-R", 5.0);
        productService.deleteById(retired.getId(), searcher());

        // The reason the matching is a Specification and not native SQL: @SQLRestriction is a
        // mapping-level filter, and a native query would bypass it and offer a retired product.
        assertThat(productService.searchByName(token + " widget"))
                .extracting(Product::getId).containsExactly(live.getId());
    }

    private List<String> names(String term) {
        return productService.searchByName(term).stream().map(Product::getName).toList();
    }

    /** The delete path records a user, so the soft-delete case needs one to exist. */
    private User searcher() {
        return userRepository.findByUsername("product-search-tester")
                .orElseGet(() -> userRepository.saveAndFlush(
                        new User("product-search-tester", "hash", "ROLE_ADMIN")));
    }
}
