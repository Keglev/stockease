package com.stocks.stockease.demo;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import lombok.RequiredArgsConstructor;

/**
 * Backdates the seeded baseline across the past six months.
 *
 * <p>The seed runs through the real services, so every row it creates is stamped with the instant the
 * seeding ran. That leaves the whole business history in one moment: the 30-day, 90-day and year
 * period presets all select the same rows, and any time series over the baseline is a single point.
 * This step moves that history apart afterwards (ADR 026 is unaffected; the decision here is ADR 027).
 *
 * <p>Raw SQL against other modules' tables, for the same reason the wipe is: rewriting audit
 * timestamps is not behaviour any business service offers, and the alternative - threading an
 * explicit clock through {@code createInvoice}, {@code close}, {@code recordMovement} and
 * {@code markAsPaid} - would put a demo concern into four production signatures. The demo module
 * already owns exactly this kind of cross-table infrastructure work.
 *
 * <p>Every shift is a <em>relative</em> interval subtracted from a row's existing timestamp rather
 * than an absolute moment assigned to it. That is what preserves causality for free: the seed already
 * wrote its rows in causal order within one instant, and subtracting one constant per invoice moves
 * that whole group without reordering anything inside it.
 */
@Service
@ConditionalOnDemoMode
@RequiredArgsConstructor
public class DemoTemporalSpread {

    private static final Logger log = LoggerFactory.getLogger(DemoTemporalSpread.class);

    /**
     * How many days back each seeded invoice's own moment moves - its creation, its close, the
     * movements that close booked, and the price changes it wrote.
     *
     * <p>Fixed values, never generated: the demo baseline is a contract that has to reproduce
     * identically on every nightly reset, and a randomised spread would make "what the demo shows"
     * unanswerable. This table is the single place the shape of the history is tuned.
     *
     * <p>Three constraints shape the numbers, and any edit has to keep all three:
     * <ul>
     *   <li><b>Purchases precede the sales that draw on them.</b> A sale's offset is smaller than the
     *       offset of every purchase stocking the products it sells, so no product is sold before the
     *       invoice that first put it on the shelf. The tightest of these is AR-2026-0004 and
     *       AR-2026-0005, both bounded by RE-2026-0163 at 96.</li>
     *   <li><b>All three period bands are populated.</b> Three closed invoices book movements inside
     *       30 days, four more inside 90, and everything falls inside 180 - so the profit presets
     *       return visibly different result sets rather than three copies of one answer.</li>
     *   <li><b>Paid dates land in all three bands too.</b> Cash flow filters on the payment date, not
     *       the booking date (ADR 025), so the presets there only differ if the settlements are spread
     *       as well: WP-2026-0091 and the two settled sales inside 30 days, 2026/RH/00934 between 30
     *       and 90, 2026/RH/00891 and AR-2026-0003 older than 90.</li>
     * </ul>
     *
     * <p>The two OPEN invoices carry offsets like the rest, but book no movements - an open invoice
     * books nothing (ADR 021) - so they only move their own creation date.
     */
    private static final Map<String, Integer> INVOICE_AGE_DAYS = invoiceAgeDays();

    private static Map<String, Integer> invoiceAgeDays() {
        Map<String, Integer> plan = new LinkedHashMap<>();
        // Purchases, oldest first: the stock has to exist before anything sells it.
        plan.put("RE-2026-0117", 168);
        plan.put("WP-2026-0075", 160);
        plan.put("BWA-2026-0442", 145);
        plan.put("2026/RH/00891", 130);
        plan.put("SL-26-004417", 112);
        plan.put("RE-2026-0163", 96);
        plan.put("2026/RH/00934", 62);
        plan.put("WP-2026-0091", 24);
        plan.put("WP-2026-0088", 6);
        // Sales, each below the offset of every purchase that stocked it.
        plan.put("AR-2026-0001", 138);
        plan.put("AR-2026-0002", 120);
        plan.put("AR-2026-0003", 104);
        plan.put("AR-2026-0004", 88);
        plan.put("AR-2026-0005", 72);
        plan.put("AR-2026-0006", 45);
        plan.put("AR-2026-0008", 20);
        plan.put("AR-2026-0009", 9);
        plan.put("AR-2026-0007", 3);
        return Map.copyOf(plan);
    }

    /**
     * Days between an invoice's shifted close and its settlement, for the invoices the seed pays.
     *
     * <p>Varied rather than constant so the demo does not suggest every customer pays on the same
     * schedule, and small enough that a payment never crosses out of the band its invoice was placed
     * in by the table above.
     */
    private static final Map<String, Integer> PAYMENT_LAG_DAYS = Map.of(
            "2026/RH/00891", 3,
            "2026/RH/00934", 2,
            "WP-2026-0091", 1,
            "AR-2026-0003", 3,
            "AR-2026-0008", 2,
            "AR-2026-0009", 1);

    /**
     * Offsets for the two write-offs, which hang off no invoice and so need placing themselves.
     *
     * <p>Keyed by reason because the baseline books exactly one of each. Both sit well inside the
     * spread and long after the purchases that stocked the products they write down.
     */
    private static final Map<String, Integer> LOSS_AGE_DAYS = Map.of(
            "LOST", 55,
            "DESTROYED", 33);

    /** Days a product is created before the first movement that touches it. */
    private static final int PRODUCT_LEAD_DAYS = 2;

    private final JdbcTemplate jdbcTemplate;

