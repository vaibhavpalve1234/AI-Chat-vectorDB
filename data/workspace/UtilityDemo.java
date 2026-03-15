// Java utility demo with explanatory functions
public class UtilityDemo {
    /** Returns the sum of two integers. */
    public static int add(int a, int b) {
        return a + b;
    }

    /** Reverses the input string. */
    public static String reverseString(String s) {
        return new StringBuilder(s).reverse().toString();
    }

    /** Finds the maximum value in an integer array. */
    public static int maxInArray(int[] arr) {
        int max = Integer.MIN_VALUE;
        for (int v : arr) {
            if (v > max) max = v;
        }
        return max;
    }

    /** Reads all lines from a text file into a List. */
    public static java.util.List<String> readFileLines(String path) throws java.io.IOException {
        return java.nio.file.Files.readAllLines(java.nio.file.Paths.get(path));
    }

    /** Returns a new list with the integers sorted in ascending order. */
    public static java.util.List<Integer> sortList(java.util.List<Integer> list) {
        java.util.List<Integer> copy = new java.util.ArrayList<>(list);
        java.util.Collections.sort(copy);
        return copy;
    }

    /** Demonstrates usage of all above methods. */
    public static void main(String[] args) {
        System.out.println("Add 3 + 5 = " + add(3, 5));
        System.out.println("Reverse 'hello' = " + reverseString("hello"));
        int[] nums = {4, 2, 9, 1};
        System.out.println("Max in array = " + maxInArray(nums));
        java.util.List<Integer> list = java.util.Arrays.asList(5, 3, 8, 1);
        System.out.println("Sorted list = " + sortList(list));
        // File reading demo (requires a valid path)
        // try { System.out.println(readFileLines("example.txt")); } catch (Exception e) { e.printStackTrace(); }
    }
}
