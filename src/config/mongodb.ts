import { Db, MongoClient } from 'mongodb';
import { env } from './env.js';

const globalForMongo = globalThis as typeof globalThis & {
  progeniMongoDb?: Promise<Db>;
  progeniMongoClient?: Promise<MongoClient>;
};

function getMongoClient(): Promise<MongoClient> {
  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  if (!globalForMongo.progeniMongoClient) {
    const connection = new MongoClient(env.MONGODB_URI, {
      // Vercel scales out per-instance clients, so keep each serverless pool small.
      maxPoolSize: 3,
      // Avoid idle connections accumulating across warm function instances.
      minPoolSize: 0,
      maxIdleTimeMS: 10_000,
      // Limit connection bursts during concurrent cold starts.
      maxConnecting: 2,
    }).connect().catch((error: unknown) => {
      globalForMongo.progeniMongoClient = undefined;
      globalForMongo.progeniMongoDb = undefined;
      throw error;
    });
    globalForMongo.progeniMongoClient = connection;
  }

  return globalForMongo.progeniMongoClient;
}

export function getDatabase(): Promise<Db> {
  if (!globalForMongo.progeniMongoDb) {
    const database = getMongoClient()
      .then(async (client) => {
        const db = client.db(env.MONGODB_DB);
        await Promise.all([
          db.collection('resumes').createIndex({ user_id: 1, created_at: -1 }),
          db.collection('jobs').createIndex({ created_at: -1 }),
          db.collection('job_matches').createIndex({ user_id: 1, score: -1 }),
          db.collection('applications').createIndex({ user_id: 1, updated_at: -1 }),
          db.collection('applications').createIndex(
            { user_id: 1, idempotency_key: 1 },
            { unique: true },
          ),
        ]);
        return db;
      })
      .catch((error: unknown) => {
        globalForMongo.progeniMongoDb = undefined;
        throw error;
      });
    globalForMongo.progeniMongoDb = database;
  }

  return globalForMongo.progeniMongoDb;
}
