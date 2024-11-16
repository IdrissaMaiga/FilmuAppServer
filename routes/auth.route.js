import express from 'express'
import { login, logout } from '../controllers/auth.controller.js'
import cookieParser from 'cookie-parser'


const router = express.Router()
//end of demo lines
router.use(cookieParser())

router.post('/login', login)
router.post('/logout',logout)

export default router
