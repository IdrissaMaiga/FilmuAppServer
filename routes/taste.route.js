import express from 'express'
import {
  createTaste,
  getTaste,
  updateTaste,
  ///deleteTaste,
  getAllTastes,
  addOrDeleteTaste,
  checkTaste
} from '../controllers/taste.controller.js' // Assuming these controller functions are defined
import authenticateToken from '../middleware/verifyToken.js'

const tasteRoute = express.Router()
// Route to create a new taste
tasteRoute.post('', authenticateToken, createTaste)

// Route to get the taste of the logged-in user
tasteRoute.get('/:userId', authenticateToken, getTaste)

// Route to update the taste of a user by ID
tasteRoute.put(
  '/:userId',
  authenticateToken,
  updateTaste
)

// Route to delete the taste of the logged-in user
//tasteRoute.delete('/:userId', authenticateToken, deleteTaste)
// Route to  add or serie to the taste of the logged-in user
tasteRoute.get('/is/in', authenticateToken,checkTaste)
tasteRoute.get('', authenticateToken, getTaste)
tasteRoute.patch('/addOrdelete', authenticateToken, addOrDeleteTaste)


// Route to get all tastes (for admin use)
tasteRoute.get('all', authenticateToken, getAllTastes)


export default tasteRoute
