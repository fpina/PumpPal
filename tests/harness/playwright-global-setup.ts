import { provisionTestDatabase } from './database';
import { databaseUrlFor } from './environment';

export default async function setup() {
	await provisionTestDatabase(databaseUrlFor('e2e'));
}
