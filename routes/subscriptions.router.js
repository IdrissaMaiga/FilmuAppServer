import express from 'express';
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getAllSubscriptions,
  createBulkSubscriptions, // Import the new controller
} from '../controllers/subscriptions.controller.js';
import authenticateToken from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/verifyAdmin.js';

const subscriptionRoute = express.Router();


// Route to create a subscription (Admin only)
subscriptionRoute.post('',authenticateToken,isAdmin, createSubscription);
// Route to create a subscriptionbulk (Admin only)
subscriptionRoute.post('/bulk',authenticateToken,isAdmin, createBulkSubscriptions);

// Route to update a subscription by ID (Admin only)
subscriptionRoute.put('/:id',authenticateToken, isAdmin,updateSubscription);

// Route to delete a subscription by ID (Admin only)
subscriptionRoute.delete('/:id',authenticateToken,isAdmin, deleteSubscription);

// Route to get all subscriptions
subscriptionRoute.get('', getAllSubscriptions);

export default subscriptionRoute;
