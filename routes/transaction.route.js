import express from 'express';
import {
  createsubscriptionTransaction,
  createdownloadsTransactionSingle,
  createDepositTransaction,
  createRetraitTransaction,
  reverseTransaction,
  createMoneyflow,
  updateMoneyflow,
  deleteMoneyflow,
  getAllMoneyFlow,
  uploadSingleImage,
  getUserTransactions,
  getAllTransactions,
  createDepositTransactionByAdmin,
  getTransaction
} from '../controllers/transaction.controller.js';
import authenticateToken from '../middleware/verifyToken.js';
import { isAdmin } from '../middleware/verifyAdmin.js';

const transactionRoute = express.Router();



// Routes for Moneyflow operations
transactionRoute.post('/moneyflow',authenticateToken, (req, res, next) => {
  if (req.isFinance) return createMoneyflow(req, res);
  res.status(403).json({ error: "Unauthorized: Finance permissions required" });
});

transactionRoute.put('/moneyflow/:id',authenticateToken, isAdmin, updateMoneyflow);
transactionRoute.delete('/moneyflow/:id', authenticateToken,isAdmin, deleteMoneyflow);
transactionRoute.get("/moneyflows",authenticateToken,isAdmin,getAllMoneyFlow)

// Routes for transaction operations
transactionRoute.post('/subscription',authenticateToken, createsubscriptionTransaction);
transactionRoute.post('/download/single',authenticateToken, createdownloadsTransactionSingle);
transactionRoute.post('/deposit',authenticateToken, uploadSingleImage, createDepositTransaction);
transactionRoute.post('/retrait',authenticateToken,  createRetraitTransaction);

transactionRoute.get('/mine',authenticateToken ,getUserTransactions); 
transactionRoute.get('/all',authenticateToken, isAdmin,getAllTransactions); 
transactionRoute.get('/one',authenticateToken, isAdmin,getTransaction); 
transactionRoute.post('/admindeposit',authenticateToken, isAdmin,createDepositTransactionByAdmin); 

// Admin-restricted transaction routes
transactionRoute.post('/reverse',authenticateToken,isAdmin,reverseTransaction);

export default transactionRoute;
