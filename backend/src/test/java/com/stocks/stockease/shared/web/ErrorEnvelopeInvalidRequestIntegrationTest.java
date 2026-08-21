package com.stocks.stockease.shared.web;

import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.TESTER;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.invoiceBody;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.tag;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.stocks.stockease.customer.Customer;
import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.supplier.Supplier;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the {@code code} on every invalid-request refusal a client can actually receive, through the
 * real endpoints.
 *
 * <p>The family answers 400 for twelve situations and the JDK's own {@link IllegalArgumentException}
 * still answers 400 uncoded beside it, so status separates none of them. The code is what lets a
 * client tell the party rule from the reversed period from the empty window - and tell all three
 * from a library failure it can say nothing useful about at all.
 *
 * <p>Four of the twelve are here because four are all that reach the wire. The other eight declare
 * the same rule as a bean-validation constraint on the request record, so a client sending the bad
 * value gets the validation envelope and never reaches the service check behind it; those are
 * pinned at the service layer instead, in the specs that own each rule, and each names its
 * shadowing constraint in {@link ApiErrorCodes}. Ruling R47's protocol, applied to this family.
 *
 * <p>{@link ApiErrorCodes#PERIOD_START_AFTER_END} is asserted twice, on the reporting endpoint and
 * on the audit endpoint. The two controllers restate the check independently and share the code by
 * ruling R48, so both cases are needed to show the sharing actually holds on the wire.
 *
 * <p>Sibling of {@link ErrorEnvelopeCodeIntegrationTest},
 * {@link ErrorEnvelopeEntityInUseIntegrationTest} and
 * {@link ErrorEnvelopeMovementIntegrationTest}. The split is by family, and the annotation block
 * above is byte-identical to those files' on purpose: Spring caches a context by its configuration,
 * so identical annotations mean all four classes are served by one application context rather than
 * paying to build a fourth. Anything shared between them lives in
 * {@link ErrorEnvelopeTestFixtures} - in particular the counter, because these tests commit.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeInvalidRequestIntegrationTest extends AbstractIntegrationTest {

    @Autowired private SupplierService suppliers;
    @Autowired private CustomerService customers;
    @Autowired private ProductService products;
    @Autowired private InvoiceService invoices;
    @Autowired private UserRepository userRepository;
    @Autowired private MockMvc mockMvc;

    private ErrorEnvelopeTestFixtures fixtures;

    @BeforeEach
    void setUp() {
        fixtures = new ErrorEnvelopeTestFixtures(suppliers, customers, products, invoices, userRepository);
    }

    private Product widget() {
        return fixtures.live("Envelope Request Widget " + tag(), "REQ-" + ErrorEnvelopeTestFixtures.N.incrementAndGet());
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createInvoice_purchaseNamingACustomer_answers400WithThePurchasePartyCode() throws Exception {
        Customer customer = fixtures.customer("Envelope Request Buyer");

        // A purchase is billed by a supplier; naming a customer instead is the mismatch. Bean
        // validation cannot express this - the rule is about the pair of fields, not either one.
        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON)
                        .content(invoiceBody("PURCHASE", null, customer.getId(), widget().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PURCHASE_INVOICE_PARTY_MISMATCH))
                .andExpect(jsonPath("$.message").value("Purchase invoices require a supplier and no customer."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void createInvoice_saleNamingASupplier_answers400WithTheSalePartyCode() throws Exception {
        Supplier supplier = fixtures.supplier("Envelope Request Seller");

        mockMvc.perform(post("/api/invoices").contentType(MediaType.APPLICATION_JSON)
                        .content(invoiceBody("SALE", supplier.getId(), null, widget().getId())))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.SALE_INVOICE_PARTY_MISMATCH))
                .andExpect(jsonPath("$.message").value("Sale invoices must not reference a supplier."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void stockHistory_periodReversed_answers400WithThePeriodCode() throws Exception {
        mockMvc.perform(get("/api/reports/products/1/stock-history")
                        .param("from", "2030-02-01").param("to", "2030-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PERIOD_START_AFTER_END))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void auditChanges_periodReversed_answers400WithTheSamePeriodCode() throws Exception {
        // The other half of ruling R48: a different module, an independently restated check, and
        // deliberately the same code - because a client has nothing different to say about it.
        mockMvc.perform(get("/api/audit/changes")
                        .param("from", "2030-02-01").param("to", "2030-01-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PERIOD_START_AFTER_END))
                .andExpect(jsonPath("$.message").value("The start of the period must not be after its end."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void dueSoon_windowNotPositive_answers400WithTheDaysCode() throws Exception {
        mockMvc.perform(get("/api/reports/due-soon").param("days", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.REPORT_DAYS_NOT_POSITIVE))
                .andExpect(jsonPath("$.message").value("Days must be positive."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }
}
