import express from 'express'
import {
  createWatching,
  getWatching,
  updateWatching,
  deleteWatching
} from '../controllers/watching.controller.js'
import authenticateToken from '../middleware/verifyToken.js'

const watchingRoute = express.Router()

// Route to create a new watching record
watchingRoute.post('', authenticateToken, createWatching)

// Route to get the watching records of the logged-in user
watchingRoute.get('', authenticateToken, getWatching)

// Route to update the watching record of the logged-in user
watchingRoute.put(
  '/:id',
  authenticateToken,
  updateWatching
)

// Route to delete the watching record of the logged-in user
watchingRoute.delete('/:id', authenticateToken, deleteWatching)

export default watchingRoute
