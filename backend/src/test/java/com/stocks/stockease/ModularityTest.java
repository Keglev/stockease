package com.stocks.stockease;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/** Verifies the Spring Modulith module boundaries and generates their documentation. */
class ModularityTest {

    static ApplicationModules modules = ApplicationModules.of(StockEaseApplication.class);

    @Test
    void modules_packageStructure_verificationSucceeds() {
        modules.verify();
    }

    @Test
    void modules_packageStructure_documentationGenerates() {
        assertDoesNotThrow(() -> new Documenter(modules).writeModulesAsPlantUml());
    }
}
