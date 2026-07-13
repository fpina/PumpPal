import { databaseUrlFor } from './environment';

process.env.PUMPPAL_TEST_DATABASE_URL = databaseUrlFor('integration');
