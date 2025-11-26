/**
 * MongoDB Connection Module for Vercel Serverless Functions
 * Handles connection to MongoDB Atlas with connection reuse
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://estatedeliuser:estatedeli12345@cluster0.xwvmm93.mongodb.net/instagram_study?retryWrites=true&w=majority';
const DB_NAME = 'instagram_study';

// Collection mapping for each condition
const COLLECTION_MAP = {
    'reel_carousel': 'reel_carousel_events',
    'feed_carousel': 'feed_carousel_events',
    'feed_video': 'feed_video_events',
    'reel_video': 'reel_video_events'
};

// Cache MongoDB connection for serverless (reuse across invocations)
let cachedClient = null;
let cachedDb = null;

/**
 * Connect to MongoDB Atlas (with connection reuse for serverless)
 */
async function connectToMongoDB() {
    try {
        // Reuse existing connection if available
        if (cachedClient && cachedDb) {
            // Test if connection is still alive
            try {
                await cachedClient.db('admin').command({ ping: 1 });
                return { client: cachedClient, db: cachedDb };
            } catch (error) {
                // Connection is dead, reset cache
                cachedClient = null;
                cachedDb = null;
            }
        }

        console.log('🔌 Connecting to MongoDB Atlas...');
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
        });

        await client.connect();
        console.log('✅ Connected to MongoDB Atlas successfully!');

        const db = client.db(DB_NAME);
        console.log(`📊 Using database: ${DB_NAME}`);

        // Cache connection for reuse
        cachedClient = client;
        cachedDb = db;

        // Create all collections if they don't exist
        for (const [condition, collectionName] of Object.entries(COLLECTION_MAP)) {
            const collections = await db.listCollections({ name: collectionName }).toArray();
            if (collections.length === 0) {
                await db.createCollection(collectionName);
                console.log(`📝 Created collection: ${collectionName}`);
            }
        }

        return { client, db };
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

/**
 * Get database instance
 */
async function getDatabase() {
    if (!cachedDb) {
        await connectToMongoDB();
    }
    return cachedDb;
}

/**
 * Get events collection based on condition/study_type
 */
async function getEventsCollection(studyType = null, condition = null) {
    const database = await getDatabase();
    
    // Determine collection name from condition or study_type
    let collectionName = 'events'; // default fallback
    
    // Check condition first (from properties)
    if (condition && COLLECTION_MAP[condition]) {
        collectionName = COLLECTION_MAP[condition];
    }
    // Then check study_type
    else if (studyType && COLLECTION_MAP[studyType]) {
        collectionName = COLLECTION_MAP[studyType];
    }
    
    return database.collection(collectionName);
}

/**
 * Test MongoDB connection
 */
async function testConnection() {
    try {
        const { db } = await connectToMongoDB();
        await db.admin().ping();
        console.log('✅ MongoDB connection test successful!');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection test failed:', error);
        return false;
    }
}

module.exports = {
    connectToMongoDB,
    getDatabase,
    getEventsCollection,
    testConnection,
    DB_NAME,
    COLLECTION_MAP
};

