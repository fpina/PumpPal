import { databaseUrlFor } from './environment';
import { dropTestDatabase, provisionTestDatabase } from './database';

export default async function setup() {
	const databaseUrl = databaseUrlFor('integration');
	await provisionTestDatabase(databaseUrl);

	return async () => {
		await dropTestDatabase(databaseUrl);
	};
}
