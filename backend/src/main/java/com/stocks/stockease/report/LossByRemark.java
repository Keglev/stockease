package com.stocks.stockease.report;

import java.math.BigDecimal;

/**
 * Units written off under one remark, valued at each product's current purchase price.
 *
 * <p>The per-product loss report answers which products were written off; this answers why. The
 * remark taxonomy was chosen to be groupable across both write-off reasons (ADR 020), which is what
 * makes a single row per remark a meaningful total rather than a mixture of incomparable things.
 *
 * @param remark the recorded cause, one of the {@code MovementRemark} values
 * @param lostUnits units written off as lost under this remark
 * @param destroyedUnits units written off as destroyed under this remark
 * @param lossValue the combined units valued at their products' current purchase prices
 */
public record LossByRemark(String remark, int lostUnits, int destroyedUnits, BigDecimal lossValue) {
}
