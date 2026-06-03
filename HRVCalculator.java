/**
 * HRVCalculator.java
 * Computes RMSSD from RR intervals.
 *
 * Batch mode (default, reads from stdin):
 *   Each line of stdin is one window: space-separated RR values (ms).
 *   Outputs one RMSSD value per line (same order).
 *
 * Single mode (legacy, command-line args):
 *   java HRVCalculator 800 810 790 820 805 ...
 *   Outputs a single RMSSD value.
 */
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class HRVCalculator {

    /**
     * Compute RMSSD from an array of RR intervals.
     * RMSSD = sqrt( mean( (RR[i+1] - RR[i])^2 ) )
     */
    public static double computeRMSSD(double[] rr) {
        if (rr.length < 2) {
            throw new IllegalArgumentException("Need at least 2 RR intervals to compute RMSSD.");
        }
        double sumSq = 0.0;
        for (int i = 0; i < rr.length - 1; i++) {
            double diff = rr[i + 1] - rr[i];
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq / (rr.length - 1));
    }

    public static void main(String[] args) throws Exception {
        if (args.length >= 2) {
            // Legacy single-window mode: values passed as command-line args
            double[] rr = new double[args.length];
            for (int i = 0; i < args.length; i++) {
                rr[i] = Double.parseDouble(args[i]);
            }
            System.out.printf("%.4f%n", computeRMSSD(rr));
            return;
        }

        // Batch mode: read windows from stdin, one window per line
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] tokens = line.split("\\s+");
            double[] rr = new double[tokens.length];
            for (int i = 0; i < tokens.length; i++) {
                rr[i] = Double.parseDouble(tokens[i]);
            }
            if (rr.length < 2) {
                System.out.println("NaN");
            } else {
                System.out.printf("%.4f%n", computeRMSSD(rr));
            }
        }
    }
}
