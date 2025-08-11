import { MongoClient, type Db, type Collection, type Document } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri, { ignoreUndefined: true, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('MONGO_NOT_CONNECTED');
  return db;
}

export function getCollection<T extends Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}

export async function ensureIndexes() {
  // Users
  await getCollection<any>('users').createIndex({ email: 1 }, { unique: true });
  // Requests
  await getCollection<any>('requests').createIndex({ userId: 1, createdAt: -1 });
  await getCollection<any>('requests').createIndex({ status: 1, createdAt: -1 });
  // Bookings
  await getCollection<any>('bookings').createIndex({ envId: 1, createdAt: -1 });
  await getCollection<any>('bookings').createIndex({ userId: 1, createdAt: -1 });
} 