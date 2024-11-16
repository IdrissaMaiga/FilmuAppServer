import express from 'express'
import {
  createPort,
  createPorts,
  getPorts,
  getPortById,
  updatePort,
  deletePort,
} from '../controllers/port.controller.js'
import { isAdmin } from '../middleware/verifyAdmin.js'
import authenticateToken from '../middleware/verifyToken.js'

const portRoute = express.Router()


portRoute.post('',authenticateToken, isAdmin, createPort)
portRoute.post('/bulk', authenticateToken,isAdmin, createPorts)
portRoute.get('', authenticateToken,getPorts)
portRoute.get('/:id',getPortById)
portRoute.put('/:id', authenticateToken,isAdmin, updatePort)
portRoute.delete('/:id', authenticateToken,isAdmin, deletePort)

export default portRoute
