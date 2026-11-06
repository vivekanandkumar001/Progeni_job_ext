import { Router } from 'express';
import {
  getPlans,
  getSubscription,
  getCredits,
  getUsageHistory,
  createOrder,
  verifyPayment,
  cancelSubscription,
  getInvoices,
  getInvoiceReceipt,
} from '../controllers/billing.js';

const router = Router();

// Public / Candidate accessible
router.get('/plans', getPlans);
router.get('/subscription', getSubscription);
router.get('/credits', getCredits);
router.get('/usage', getUsageHistory);
router.post('/orders', createOrder);
router.post('/verify', verifyPayment);
router.post('/cancel', cancelSubscription);
router.get('/invoices', getInvoices);
router.get('/invoices/:invoiceNumber/receipt', getInvoiceReceipt);

export default router;

