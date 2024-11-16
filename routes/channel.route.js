import express from 'express'
import {
  //createChannel,
  getChannels,
  getChannelById,
  //updateChannel,
  //deleteChannel,
  createChannels
} from '../controllers/channel.controller.js'
import { isAdmin } from '../middleware/verifyAdmin.js'
import authenticateToken from '../middleware/verifyToken.js'

const channelRoute = express.Router()
channelRoute.use(authenticateToken)

//channelRoute.post('', isAdmin, createChannel)
channelRoute.post('/bulk', isAdmin, createChannels)
channelRoute.get('', getChannels)
channelRoute.get('/:id', getChannelById)
//channelRoute.put('/:id', isAdmin, updateChannel)
//channelRoute.delete('/:id', isAdmin, deleteChannel)

export default channelRoute
