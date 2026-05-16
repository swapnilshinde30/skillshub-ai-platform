import 'reflect-metadata';
import AppDataSource from '../data-source';
import { seedTaxonomy } from './taxonomy.seed';
import { seedProfiles } from './profiles.seed';

async function runSeeds(): Promise<void> {
  console.log('Initialising database connection...');
  await AppDataSource.initialize();

  try {
    console.log('\n── Seeding taxonomy ─────────────────────────────');
    await seedTaxonomy(AppDataSource);

    console.log('\n── Seeding users & profiles ─────────────────────');
    await seedProfiles(AppDataSource);

    console.log('\n✓ All seeds completed successfully');
    console.log('\nDemo credentials:');
    console.log('  HR:       hr@skillshub.demo       / demo1234');
    console.log('  Employee: sarah.chen@skillshub.demo / demo1234');
  } finally {
    await AppDataSource.destroy();
  }
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
