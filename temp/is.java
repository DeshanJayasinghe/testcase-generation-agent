import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

// Assume the Calculator class is in the same package
import your.package.Calculator;

public class CalculatorTest {

    private Calculator calculator;

    @BeforeEach
    public void setUp() {
        calculator = new Calculator();
    }

    // Test arithmetic operations with positive numbers (functional)
    @Test
    public void testMultiplyPositiveNumbers() {
        assertEquals(20, calculator.multiply(4, 5), "4 * 5 should be 20");
        assertEquals(100, calculator.multiply(10, 10), "10 * 10 should be 100");
    }

    // Test operations with negative numbers and zero (edge-case)
    @Test
    public void testMultiplyWithNegativeNumbers() {
        assertEquals(-20, calculator.multiply(-4, 5), "-4 * 5 should be -20");
        assertEquals(-20, calculator.multiply(4, -5), "4 * -5 should be -20");
        assertEquals(20, calculator.multiply(-4, -5), "-4 * -5 should be 20");
    }

    @Test
    public void testMultiplyWithZero() {
        assertEquals(0, calculator.multiply(0, 5), "0 * 5 should be 0");
        assertEquals(0, calculator.multiply(4, 0), "4 * 0 should be 0");
        assertEquals(0, calculator.multiply(0, 0), "0 * 0 should be 0");
    }

    // Test division by zero throws exception (error-handling)
    // Note: Since this is a multiply method, testing division by zero does not apply.
    // Assuming the requirement meant to check for zero multiplication edge cases.
}