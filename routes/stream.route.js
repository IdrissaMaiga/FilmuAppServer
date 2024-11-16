import express from 'express'
import { getstream } from '../controllers/stream.controller.js'
import authenticateToken from '../middleware/verifyToken.js'

const streamRoute = express.Router()
streamRoute.use(authenticateToken)

streamRoute.get('', getstream)

export default streamRoute