    /**
     * Moves the seeded history apart, then refuses to leave it standing if the result is incoherent.
     *
     * <p>One transaction, unlike the seed: the seed's steps are independent business operations that
     * each stand on their own, whereas a half-applied spread is history that contradicts itself.
     *
     * @throws IllegalStateException if the shifted data violates a causal ordering
     */
    @Transactional
    public void apply() {
        INVOICE_AGE_DAYS.forEach(this::shiftInvoice);
        PAYMENT_LAG_DAYS.forEach(this::settle);
        LOSS_AGE_DAYS.forEach(this::shiftLoss);
        shiftProducts();
        verify();
        log.info("Demo history spread across the past {} days.", INVOICE_AGE_DAYS.values().stream()
                .mapToInt(Integer::intValue).max().orElse(0));
    }

    /**
     * Moves one invoice and everything born from closing it back by {@code days}.
     *
     * <p>The due date is deliberately absent from every statement here. Due dates are the baseline's
     * designed anchors - they are what put invoices in the overdue and due-soon windows - so they are
     * placed relative to today on purpose and must keep pointing where the seeder aimed them.
     */
    private void shiftInvoice(String invoiceNumber, int days) {
        String interval = days + " days";

        jdbcTemplate.update("""
                UPDATE invoice
                SET created_at = created_at - CAST(? AS interval),
                    closed_at = closed_at - CAST(? AS interval)
                WHERE invoice_number = ?
                """, interval, interval, invoiceNumber);

        // Movements reach their invoice through the line they fulfil; the returns booked by hand hang
        // off a line too, so they travel with the invoice they reverse rather than needing their own
        // offset.
        jdbcTemplate.update("""
                UPDATE stock_movement m
                SET created_at = m.created_at - CAST(? AS interval)
                FROM invoice_item ii JOIN invoice i ON i.id = ii.invoice_id
                WHERE m.invoice_item_id = ii.id AND i.invoice_number = ?
                """, interval, invoiceNumber);

        // A price-change row carries no invoice reference, so it is matched by what it recorded: a
        // close reprices a product to that invoice's line price (ADR 019), and V6 makes
        // (invoice_id, product_id) unique, so at most one line per product per invoice can have
        // written it. Comparing numerically, because the log stores the value as text.
        jdbcTemplate.update("""
                UPDATE product_change_log c
                SET created_at = c.created_at - CAST(? AS interval)
                FROM invoice_item ii JOIN invoice i ON i.id = ii.invoice_id
                WHERE c.product_id = ii.product_id
                  AND c.field = 'PURCHASE_PRICE'
                  AND CAST(c.new_value AS numeric) = ii.unit_price
                  AND i.invoice_number = ?
                """, interval, invoiceNumber);
    }

    /** Places a settlement a fixed lag after the invoice's now-shifted close, never before it. */
    private void settle(String invoiceNumber, int lagDays) {
        jdbcTemplate.update("""
                UPDATE invoice
                SET paid_at = created_at + CAST(? AS interval)
                WHERE invoice_number = ? AND paid_at IS NOT NULL
                """, lagDays + " days", invoiceNumber);
    }

    /** Places a write-off, which no invoice accounts for and which therefore carries its own date. */
    private void shiftLoss(String reason, int days) {
        jdbcTemplate.update("""
                UPDATE stock_movement
                SET created_at = created_at - CAST(? AS interval)
                WHERE reason = ? AND invoice_item_id IS NULL
                """, days + " days", reason);
    }

    /**
     * Pulls each product back before the first movement that touches it.
     *
     * <p>Derived from the movements rather than given its own offset, because the constraint is a
     * relationship, not a date: a catalogue entry created after the delivery it received is the one
     * thing this step could plausibly get wrong, and deriving it makes that unrepresentable. A product
     * no movement touches keeps its seeded timestamp - there is nothing to be older than.
     */
    private void shiftProducts() {
        jdbcTemplate.update("""
                UPDATE product p
                SET created_at = first_touch.moment - CAST(? AS interval)
                FROM (SELECT product_id, MIN(created_at) AS moment FROM stock_movement GROUP BY product_id) first_touch
                WHERE first_touch.product_id = p.id
                """, PRODUCT_LEAD_DAYS + " days");
    }

    /**
     * Refuses to hand back history that contradicts itself.
     *
     * <p>The seed already fails loudly rather than leaving a partial baseline behind, and incoherent
     * timestamps deserve the same treatment: they would not break a page, they would quietly make the
     * demo argue against the invariants the application enforces.
     */
    private void verify() {
        long movementsBeforeTheirProduct = count("""
                SELECT COUNT(*) FROM stock_movement m JOIN product p ON p.id = m.product_id
                WHERE m.created_at < p.created_at
                """);
        long paymentsBeforeTheirInvoice = count("""
                SELECT COUNT(*) FROM invoice WHERE paid_at IS NOT NULL AND paid_at < created_at
                """);
        long futureHistory = count("""
                SELECT COUNT(*) FROM stock_movement WHERE created_at > now()
                """);

        if (movementsBeforeTheirProduct > 0 || paymentsBeforeTheirInvoice > 0 || futureHistory > 0) {
            throw new IllegalStateException("Demo temporal spread produced incoherent history: "
                    + movementsBeforeTheirProduct + " movement(s) predate their product, "
                    + paymentsBeforeTheirInvoice + " payment(s) predate their invoice, "
                    + futureHistory + " movement(s) are dated in the future.");
        }
    }

    private long count(String sql) {
        Long rows = jdbcTemplate.queryForObject(sql, Long.class);
        return rows == null ? 0L : rows;
    }
}
