import express from 'express'
import {
  getDownloads,
} from '../controllers/download.controller.js'
import authenticateToken from '../middleware/verifyToken.js'

const downloadRoute = express.Router()

// Route to get all downloads of the logged-in user
downloadRoute.get('/s', authenticateToken, getDownloads)

export default downloadRoute
