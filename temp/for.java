Here's a comprehensive JUnit 5 test class for the `multiply` method of the `Calculator` class:

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

public class CalculatorTest {

    private Calculator calculator = new Calculator();

    @Test
    public void testMultiplyWithPositiveNumbers() {
        assertEquals(6, calculator.multiply(2, 3));
        assertEquals(15, calculator.multiply(5, 3));
        assertEquals(100, calculator.multiply(10, 10));
    }

    @Test
    public void testMultiplyWithNegativeNumbers() {
        assertEquals(-6, calculator.multiply(-2, 3));
        assertEquals(-9, calculator.multiply(3, -3));
        assertEquals(6, calculator.multiply(-2, -3));
    }

    @Test
    public void testMultiplyWithZero() {
        assertEquals(0, calculator.multiply(0, 5));
        assertEquals(0, calculator.multiply(5, 0));
        assertEquals(0, calculator.multiply(0, 0));
    }

    @Test
    public void testMultiplyWithIntegerOverflow() {
        assertThrows(ArithmeticException.class, new Executable() {
            @Override
            public void execute() throws Throwable {
                calculator.multiply(Integer.MAX_VALUE, 2);
            }
        });

        assertThrows(ArithmeticException.class, new Executable() {
            @Override
            public void execute() throws Throwable {
                calculator.multiply(Integer.MIN_VALUE, 2);
            }
        });
    }
}