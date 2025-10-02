import { AmbiguityDetector } from './ambiguity-detector';
import testData from './test-data/ambiguous-tickets.json';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  ticketId: string;
  text: string;
  expectedScore: number;
  actualScore: number;
  scoreDifference: number;
  expectedPatterns: string[];
  detectedPatterns: string[];
  missedPatterns: string[];
  extraPatterns: string[];
  passed: boolean;
}

interface ValidationSummary {
  totalTests: number;
  passed: number;
  failed: number;
  accuracy: number;
  averageScoreDifference: number;
  patternAccuracy: number;
  results: ValidationResult[];
}

export async function validateAmbiguityDetection(): Promise<ValidationSummary> {
  console.log('Starting ambiguity detection validation...\n');
  
  const detector = new AmbiguityDetector();
  const results: ValidationResult[] = [];
  let totalPatternMatches = 0;
  let totalExpectedPatterns = 0;

  for (const testCase of testData.testTickets) {
    console.log(`Testing ticket ${testCase.id}: "${testCase.text.substring(0, 50)}..."`);
    
    try {
      const detection = await detector.detectAmbiguity(testCase.text);
      
      const scoreDifference = Math.abs(detection.score - testCase.expectedScore);
      const detectedPatterns = detection.patterns;
      
      // Check which patterns were missed or extra
      const missedPatterns = testCase.expectedPatterns.filter(
        p => !detectedPatterns.includes(p)
      );
      const extraPatterns = detectedPatterns.filter(
        p => !testCase.expectedPatterns.includes(p)
      );
      
      // Consider test passed if score is within 0.15 tolerance
      const scorePassed = scoreDifference <= 0.15;
      
      // Pattern matching - at least 70% of expected patterns should be found
      const patternMatchRate = testCase.expectedPatterns.length > 0
        ? (testCase.expectedPatterns.length - missedPatterns.length) / testCase.expectedPatterns.length
        : detectedPatterns.length === 0 ? 1 : 0;
      const patternsPassed = patternMatchRate >= 0.7;
      
      const passed = scorePassed && patternsPassed;
      
      const result: ValidationResult = {
        ticketId: testCase.id,
        text: testCase.text,
        expectedScore: testCase.expectedScore,
        actualScore: detection.score,
        scoreDifference,
        expectedPatterns: testCase.expectedPatterns,
        detectedPatterns,
        missedPatterns,
        extraPatterns,
        passed,
      };
      
      results.push(result);
      
      // Track pattern accuracy
      totalExpectedPatterns += testCase.expectedPatterns.length;
      totalPatternMatches += testCase.expectedPatterns.length - missedPatterns.length;
      
      console.log(`  Expected Score: ${testCase.expectedScore}, Actual: ${detection.score.toFixed(2)}`);
      console.log(`  Patterns - Expected: ${testCase.expectedPatterns.join(', ') || 'none'}`);
      console.log(`  Patterns - Detected: ${detectedPatterns.join(', ') || 'none'}`);
      console.log(`  Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`  ${testCase.description}\n`);
      
    } catch (error) {
      console.error(`  ❌ Error testing ticket ${testCase.id}:`, error);
      results.push({
        ticketId: testCase.id,
        text: testCase.text,
        expectedScore: testCase.expectedScore,
        actualScore: -1,
        scoreDifference: 1,
        expectedPatterns: testCase.expectedPatterns,
        detectedPatterns: [],
        missedPatterns: testCase.expectedPatterns,
        extraPatterns: [],
        passed: false,
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const accuracy = (passed / results.length) * 100;
  const averageScoreDifference = 
    results.reduce((sum, r) => sum + r.scoreDifference, 0) / results.length;
  const patternAccuracy = totalExpectedPatterns > 0 
    ? (totalPatternMatches / totalExpectedPatterns) * 100
    : 100;

  const summary: ValidationSummary = {
    totalTests: results.length,
    passed,
    failed,
    accuracy,
    averageScoreDifference,
    patternAccuracy,
    results,
  };

  // Generate report
  const report = generateReport(summary);
  
  // Save report to file
  const reportPath = join(__dirname, 'test-data', 'validation-report.md');
  writeFileSync(reportPath, report);
  
  console.log('\n' + '='.repeat(50));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passed} (${accuracy.toFixed(1)}%)`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Average Score Difference: ${averageScoreDifference.toFixed(3)}`);
  console.log(`Pattern Detection Accuracy: ${patternAccuracy.toFixed(1)}%`);
  console.log(`\nDetailed report saved to: ${reportPath}`);
  
  // Check if we meet the 90% accuracy requirement
  if (accuracy >= 90) {
    console.log('\n✅ SUCCESS: Achieved 90%+ accuracy requirement!');
  } else {
    console.log(`\n⚠️  WARNING: Accuracy ${accuracy.toFixed(1)}% is below 90% requirement`);
  }

  return summary;
}

function generateReport(summary: ValidationSummary): string {
  let report = '# Ambiguity Detection Validation Report\n\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;
  
  report += '## Summary\n\n';
  report += `- **Total Tests**: ${summary.totalTests}\n`;
  report += `- **Passed**: ${summary.passed} (${summary.accuracy.toFixed(1)}%)\n`;
  report += `- **Failed**: ${summary.failed}\n`;
  report += `- **Average Score Difference**: ${summary.averageScoreDifference.toFixed(3)}\n`;
  report += `- **Pattern Detection Accuracy**: ${summary.patternAccuracy.toFixed(1)}%\n`;
  report += `- **Meets 90% Requirement**: ${summary.accuracy >= 90 ? 'Yes ✅' : 'No ❌'}\n\n`;
  
  report += '## Detailed Results\n\n';
  
  for (const result of summary.results) {
    report += `### Test ${result.ticketId} - ${result.passed ? 'PASSED ✅' : 'FAILED ❌'}\n\n`;
    report += `**Text**: "${result.text}"\n\n`;
    report += `**Scores**:\n`;
    report += `- Expected: ${result.expectedScore}\n`;
    report += `- Actual: ${result.actualScore.toFixed(2)}\n`;
    report += `- Difference: ${result.scoreDifference.toFixed(3)}\n\n`;
    
    report += `**Patterns**:\n`;
    report += `- Expected: ${result.expectedPatterns.join(', ') || 'none'}\n`;
    report += `- Detected: ${result.detectedPatterns.join(', ') || 'none'}\n`;
    if (result.missedPatterns.length > 0) {
      report += `- Missed: ${result.missedPatterns.join(', ')}\n`;
    }
    if (result.extraPatterns.length > 0) {
      report += `- Extra: ${result.extraPatterns.join(', ')}\n`;
    }
    report += '\n---\n\n';
  }
  
  report += '## Recommendations\n\n';
  
  if (summary.accuracy < 90) {
    report += '### Areas for Improvement\n\n';
    
    // Analyze common failures
    const failedResults = summary.results.filter(r => !r.passed);
    const highScoreDiffs = failedResults.filter(r => r.scoreDifference > 0.2);
    const patternMismatches = failedResults.filter(r => r.missedPatterns.length > 0);
    
    if (highScoreDiffs.length > 0) {
      report += `- **Score Calibration**: ${highScoreDiffs.length} tests had score differences > 0.2\n`;
      report += '  - Consider adjusting severity weights or scoring algorithm\n';
    }
    
    if (patternMismatches.length > 0) {
      const commonMissed = new Map<string, number>();
      patternMismatches.forEach(r => {
        r.missedPatterns.forEach(p => {
          commonMissed.set(p, (commonMissed.get(p) || 0) + 1);
        });
      });
      
      report += `- **Pattern Detection**: Common missed patterns:\n`;
      Array.from(commonMissed.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([pattern, count]) => {
          report += `  - ${pattern}: missed in ${count} tests\n`;
        });
    }
    
    report += '\n### Suggested Actions\n\n';
    report += '1. Review and refine prompt templates for pattern detection\n';
    report += '2. Adjust scoring weights based on test results\n';
    report += '3. Add more specific pattern matching rules\n';
    report += '4. Consider edge cases in vague term detection\n';
  } else {
    report += 'The ambiguity detection system meets the 90% accuracy requirement! 🎉\n\n';
    report += 'Consider:\n';
    report += '- Monitoring performance with production data\n';
    report += '- Collecting user feedback for continuous improvement\n';
    report += '- Expanding test dataset with real-world examples\n';
  }
  
  return report;
}

// Run validation if executed directly
if (require.main === module) {
  validateAmbiguityDetection()
    .then(summary => {
      process.exit(summary.accuracy >= 90 ? 0 : 1);
    })
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}