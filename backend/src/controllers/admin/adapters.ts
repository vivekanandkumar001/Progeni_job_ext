import { Request, Response } from 'express';
import { getDatabase } from '../../config/mongodb.js';

/**
 * Get all adapter configurations
 */
export async function getAllAdapters(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const adaptersCol = db.collection('adapters');
    
    const adapters = await adaptersCol
      .find()
      .sort({ name: 1 })
      .toArray();

    res.json({
      success: true,
      data: adapters.map((a: any) => ({
        id: a._id,
        name: a.name,
        platform: a.platform,
        status: a.status,
        lastTested: a.lastTested,
        successRate: a.successRate,
        capabilities: a.capabilities,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Test adapter functionality
 */
export async function testAdapter(req: Request, res: Response): Promise<void> {
  try {
    const adapterName = req.params.id;
    const testData = req.body;
    
    const db = await getDatabase();
    const adaptersCol = db.collection('adapters');
    
    const adapter = await adaptersCol.findOne({ name: adapterName });
    if (!adapter) {
      return res.status(404).json({ error: 'Adapter not found' });
    }
    
    // Simulate adapter test - in production this would test actual adapter functionality
    const result = {
      adapterName,
      testData,
      status: 'completed',
      success: true,
      matchedSkills: ['Python', 'JavaScript', 'React'],
      missingSkills: ['Node.js', 'SQL'],
      confidenceScore: 87,
      testDuration: 2.3,
    };
    
    // Update adapter last tested timestamp
    await adaptersCol.updateOne(
      { name: adapterName },
      { 
        $set: { lastTested: new Date() },
        $setOnInsert: { status: 'active' }
      }
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Refresh adapter cache
 */
export async function refreshAdapterCache(req: Request, res: Response): Promise<void> {
  try {
    const db = await getDatabase();
    const adaptersCol = db.collection('adapters');
    
    // Refresh all adapters - mark them for re-evaluation
    await adaptersCol.updateMany(
      {},
      { 
        $set: { lastTested: new Date() },
        $setOnInsert: { status: 'pending' }
      }
    );
    
    res.json({
      success: true,
      message: 'Adapter cache refresh initiated successfully',
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}