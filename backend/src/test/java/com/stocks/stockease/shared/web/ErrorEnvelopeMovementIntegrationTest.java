package com.stocks.stockease.shared.web;

import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.TESTER;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.movementBody;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.returnBody;
import static com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.tag;
import static org.hamcrest.Matchers.nullValue;
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
import com.stocks.stockease.invoice.Invoice;
import com.stocks.stockease.invoice.InvoiceService;
import com.stocks.stockease.product.Product;
import com.stocks.stockease.product.ProductService;
import com.stocks.stockease.security.internal.UserRepository;
import com.stocks.stockease.shared.ApiErrorCodes;
import com.stocks.stockease.shared.web.ErrorEnvelopeTestFixtures.Sold;
import com.stocks.stockease.supplier.SupplierService;
import com.stocks.stockease.support.AbstractIntegrationTest;

/**
 * Pins the {@code code} and {@code params} on the movement-matrix refusals a client can actually
 * receive, through the real endpoints.
 *
 * <p>The matrix has sixteen rules and every one of them answers 400, so status tells a client
 * nothing: the endpoint that took the wrong reason, the loss that forgot its remark and the return
 * pointed at the wrong invoice line are one status and three different things to tell the operator.
 * The code is the only field that separates them.
 *
 * <p>Six of the sixteen are here because six are all that reach the wire. The request records are
 * narrower than the command the service validates - they carry no {@code unitCost} at all - and
 * bean validation and the two controllers' reason gates catch most of the rest, so ten rules guard
 * a caller the HTTP surface cannot produce. Those are pinned at the service layer instead, in the
 * movement service specs, and each names its shadowing guard in {@link ApiErrorCodes}. Ruling R47
 * kept them coded anyway, so the situation is already named if a shadow ever moves.
 *
 * <p>Sibling of {@link ErrorEnvelopeCodeIntegrationTest} and
 * {@link ErrorEnvelopeEntityInUseIntegrationTest}. The split is by family, and the annotation block
 * above is byte-identical to those files' on purpose: Spring caches a context by its configuration,
 * so identical annotations mean all three classes are served by one application context rather than
 * paying to build a third. Anything shared between them lives in {@link ErrorEnvelopeTestFixtures} -
 * in particular the counter, because these tests commit.
 *
 * <p>Driven over HTTP rather than against the handler, because the claim being made is about what
 * a client receives.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ErrorEnvelopeMovementIntegrationTest extends AbstractIntegrationTest {

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
    void registerReturn_reasonIsNotAReturn_answers400WithTheReturnsOnlyCode() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);

        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(fixtures.firstItemId(sold.sale()), sold.item().getId(), "LOST", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.MOVEMENT_ENDPOINT_RETURNS_ONLY))
                .andExpect(jsonPath("$.message").value("This endpoint records returns only."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void recordMovement_reasonBelongsToAnotherFlow_answers400WithTheNotStandaloneCode() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);

        mockMvc.perform(post("/api/stock-movements").contentType(MediaType.APPLICATION_JSON)
                        .content(movementBody(sold.item().getId(), "RETURN_FROM_CUSTOMER", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.MOVEMENT_REASON_NOT_STANDALONE))
                .andExpect(jsonPath("$.message").value(
                        "PURCHASE and SOLD movements exist only through invoice closing; returns use the return endpoint."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void recordMovement_lossWithoutARemark_answers400WithTheRemarkRequiredCode() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);

        // the remark is checked before any stock is touched, so the sold-out product below reaches
        // this refusal rather than the insufficient-stock one
        mockMvc.perform(post("/api/stock-movements").contentType(MediaType.APPLICATION_JSON)
                        .content(movementBody(sold.item().getId(), "LOST", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.LOSS_MOVEMENT_REQUIRES_REMARK))
                .andExpect(jsonPath("$.message").value("LOST and DESTROYED movements require a remark."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_lineIsOnTheWrongInvoiceType_answers400WithTypeMismatchAndItsParams() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);

        // a customer return belongs against the SALE line; this points it at the purchase one
        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(fixtures.firstItemId(sold.purchase()), sold.item().getId(),
                                "RETURN_FROM_CUSTOMER", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.MOVEMENT_INVOICE_TYPE_MISMATCH))
                .andExpect(jsonPath("$.message").value(
                        "RETURN_FROM_CUSTOMER movements must reference a SALE invoice item."))
                .andExpect(jsonPath("$.params.reason").value("RETURN_FROM_CUSTOMER"))
                .andExpect(jsonPath("$.params.requiredType").value("SALE"))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_invoiceStillOpen_answers400WithTheOpenInvoiceCode() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);
        Customer customer = fixtures.customer("Envelope Movement Open");
        Invoice openSale = fixtures.openSale(customer, sold.item(), 3);

        // this guard is what shadows RETURN_REQUIRES_CLOSED_INVOICE: the movement service refuses an
        // open invoice before the invoice module's own 409 for the same state can be reached
        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(fixtures.firstItemId(openSale), sold.item().getId(),
                                "RETURN_FROM_CUSTOMER", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.MOVEMENT_INVOICE_OPEN))
                .andExpect(jsonPath("$.message").value("Movements cannot be recorded against an open invoice."))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }

    @Test
    @WithMockUser(username = TESTER, roles = {"ADMIN"})
    void registerReturn_lineCarriesADifferentProduct_answers400WithProductMismatchAndItsParams() throws Exception {
        Sold sold = fixtures.buyAndSellOut(5);
        Product other = fixtures.live("Envelope Movement Other " + tag(),
                "MOVE-" + ErrorEnvelopeTestFixtures.N.incrementAndGet());
        long saleItemId = fixtures.firstItemId(sold.sale());

        mockMvc.perform(post("/api/returns").contentType(MediaType.APPLICATION_JSON)
                        .content(returnBody(saleItemId, other.getId(), "RETURN_FROM_CUSTOMER", 1)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ApiErrorCodes.MOVEMENT_ITEM_PRODUCT_MISMATCH))
                .andExpect(jsonPath("$.message").value(
                        "Invoice item " + saleItemId + " belongs to a different product."))
                .andExpect(jsonPath("$.params.invoiceItemId").value(String.valueOf(saleItemId)))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.data").value(nullValue()));
    }
}
