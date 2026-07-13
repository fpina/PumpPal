import { dropTestDatabase } from './database';
import { databaseUrlFor } from './environment';

export default async function teardown() {
	await dropTestDatabase(databaseUrlFor('e2e'));
}
