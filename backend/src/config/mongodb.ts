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
          db.collection('job_matches').createIndex({ user_id: 1, overall_score: -1 }),
          db.collection('job_matches').createIndex({ user_id: 1, job_id: 1 }, { unique: true, sparse: true }),
          db.collection('job_matches').createIndex({ user_id: 1, eligibility_status: 1 }),
          db.collection('applications').createIndex({ user_id: 1, updated_at: -1 }),
          db.collection('applications').createIndex(
            { user_id: 1, idempotency_key: 1 },
            { unique: true },
          ),
          db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true }),
          db.collection('users').createIndex({ role: 1 }),
          db.collection('users').createIndex({ status: 1 }),
          db.collection('user_sessions').createIndex({ user_id: 1, created_at: -1 }),
          db.collection('auth_audit_logs').createIndex({ user_id: 1, timestamp: -1 }),
          db.collection('auth_audit_logs').createIndex({ action: 1, timestamp: -1 }),
          db.collection('extension_pairing_codes').createIndex(
            { expires_at: 1 },
            { expireAfterSeconds: 0 },
          ),
          db.collection('candidate_profiles').createIndex({ user_id: 1 }, { unique: true }),
          db.collection('candidate_preferences').createIndex({ user_id: 1 }, { unique: true }),
          db.collection('candidate_onboarding').createIndex({ user_id: 1 }, { unique: true }),
          db.collection('resume_claims').createIndex({ user_id: 1, resume_id: 1 }),
          db.collection('resume_claims').createIndex({ user_id: 1, category: 1 }),
          db.collection('resume_claims').createIndex({ user_id: 1, verification_status: 1 }),
          db.collection('resume_export_logs').createIndex({ user_id: 1, exported_at: -1 }),
          db.collection('jobs').createIndex({ provider: 1, external_job_id: 1 }),
          db.collection('jobs').createIndex({ canonical_url: 1 }),
          db.collection('jobs').createIndex({ status: 1, posted_at: -1 }),
          db.collection('candidate_saved_jobs').createIndex({ user_id: 1, job_id: 1 }, { unique: true }),
          db.collection('candidate_saved_jobs').createIndex({ user_id: 1, created_at: -1 }),
          db.collection('job_discovery_sources').createIndex({ provider: 1, identifier: 1 }, { unique: true, sparse: true }),
          db.collection('job_discovery_runs').createIndex({ started_at: -1 }),
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
