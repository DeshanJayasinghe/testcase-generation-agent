public class Calculator {
    public int add(int a, int b) {
        long result = (long) a + b;
        if (result > Integer.MAX_VALUE || result < Integer.MIN_VALUE) {
            throw new ArithmeticException("Integer overflow");
        }
        return (int) result;
    }

    public int subtract(int a, int b) {
        long result = (long) a - b;
        if (result > Integer.MAX_VALUE || result < Integer.MIN_VALUE) {
            throw new ArithmeticException("Integer overflow");
        }
        return (int) result;
    }

    public int multiply(int a, int b) {
        long result = (long) a * b;
        if (result > Integer.MAX_VALUE || result < Integer.MIN_VALUE) {
            throw new ArithmeticException("Integer overflow");
        }
        return (int) result;
    }

    public double divide(double a, double b) {
        if (b == 0.0) {
            throw new ArithmeticException("Division by zero is not allowed.");
        }
        return a / b;
    }
}

// NOTE: The test is wrong due to incorrect package imports. The test file should import the Calculator class from the correct package.
// The source code does not need modification.