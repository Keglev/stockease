package com.stocks.stockease.shared.web;

import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.TESTER;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.returnBody;
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

import com.stocks.stockease.customer.CustomerService;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the {@code code} and {@code params} on every not-found refusal, through the real endpoints.
 *
 * <p>Seven situations and all seven answer 404, so status separates none of them. An unknown
 * product and a product with no profit report are the same status and two different things to tell
 * the operator - one means the row is gone, the other means the row is fine and the period is
 * empty. The code is what tells them apart, and {@code params.id} carries the only part of each
 * sentence that is not fixed prose.
 *
 * <p>All seven are here because all seven reach the wire: every one of them sits behind a lookup by
 * id that a client can ask for with an id that is not there. Nothing in this family is latent,
 * which is why no member names a shadowing guard in {@link ApiErrorCodes} the way the movement and
 * invalid-request families do.
 *
 * <p>Two of the seven cases exercise endpoints whose sentence this PR changed:
 * {@code GET /api/products/{id}} used to build its own 404 inline, with a sentence of its own. It
 * now raises the family's exception, and the case below asserts the canonical sentence it answers
 * with (ruling 4a). The DELETE half of that convergence is pinned in
 * {@code ProductDeleteControllerTest}, at the slice that already owned the endpoint.
 *
 * <p>Sibling of {@link ErrorEnvelopeCodeIntegrationTest},
 * {@link ErrorEnvelopeEntityInUseIntegrationTest}, {@link ErrorEnvelopeInvalidRequestIntegrationTest}
 * and {@link ErrorEnvelopeMovementIntegrationTest}. The split is by family, and the annotation block
 * below is byte-identical to those files' on purpose: Spring caches a context by its configuration,
 * so identical annotations mean all five classes are served by one application context rather than
 * paying to build a fifth. Anything shared between them lives in {@link ErrorEnvelopeTestFixtures} -
 * in particular the counter, because these tests commit.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeMissingEntityIntegrationTest extends AbstractIntegrationTest {

    /* An id no row carries. Shared by every case: the situation is always "this id is not there". */
    private static final long ABSENT = 999999L;

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

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getCustomer_unknownId_answers404WithTheCustomerNotFoundCodeAndTheId() throws Exception {
        mockMvc.perform(get("/api/customers/" + ABSENT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Customer with ID " + ABSENT + " not found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.CUSTOMER_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getInvoice_unknownId_answers404WithTheInvoiceNotFoundCodeAndTheId() throws Exception {
        mockMvc.perform(get("/api/invoices/" + ABSENT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Invoice with ID " + ABSENT + " not found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INVOICE_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_unknownItemId_answers404WithTheInvoiceItemNotFoundCodeAndTheId() throws Exception {
        // The return endpoint, which is one of the two modules that look an invoice line up. Both
        // raise the same sentence and share the code by ruling R48; this is the one a client reaches.
        Product product = fixtures.live("Envelope Missing Widget", "MISS-" + ABSENT);

        mockMvc.perform(post("/api/returns")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(ABSENT, product.getId(), "RETURN_FROM_CUSTOMER", 1)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: Invoice item with ID " + ABSENT + " not found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.INVOICE_ITEM_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getProduct_unknownId_answers404WithTheProductNotFoundCodeAndTheId() throws Exception {
        // The endpoint whose wire text this PR changed: it used to answer "The product with ID
        // 999999 does not exist.", its own sentence for the situation every other lookup names the
        // canonical way (ruling 4a).
        mockMvc.perform(get("/api/products/" + ABSENT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Product with ID " + ABSENT + " not found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PRODUCT_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void restoreProduct_noSoftDeletedRow_answers404WithItsOwnCodeAndTheId() throws Exception {
        // Deliberately a different code from the lookup above: the operator is in the recycle bin,
        // and "no deleted product with this id" leaves open that it is alive and well.
        mockMvc.perform(post("/api/products/" + ABSENT + "/restore"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: No soft-deleted product with ID " + ABSENT + " found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.SOFT_DELETED_PRODUCT_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void getSupplier_unknownId_answers404WithTheSupplierNotFoundCodeAndTheId() throws Exception {
        mockMvc.perform(get("/api/suppliers/" + ABSENT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Entity not found: Supplier with ID " + ABSENT + " not found."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.SUPPLIER_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void profitForProduct_noReport_answers404WithTheProfitReportCodeAndTheId() throws Exception {
        // The report lookup rather than the product lookup: a product with no sales in the period
        // reaches this too, which is why it is its own code and not PRODUCT_NOT_FOUND.
        mockMvc.perform(get("/api/reports/profit/products/" + ABSENT))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message")
                        .value("Entity not found: No profit report for product with ID " + ABSENT + "."))
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.PROFIT_REPORT_NOT_FOUND))
                .andExpect(jsonPath("$.params.id").value(String.valueOf(ABSENT)));
    }
}
