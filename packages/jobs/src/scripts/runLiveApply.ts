import { LiveJobRunner } from '../automation/liveJobRunner.js';

async function main() {
  const args = process.argv.slice(2);
  const isHeadless = args.includes('--headless');
  // Safe default: Dry run is strictly active unless --live is explicitly passed
  const isLive = args.includes('--live');
  const isDryRun = !isLive;
  const platformArg = args.find((a) => a.startsWith('--platform='))?.split('=')[1] || 'all';

  let platforms: Array<'LINKEDIN' | 'INSTAHYRE'> = ['LINKEDIN', 'INSTAHYRE'];
  if (platformArg.toLowerCase() === 'linkedin') {
    platforms = ['LINKEDIN'];
  } else if (platformArg.toLowerCase() === 'instahyre') {
    platforms = ['INSTAHYRE'];
  }

  console.log(`\n======================================================`);
  console.log(`🚀 Saarthi Autonomous Live Job Runner`);
  console.log(`Platforms: ${platforms.join(', ')}`);
  console.log(`Browser Mode: ${isHeadless ? 'Headless (Silent)' : 'Headed (Visible Browser)'}`);
  console.log(`Mode: ${isDryRun ? '🛡️ DRY RUN (Safe mode: no actual submissions)' : '⚠️ LIVE SUBMISSION (Real applications will be submitted)'}`);
  console.log(`======================================================\n`);

  const summary = await LiveJobRunner.execute({
    platforms,
    headless: isHeadless,
    dryRun: isDryRun,
    maxApplicationsPerPlatform: 15,
  });

  console.log(`\n🎯 Execution Finished!`);
  console.log(`Summary:`);
  console.log(`- Total Applied: ${summary.totalApplied}`);
  console.log(`- Total Skipped: ${summary.totalSkipped}`);
  console.log(`- Already Applied: ${summary.totalAlreadyApplied}`);
  console.log(`- Total Duration: ${(summary.durationMs / 1000).toFixed(1)}s\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
