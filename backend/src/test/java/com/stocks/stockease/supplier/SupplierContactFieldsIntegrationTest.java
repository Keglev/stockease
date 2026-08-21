package com.stocks.stockease.supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.InvalidRequestException;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Exercises the supplier contact fields against a real database, where V23's columns either exist
 * or the test cannot run at all.
 *
 * <p>The controller slice tests next door mock the service, so nothing there touches a column - a
 * migration that never ran would leave every one of them green. These are the ones that would go
 * red, and they are here for that reason rather than to re-check the request contract.
 *
 * <p>Every method commits into the shared database, so each takes a token of its own.
 */
@SpringBootTest
@ActiveProfiles("test")
class SupplierContactFieldsIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private SupplierService supplierService;

    private static final AtomicInteger RUNS = new AtomicInteger();

    private static String token() {
        return "Zzcontact" + RUNS.incrementAndGet();
    }

    @Test
    void create_withEveryContactField_persistsAllOfThem() {
        Supplier created = supplierService.create(token(), "acme@example.com", "555-1234", "1 Main St",
                "Springfield");

        Supplier reread = supplierService.findById(created.getId()).orElseThrow();
        assertThat(reread.getEmail()).isEqualTo("acme@example.com");
        assertThat(reread.getPhone()).isEqualTo("555-1234");
        assertThat(reread.getAddress()).isEqualTo("1 Main St");
        assertThat(reread.getCity()).isEqualTo("Springfield");
    }

    @Test
    void create_withOnlyNameAndAddress_leavesTheOptionalColumnsNull() {
        String name = token();
        Supplier created = supplierService.create(name, null, null, "1 Main St", null);

        // The pre-V23 supplier, still valid: the mandatory pair is the whole contract, and the new
        // columns are absent rather than blank.
        Supplier reread = supplierService.findById(created.getId()).orElseThrow();
        assertThat(reread.getName()).isEqualTo(name);
        assertThat(reread.getEmail()).isNull();
        assertThat(reread.getPhone()).isNull();
        assertThat(reread.getCity()).isNull();
    }

    @Test
    void update_withNewContactValues_replacesThem() {
        Supplier created = supplierService.create(token(), "old@example.com", "555-0000", "1 Main St", "Springfield");

        supplierService.update(created.getId(), created.getName(), "new@example.com", "555-1111", "2 Side St",
                "Shelbyville");

        Supplier reread = supplierService.findById(created.getId()).orElseThrow();
        assertThat(reread.getEmail()).isEqualTo("new@example.com");
        assertThat(reread.getPhone()).isEqualTo("555-1111");
        assertThat(reread.getAddress()).isEqualTo("2 Side St");
        assertThat(reread.getCity()).isEqualTo("Shelbyville");
    }

    @Test
    void update_omittingContactValues_clearsThem() {
        Supplier created = supplierService.create(token(), "old@example.com", "555-0000", "1 Main St", "Springfield");

        // The wholesale-replace semantics the PUT javadoc claims: replacing an optional field with
        // absent removes it. A merge would have left the old email in place, which is the failure
        // this asserts against.
        supplierService.update(created.getId(), created.getName(), null, null, "1 Main St", null);

        Supplier reread = supplierService.findById(created.getId()).orElseThrow();
        assertThat(reread.getEmail()).isNull();
        assertThat(reread.getPhone()).isNull();
        assertThat(reread.getCity()).isNull();
        assertThat(reread.getAddress()).isEqualTo("1 Main St");
    }

    @Test
    void update_withBlankAddressButFullContactDetails_stillRejects() {
        Supplier created = supplierService.create(token(), "keep@example.com", null, "1 Main St", null);

        // The guard is untouched by this change: optional fields being present does not excuse a
        // missing mandatory one.
        assertThatThrownBy(() -> supplierService.update(created.getId(), created.getName(), "keep@example.com", null,
                "   ", null))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessage("Supplier name and address are required.")
                .extracting(thrown -> ((InvalidRequestException) thrown).getCode())
                .isEqualTo(ApiErrorCodes.SUPPLIER_NAME_AND_ADDRESS_REQUIRED);
    }
}
